"""VAL-004 reverse map: measurement, distances, thresholds, readers and the twins/web export.

Everything runs on synthetic rasters and tables; no planetary or Earth data needed.
"""
import csv
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
import pytest
import yaml

from parallax import reverse as rv
from parallax.data import srtmgl30
from parallax.matching.similarity import jensen_shannon_distance

ROOT = Path(__file__).parents[1]


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"scripts/{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def plane(slope_deg, rows, cols, res, axis=1):
    x = np.arange(cols if axis == 1 else rows) * res * math.tan(math.radians(slope_deg))
    return np.tile(x, (rows, 1)) + 500.0 if axis == 1 else np.tile(x[:, None], (1, cols)) + 500.0


# ----------------------------------------------------------------------------- measurement


def test_histogram_matches_the_earth_evaluator_bin_for_bin():
    ev = load_script("evaluate_candidate")
    rng = np.random.default_rng(4)
    slope = rng.uniform(0, 35, size=(50, 50))
    slope[[0, 3, 9], [1, 4, 7]] = [1.0, 5.0, 20.0]  # exact edges go to the upper class
    valid = np.zeros_like(slope, dtype=bool)
    valid[1:-1, 1:-1] = True
    np.testing.assert_allclose(rv.histogram(slope[1:-1, 1:-1].ravel()), ev.slope_histogram(slope, valid_mask=valid), atol=0)
    assert rv.histogram(np.array([0.0, 0.999, 1.0, 19.99, 20.0, 89.0])).tolist() == pytest.approx([2 / 6, 1 / 6, 0, 0, 0, 0, 1 / 6, 2 / 6])


def test_uniform_plane_lands_in_one_class_and_incomplete_windows_are_refused():
    h = rv.window_histogram(plane(7.0, 50, 50, 1000.0))
    assert h[rv.BIN_LABELS.index("5-10")] == pytest.approx(1.0)
    bad = plane(7.0, 50, 50, 1000.0)
    bad[10, 10] = np.nan
    with pytest.raises(ValueError):
        rv.window_histogram(bad)


def test_sliding_windows_skip_gaps_and_measure_each_window_on_its_own():
    grid = np.hstack([plane(2.5, 100, 75, 1000.0), plane(12.0, 100, 75, 1000.0) + 10_000])
    grid[0:30, 0:30] = np.nan
    out = list(rv.sliding_windows(grid))
    starts = {(r, c) for r, c, _ in out}
    assert (0, 0) not in starts and (0, 25) not in starts and (25, 25) not in starts
    assert (50, 0) in starts and (0, 100) in starts
    for r, c, h in out:
        np.testing.assert_allclose(h, rv.window_histogram(grid[r : r + 50, c : c + 50]))
    assert dict(((r, c), h) for r, c, h in out)[(50, 100)][rv.BIN_LABELS.index("10-15")] == pytest.approx(1.0)


def test_block_mean_voids_blocks_with_missing_pixels():
    data = np.arange(16, dtype=float).reshape(4, 4)
    data[0, 0] = np.nan
    out = rv.block_mean(data, 2)
    assert np.isnan(out[0, 0]) and out[1, 1] == pytest.approx(np.mean([10, 11, 14, 15]))


def test_earth_centres_reuse_the_exp001b_grid_rule():
    ours = rv.sphere_centres(rv.EARTH_RADIUS_M, 50_000.0, srtmgl30.SRTM_SOUTH_LIMIT_DEG, srtmgl30.SRTM_NORTH_LIMIT_DEG)
    lats = srtmgl30.candidate_latitudes(stride_m=50_000.0)
    theirs = [(float(la), float(lo)) for la in lats for lo in srtmgl30.candidate_longitudes(float(la), stride_m=50_000.0)]
    assert len(ours) == len(theirs)
    np.testing.assert_allclose(np.array(ours), np.array(theirs), atol=1e-9)


# ----------------------------------------------------------------------------- distances


