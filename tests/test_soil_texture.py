"""Soil texture v1: frozen rules on a synthetic SoilGrids-like map (Interrupted Goode Homolosine)."""
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

rasterio = pytest.importorskip("rasterio")
from rasterio.transform import from_origin  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("soil_texture", ROOT / "scripts/soil_texture.py")
st = importlib.util.module_from_spec(spec)
spec.loader.exec_module(st)

IGH = "+proj=igh +lat_0=0 +lon_0=0 +datum=WGS84 +units=m +no_defs"
NODATA = -32768


def write_maps(folder: Path, values: dict, nodata_cols: slice | None = None):
    """A 1000 m grid around Madrid (40.4 N, 3.7 W): constant value per layer, optional nodata band."""
    from pyproj import Transformer
    x, y = Transformer.from_crs("EPSG:4326", IGH, always_xy=True).transform(-3.7, 40.4)
    w = h = 200
    tr = from_origin(x - 100_000, y + 100_000, 1000, 1000)
    for k in st.LAYERS:
        data = np.full((h, w), values[k], dtype="int16")
        if nodata_cols is not None:
            data[:, nodata_cols] = NODATA
        f = folder / st.FILE.format(k)
        with rasterio.open(f, "w", driver="GTiff", width=w, height=h, count=1, dtype="int16", crs=IGH,
                           transform=tr, nodata=NODATA) as dst:
            dst.write(data, 1)
        (folder / (f.name + ".sha256")).write_text(hashlib.sha256(f.read_bytes()).hexdigest() + "  " + f.name + "\n")


def test_points_grid():
    lons, lats = st.window_points(40.4, -3.7)
    assert lons.size == 2500
    west, south, east, north = st.ch.window_bounds_deg(40.4, -3.7)
    assert lons.min() > west and lons.max() < east and lats.min() > south and lats.max() < north
    assert np.isclose(lons.mean(), -3.7) and np.isclose(lats.mean(), 40.4)


@pytest.mark.parametrize("sand,silt,clay,cls", [
    (92, 5, 3, "sand"), (82, 12, 6, "loamy_sand"), (65, 25, 10, "sandy_loam"), (40, 40, 20, "loam"),
    (20, 65, 15, "silt_loam"), (5, 88, 7, "silt"), (60, 15, 25, "sandy_clay_loam"), (30, 32, 38, "clay_loam"),
    (10, 60, 30, "silty_clay_loam"), (50, 5, 45, "sandy_clay"), (5, 50, 45, "silty_clay"), (28, 30, 42, "clay"),
    (50, 45, 5, "sandy_loam"), (53, 32, 15, "sandy_loam"),
])
def test_usda(sand, silt, clay, cls):
    assert st.usda_class(sand * 10, silt * 10, clay * 10) == cls  # g/kg in, rescaled inside


def test_summarize_threshold_and_units():
    n = 2500
    full = {"sand": np.full(n, 600.0), "silt": np.full(n, 300.0), "clay": np.full(n, 100.0), "cfvo": np.full(n, 150.0)}
    v = st.summarize(full)
    assert v["status"] == "measured" and v["sand"] == 0.6 and v["coarse"] == 0.15 and v["sum_gkg"] == 1000
    assert v["texture_class"] == "sandy_loam" and v["valid_share"] == 1
    few = {k: a.copy() for k, a in full.items()}
    few["clay"][: int(n * 0.76)] = np.nan  # one layer missing counts: 24 % valid
    v = st.summarize(few)
    assert v == {"status": "not_measured", "valid_share": 0.24}


def test_maps_read_and_checks(tmp_path):
    write_maps(tmp_path, {"sand": 700, "silt": 200, "clay": 100, "cfvo": 50})
    files = st.verify_files(tmp_path)
    assert set(files) == set(st.LAYERS)
    maps = st.Maps(tmp_path)
    v = maps.window(40.4, -3.7)
    assert v["status"] == "measured" and v["valid_share"] == 1 and v["sand"] == 0.7 and v["coarse"] == 0.05
    s1 = st.check_s1(maps, [{"id": "W", "lat": 40.4, "lon": -3.7}])
    assert s1["pass"] and s1["rows"][0]["max_roundtrip_m"] < 1e-3


def test_masked_half_and_outside(tmp_path):
    write_maps(tmp_path, {"sand": 700, "silt": 200, "clay": 100, "cfvo": 50}, nodata_cols=slice(0, 100))
    maps = st.Maps(tmp_path)
    v = maps.window(40.4, -3.7)
    assert v["status"] == "measured" and 0.45 < v["valid_share"] < 0.55
    far = maps.window(-30.0, 120.0)  # off the synthetic map: no data, never estimated
    assert far == {"status": "not_measured", "valid_share": 0.0}


def test_bad_checksum_stops(tmp_path):
    write_maps(tmp_path, {"sand": 700, "silt": 200, "clay": 100, "cfvo": 50})
    (tmp_path / (st.FILE.format("clay") + ".sha256")).write_text("0" * 64 + "  x\n")
    with pytest.raises(SystemExit):
        st.verify_files(tmp_path)


def test_predictions():
    rows = [{"id": "a", "bare": 0.9, "status": "measured", "valid_share": 0.3, "sand": 0.8},
            {"id": "b", "bare": 0.1, "status": "measured", "valid_share": 1.0, "sand": 0.3},
            {"id": "c", "bare": 0.6, "status": "not_measured", "valid_share": 0.1},
            {"id": "d", "bare": 0.0, "status": "measured", "valid_share": 0.9, "sand": 0.4},
            {"id": "e", "bare": None, "status": "measured", "valid_share": 0.9, "sand": 0.4}]
    p = st.predictions(rows)
    assert p["P1_bare_windows_have_less_soil_data"]["holds"]
    assert p["P2_most_windows_measured"]["measured_share"] == 0.8 and p["P2_most_windows_measured"]["holds"]
    assert p["P3_bare_windows_are_sandier"]["holds"]
    json.dumps(p)


def test_config_matches_constants():
    import yaml
    c = yaml.safe_load(st.CONFIG.read_text())
    assert "0.25" in c["values"]["not_measured"] and st.MIN_VALID == 0.25
    assert "50 x 50" in c["sampling"]["points"] and st.N == 50
    assert set(c["source"]["files"]) == set(st.LAYERS)
    assert all(st.FILE.format(k) in u for k, u in c["source"]["files"].items())
