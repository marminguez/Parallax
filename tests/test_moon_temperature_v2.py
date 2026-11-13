"""Moon temperature v2: byte-range reading, window membership and statistics on synthetic Diviner tables."""
import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("pyproj")
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("mt2", ROOT / "scripts/moon_temperature_v2.py")
mt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mt)


def table(temp_of, step=8):
    """A PCP-like table on every `step`-th 240 m pixel around the windows: 59-byte CRLF rows sorted by x then y."""
    wins = mt.windows()
    xs, ys = [], []
    for w in wins.values():
        r = np.arange(-30_000, 30_000, 240 * step)
        gx, gy = np.meshgrid(w["x"] + r, w["y"] + r)
        xs.append(gx.ravel()); ys.append(gy.ravel())
    x = np.rint(np.concatenate(xs) / 240) * 240 / mt.R_M
    y = np.rint(np.concatenate(ys) / 240) * 240 / mt.R_M
    xy = np.unique(np.c_[x, y], axis=0)
    xy = xy[np.lexsort((xy[:, 1], xy[:, 0]))]
    from pyproj import Transformer
    inv = Transformer.from_crs(mt.LOLA, "+proj=longlat +R=1737400 +no_defs", always_xy=True)
    lon, lat = inv.transform(xy[:, 0] * mt.R_M, xy[:, 1] * mt.R_M)
    head = "        x,         y,        clon,       clat,       tbol\r\n".encode()
    assert len(head) == 59
    lines = [f"{a:9.6f}, {b:9.6f}, {c:11.6f}, {d:10.6f}, {temp_of(c, d):10.6f}\r\n" for a, b, c, d in zip(xy[:, 0], xy[:, 1], lon, lat)]
    assert all(len(s) == 59 for s in lines[:50])
    return head + "".join(lines).encode()


@pytest.fixture
def fake_archive(tmp_path, monkeypatch):
    store = {}
    def make(season, b, temp_of):
        store[mt.FILE.format(season=season, b=b)] = table(temp_of)
    def http_range(url, start, end, tries=5):
        return store[url.rsplit("/", 1)[1][:-4]][start:end + 1]
    def label(name):
        rows = len(store[name]) // 59 - 1
        return {"record_bytes": 59, "rows": rows, "file_records": rows + 1, "sunlon": [0, 3.75]}
    monkeypatch.setattr(mt, "http_range", http_range)
    monkeypatch.setattr(mt, "label", label)
    monkeypatch.setattr(mt, "ROWS_DIR", tmp_path / "rows")
    return make


def test_windows_and_intervals():
    w = mt.windows()
    assert len(w) == 11 and w["shackleton-sheet"]["window"] == "MOON-275-275"
    iv = mt.x_intervals(w)
    assert all(a < b for a, b in iv) and all(iv[i][1] < iv[i + 1][0] for i in range(len(iv) - 1))
    for v in w.values():
        assert any(a <= (v["x"] - 25_000) / mt.R_M and (v["x"] + 25_000) / mt.R_M <= b for a, b in iv)


def test_header_example_matches_lola_plane():
    # first data row of pcp_avg_tbol_pols_sum_slon01_240.tab: x, y normalised = LOLA plane / R
    x, y = mt.lola().transform(-92.080834, -79.997380)
    assert abs(x / mt.R_M - -0.174908) < 2e-6 and abs(y / mt.R_M - -0.006355) < 2e-6


def test_fetch_reads_only_window_rows_and_stats(fake_archive, monkeypatch):
    # summer warm, winter cold; a cold trap at Shackleton's IAU centre
    def warm(lon, lat):
        return 250.0
    def cold(lon, lat):
        return 40.0 if (lat < -89.6 and abs(lon - 129.78) < 40) else 90.0
    monkeypatch.setattr(mt, "BINS", [1, 5])
    for b in mt.BINS:
        fake_archive("sum", b, warm)
        fake_archive("win", b, cold)
    wins, iv = mt.windows(), mt.x_intervals(mt.windows())
    for s in mt.SEASONS:
        for b in mt.BINS:
            r = mt.fetch_one(s, b, wins, iv)
            assert r["status"] == "fetched" and r["rows"] > 0
            assert mt.fetch_one(s, b, wins, iv)["status"] == "cached"
    ps = mt.pixel_stats()
    ranges = mt.window_ranges(ps, wins)
    for k, r in ranges.items():
        assert r["valid_pixels"] > 0, k
        assert r["max_k"] == 250.0
    assert ranges["shackleton"]["coldest_max_k"] == 250.0  # every pixel is warm in summer
    assert ranges["shackleton"]["min_k"] <= 90.0
    # coarse synthetic grid: far below 90 % coverage, so D1 would fail
    assert not ranges["haworth"]["measured"]


def test_overlap_and_band():
    assert mt.overlap([-33.3, 31.1], (-203.0, 54.0)) == pytest.approx(64.4 / 257, abs=1e-6)
    assert mt.band(0.19) == "breaks" and mt.band(0.2) == "partly" and mt.band(0.5) == "holds"


def test_config_constants():
    import yaml
    c = yaml.safe_load(mt.CONFIG.read_text())
    assert "every fourth" in c["amendment_v2_1"]["bins_used"] and mt.BINS == list(range(1, 97, 4)) and len(mt.BINS) == 24
    assert "90 %" in c["values"]["measured"] and mt.VALID_SHARE == 0.9
    assert "110 K" in c["checks"]["D2_cold_trap"] and mt.COLD_TRAP_K == 110