def test_jsd_matrix_matches_the_frozen_scalar_distance():
    rng = np.random.default_rng(1)
    p = rng.dirichlet(np.ones(8), size=6)
    p[0] = [1, 0, 0, 0, 0, 0, 0, 0]
    q = rng.dirichlet(np.ones(8), size=5)
    q[1] = [0, 0, 0, 0, 0, 0, 0, 1]
    m = rv.jsd_matrix(p, q)
    for i in range(6):
        for j in range(5):
            assert m[i, j] == pytest.approx(jensen_shannon_distance(p[i], q[j]), abs=1e-12)
    assert rv.jsd_matrix(p[0], q[1])[0, 0] == pytest.approx(1.0)


def test_nearest_is_exact_and_breaks_ties_by_lowest_index():
    rng = np.random.default_rng(7)
    p = rng.dirichlet(np.ones(8) * 0.6, size=300)
    q = rng.dirichlet(np.ones(8) * 0.6, size=500)
    q[42] = q[17]  # exact duplicate: index 17 must win wherever it is closest
    idx, d = rv.nearest(p, q, chunk=64)
    full = rv.jsd_matrix(p, q)
    np.testing.assert_allclose(d, full.min(axis=1), atol=1e-12)
    np.testing.assert_array_equal(idx, full.argmin(axis=1))
    assert 42 not in set(idx.tolist())


# ----------------------------------------------------------------------------- thresholds and classes


def test_thresholds_recompute_from_validation_files_and_match_the_freeze():
    config = yaml.safe_load((ROOT / "config/validation/val004_reverse_map_v1.yaml").read_text())
    pairs = rv.validated_pairs([ROOT / p for p in config["thresholds"]["source"]])
    assert len(pairs) == 18
    assert ("mauna-kea", "moon", pytest.approx(0.3506, abs=1e-4)) in [(s, b, d) for s, b, d in pairs]
    assert len({(s, b) for s, b, _ in pairs}) == 18, "sites listed in both VAL-001 and VAL-002 count once"
    t = rv.frozen_thresholds(config, ROOT)
    assert (t.q25, t.q50, t.q90) == (0.29885, 0.47345, 0.84956)


def test_tampered_thresholds_stop_the_run():
    config = yaml.safe_load((ROOT / "config/validation/val004_reverse_map_v1.yaml").read_text())
    config["thresholds"]["q90"] = 0.95
    with pytest.raises(RuntimeError, match="q90"):
        rv.frozen_thresholds(config, ROOT)


def test_class_boundaries_are_inclusive_on_the_twin_side():
    t = rv.Thresholds(0.3, 0.5, 0.8)
    assert [t.classify(x) for x in (0.0, 0.3, 0.30001, 0.5, 0.8, 0.80001, 1.0)] == ["strong_twin", "strong_twin", "twin", "twin", "partial", "no_twin", "no_twin"]
    with pytest.raises(ValueError):
        t.classify(float("nan"))
    assert rv.class_shares(["twin", "twin", "no_twin", "partial"]) == {"strong_twin": 0, "twin": 0.5, "partial": 0.25, "no_twin": 0.25}


def test_nearest_centre_handles_the_antimeridian():
    centres = np.array([[0.0, 179.9], [0.0, 0.0]])
    i, km = rv.nearest_centre(0.0, -179.9, centres)
    assert i == 0 and km == pytest.approx(22.2, abs=0.2)


# ----------------------------------------------------------------------------- readers (synthetic rasters)

rasterio = pytest.importorskip("rasterio")
from rasterio.transform import from_origin  # noqa: E402

MOON_PS = "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
MARS_EQC = "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs"


def write_tif(path, data, transform, crs, nodata=None, dtype="float32"):
    with rasterio.open(path, "w", driver="GTiff", height=data.shape[0], width=data.shape[1], count=1, dtype=dtype, crs=crs, transform=transform, nodata=nodata) as dst:
        dst.write(data.astype(dtype), 1)


@pytest.fixture
def moon_dem(tmp_path):
    """A 120 km polar-stereographic patch centred on the pole at 20 m: west half 2.5°, east half 25°."""
    res, n = 20.0, 6000
    west = plane(2.5, n, n // 2, res)
    east = plane(25.0, n, n // 2, res) + west[:, -1:] + 1.0
    data = np.hstack([west, east])
    data[:100, :100] = -9999  # a missing corner voids its 1 km cells
    path = tmp_path / "moon.tif"
    write_tif(path, data, from_origin(-60_000, 60_000, res, res), MOON_PS, nodata=-9999)
    return path


def test_plane_grid_block_means_and_locates_windows(moon_dem):
    from parallax.reverse.readers import plane_grid_1km

    g = plane_grid_1km(str(moon_dem))
    assert g.elevation.shape == (120, 120)
    assert np.isnan(g.elevation[0:2, 0:2]).all() and np.isfinite(g.elevation[2:, :]).all() and np.isfinite(g.elevation[:, 2:]).all()
    windows = list(rv.sliding_windows(g.elevation))
    starts = {(r, c) for r, c, _ in windows}
    assert (0, 0) not in starts and starts == {(r, c) for r in (0, 25, 50) for c in (0, 25, 50)} - {(0, 0)}
    h = dict(((r, c), h) for r, c, h in windows)
    assert h[(25, 0)][rv.BIN_LABELS.index("2-3")] == pytest.approx(1.0)
    assert h[(50, 50)][rv.BIN_LABELS.index(">=20")] > 0.7 and h[(50, 50)][rv.BIN_LABELS.index("2-3")] > 0.1
    x, y = g.centre_xy(35, 35)
    assert (x, y) == (0.0, 0.0)
    lon, lat = g.to_lonlat(np.array([x]), np.array([y]))
    assert lat[0] == pytest.approx(-90.0)
    x2, y2 = g.to_xy(0.0, -89.0)
    assert math.hypot(x2, y2) == pytest.approx(1_737_400 * math.radians(1), rel=1e-3)


@pytest.fixture
def mars_dem(tmp_path):
    """MOLA-like 463 m simple-cylindrical patch around Jezero, tilted 4° to the north."""
    res = 463.0835744
    left, top = math.radians(70) * 3396190, math.radians(26) * 3396190
    cols, rows = int(math.radians(15) * 3396190 / res), int(math.radians(16) * 3396190 / res)
    y = top - (np.arange(rows) + 0.5) * res
    data = np.tile((y * math.tan(math.radians(4.0)))[:, None], (1, cols)) - 2000
    path = tmp_path / "mars.tif"
    write_tif(path, data, from_origin(left, top, res, res), MARS_EQC, nodata=-32768)
    return path


def test_mars_windows_use_the_earth_method_and_refuse_incomplete_coverage(mars_dem):
    from parallax.reverse.readers import MarsDEM

    with MarsDEM(str(mars_dem)) as m:
        w = m.window(18.44463, 77.45088)
        assert w.shape == (50, 50) and np.isfinite(w).all()
        h = m.histogram(18.44463, 77.45088)
        assert h[rv.BIN_LABELS.index("3-5")] == pytest.approx(1.0)
        with pytest.raises(ValueError):
            m.histogram(10.1, 77.0)  # half the window falls off the raster


# ----------------------------------------------------------------------------- twins stage, end to end


def write_rows(path, rows, columns):
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=columns)
        w.writeheader()
        w.writerows(rows)


def h(*values):
    v = np.array(values, dtype=float)
    return dict(zip(rv.BIN_LABELS, (v / v.sum()).tolist()))


@pytest.fixture
def run(tmp_path, monkeypatch):
    mod = load_script("run_val004")
    out = tmp_path / "results/val004"
    out.mkdir(parents=True)
    for name, value in {
        "OUT": out, "CACHE": out / "cache", "LOG": out / "run.log", "VALIDATION": tmp_path / "results/validation/val004_reverse_map",
        "WEB": tmp_path / "web/public/reverse", "EARTH_CSV": out / "earth_windows.csv", "MOON_CSV": out / "moon_windows.csv",
        "MARS_CSV": out / "mars_windows.csv", "BRIDGES": out / "bridges.json",
    }.items():
        monkeypatch.setattr(mod, name, value)
    flat, rough, steep = h(6, 3, 1, 0, 0, 0, 0, 0), h(0, 1, 1, 3, 3, 0, 0, 0), h(0, 0, 0, 0, 0, 0, 0, 1)
    earth = [
        {"id": "EARTH-000001", "lat": 39.5, "lon": -0.5, "land_fraction": 0.62, "land_status": "REJECTED", **flat},  # Valencia coast: display only
        {"id": "EARTH-000002", "lat": -24.1, "lon": -69.9, "land_fraction": 1.0, "land_status": "ELIGIBLE", **flat},
        {"id": "EARTH-000003", "lat": 36.2, "lon": -112.1, "land_fraction": 0.99, "land_status": "ELIGIBLE", **rough},
        {"id": "EARTH-000004", "lat": 10.0, "lon": 20.0, "land_fraction": 0.3, "land_status": "REJECTED", **steep},  # never used
    ]
    write_rows(out / "earth_windows.csv", earth, ["id", "lat", "lon", "land_fraction", "land_status", *rv.BIN_LABELS])
    moon = [
        {"id": "MOON-000-000", "lat": -89.7, "lon": 130.0, "x": 0, "y": 0, "r0": 0, "c0": 0, **steep},
        {"id": "MOON-000-025", "lat": -87.0, "lon": 10.0, "x": 0, "y": 0, "r0": 0, "c0": 25, **rough},
    ]
    write_rows(out / "moon_windows.csv", moon, ["id", "lat", "lon", "x", "y", "r0", "c0", *rv.BIN_LABELS])
    mars = [
        {"id": "MARS-000001", "lat": 18.4, "lon": 77.5, **flat},
        {"id": "MARS-000002", "lat": -4.6, "lon": 137.4, **steep},
    ]
    write_rows(out / "mars_windows.csv", mars, ["id", "lat", "lon", *rv.BIN_LABELS])
    (out / "bridges.json").write_text(json.dumps({"moon": {"passed": True, "best": 0.05}, "mars": {"passed": False, "distance_to_frozen": 0.2}}))
    return mod


def test_twins_stage_classifies_reports_and_exports(run, tmp_path):
    result = run.stage_twins()
    assert result["earth"] == {"evaluated": 4, "eligible": 2, "display": 3}
    mars = result["bodies"]["mars"]
    assert mars["shares"]["strong_twin"] == 0.5 and mars["shares"]["no_twin"] == 0.5
    assert mars["status"].startswith("exploratory"), "a failed bridge test is never presented as a result"
    assert result["bodies"]["moon"]["status"] == "result"
    # the steep window has no eligible twin: the 30 %-land steep Earth window must not count
    rows = {r["id"]: r for r in csv.DictReader((tmp_path / "results/val004/mars_twins.csv").open())}
    assert rows["MARS-000002"]["class"] == "no_twin" and rows["MARS-000002"]["earth_id"] != "EARTH-000004"
    assert rows["MARS-000001"]["earth_id"] == "EARTH-000002", "display-only windows never serve as twins"
    art = {o["id"]: o for o in result["overlays"]["artemis_iii"]}
    assert all(o["status"] == "not_evaluated" for o in art.values()), "pending Artemis coordinates are never filled in"
    assert {o["id"]: o["status"] for o in result["overlays"]["mars_sites"]}["curiosity"] == "evaluated"
    assert result["predictions"]["P3"]["class"] in ("partial", "no_twin")
    assert result["valencia"]["earth_window"] == "EARTH-000001" and result["valencia"]["mars"]["window"] == "MARS-000001"
    web = tmp_path / "web/public/reverse"
    summary = json.loads((web / "summary.json").read_text())
    assert summary["validatedPairs"] == sorted(summary["validatedPairs"]) and len(summary["validatedPairs"]) == 18
    tile = json.loads((web / "earth" / "30_-10.json").read_text())
    assert tile["lat"] == [39.5] and tile["marsI"] == [0] and len(tile["moonD"]) == 1
    marsw = json.loads((web / "mars-windows.json").read_text())
    assert set(marsw) == {"0"} and marsw["0"]["e_place"][2] == "CL"


def test_images_render_maps_and_thumbnails(run, tmp_path, moon_dem, mars_dem, monkeypatch):
    from parallax.reverse.readers import plane_grid_1km

    g = plane_grid_1km(str(moon_dem))
    cache = tmp_path / "results/val004/cache"
    cache.mkdir(parents=True, exist_ok=True)
    np.save(cache / "moon_grid_1km.npy", g.elevation)
    (cache / "moon_grid_1km.json").write_text(json.dumps({"left": g.left, "top": g.top, "crs_wkt": g.crs_wkt, "native_resolution_m": 20.0}))
    monkeypatch.setattr(run, "MOON_GRID", cache / "moon_grid_1km.npy")
    monkeypatch.setattr(run, "MOON_GRID_META", cache / "moon_grid_1km.json")
    run.stage_twins()
    run.stage_images(str(moon_dem), str(mars_dem))
    web = tmp_path / "web/public/reverse"
    from PIL import Image

    assert Image.open(web / "moon-map.png").size == (120, 120)
    assert Image.open(web / "mars-map.png").size == (1440, 720)
    assert Image.open(web / "thumbs/mars/MARS-000001.jpg").size == (250, 250)
    assert any((web / "thumbs/moon").glob("MOON-*.jpg"))
    assert set(json.loads((web / "summary.json").read_text())["maps"]) == {"moon", "mars"}


# ----------------------------------------------------------------------------- amendment v1.1: Moon bridge test


def test_window_origin_near_centres_within_one_cell_and_stays_inside():
    assert rv.window_origin_near(60.0, 60.0, (120, 120)) == (35, 35)
    r0, c0 = rv.window_origin_near(61.4, 58.6, (120, 120))
    assert abs(c0 + 25 - 61.4) <= 0.5 and abs(r0 + 25 - 58.6) <= 0.5
    assert rv.window_origin_near(3.0, 118.0, (120, 120)) == (70, 0)
    with pytest.raises(ValueError):
        rv.window_origin_near(10, 10, (40, 120))


def test_v1_0_radius_cannot_reach_shackleton_on_the_25_km_moon_grid():
    """Documents the design error the amendment fixes: nearest map-window centre is 15.6 km away."""
    from pyproj import CRS, Transformer

    crs = CRS.from_proj4(MOON_PS)
    x, y = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True).transform(129.78, -89.67)
    left = top = 304_000.0
    xs = [-left + (k + 25) * 1000 for k in range(0, 608 - 49, 25)]
    ys = [top - (k + 25) * 1000 for k in range(0, 608 - 49, 25)]
    nearest = min(math.hypot(x - a, y - b) for a in xs for b in ys) / 1000
    assert nearest > 12.5 and nearest == pytest.approx(15.6, abs=0.1)


def test_moon_bridge_v1_1_keeps_the_v1_0_outcome_and_uses_the_amended_window(run, tmp_path, moon_dem, monkeypatch):
    from parallax.reverse.readers import plane_grid_1km

    g = plane_grid_1km(str(moon_dem))
    # a frozen target equal to the grid window at the pole must pass at distance 0
    r0, c0 = rv.window_origin_near(60.0, 60.0, g.elevation.shape)
    h = rv.window_histogram(g.elevation[r0 : r0 + 50, c0 : c0 + 50])
    target = tmp_path / "pole_target.json"
    target.write_text(json.dumps({"target": {"center_lat_deg": -90.0, "center_lon_deg": 0.0},
                                  "terrain": {"1000m": {"slope": {"distribution_pct": dict(zip(rv.BIN_LABELS, (h * 100).tolist()))}}}}))
    monkeypatch.setattr(run, "SHACKLETON", target)
    run.BRIDGES.write_text(json.dumps({"moon": {"windows": [], "best": None, "passed": False}, "mars": {"passed": True}}))
    result = run.moon_bridge_v1_1(g)
    assert result["passed"] and result["distance_to_frozen"] == pytest.approx(0.0, abs=1e-9)
    assert result["window"]["centre_offset_km"] < 0.71
    assert result["v1_0"]["best"] is None, "the v1.0 outcome is kept, never overwritten"
    saved = json.loads(run.BRIDGES.read_text())
    assert saved["moon"]["amendment"].endswith("val004_amendment_v1_1.yaml") and saved["mars"] == {"passed": True}
    again = run.moon_bridge_v1_1(g)  # re-running never loses the v1.0 record
    assert again["v1_0"]["best"] is None


def test_amendment_changes_only_the_moon_bridge():
    a = yaml.safe_load((ROOT / "config/validation/val004_amendment_v1_1.yaml").read_text())
    v1 = yaml.safe_load((ROOT / "config/validation/val004_reverse_map_v1.yaml").read_text())
    assert a["bridge_tests"]["tolerance"] == v1["bridge_tests"]["tolerance"] == 0.15
    assert set(a["bridge_tests"]) == {"moon", "tolerance", "on_failure"}
