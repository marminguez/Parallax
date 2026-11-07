"""Twin characterization v1: pure functions and readers on synthetic data."""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pytest

from parallax import characterize as ch


def plane(slope_deg: float, n: int = 60, res: float = ch.FINE_GRID_M) -> np.ndarray:
    x = np.arange(n) * res
    return np.tile(x * math.tan(math.radians(slope_deg)), (n, 1))


# --------------------------------------------------------------------------- fine relief


def test_flat_window_is_all_gentle():
    fp = ch.fine_fingerprint(np.zeros((40, 40)))
    assert fp["histogram"][0] == pytest.approx(1.0)
    assert fp["steep_share"] == 0.0
    assert fp["valid_share"] == 1.0


def test_steep_plane_counts_as_rover_limit():
    fp = ch.fine_fingerprint(plane(25.0))
    assert fp["histogram"][-1] == pytest.approx(1.0)
    assert fp["steep_share"] == 1.0


def test_gaps_reduce_valid_share_and_never_count():
    dem = plane(12.0)
    dem[:30] = np.nan
    fp = ch.fine_fingerprint(dem)
    assert 0.4 < fp["valid_share"] < 0.55
    assert fp["histogram"][5] == pytest.approx(1.0)  # 10-15 degrees


def test_empty_window_reports_no_histogram():
    fp = ch.fine_fingerprint(np.full((10, 10), np.nan))
    assert fp == {"valid_share": 0.0, "histogram": None, "steep_share": None}


def test_identical_fingerprints_hold_and_opposites_break():
    a = ch.fine_fingerprint(plane(4.0))
    b = ch.fine_fingerprint(plane(25.0))
    same = ch.fine_relief(a, a)
    assert same["status"] == "measured" and same["distance"] == 0.0 and same["verdict"] == "holds"
    diff = ch.fine_relief(a, b)
    assert diff["distance"] == pytest.approx(1.0) and diff["verdict"] == "breaks"


def test_fine_bands_are_the_frozen_ones():
    assert ch.fine_verdict(0.10) == "holds"
    assert ch.fine_verdict(0.1001) == "partly"
    assert ch.fine_verdict(0.30) == "partly"
    assert ch.fine_verdict(0.3001) == "breaks"


def test_side_below_valid_floor_is_not_measured():
    good = ch.fine_fingerprint(plane(4.0))
    holey = dict(good, valid_share=0.5)
    out = ch.fine_relief(good, holey)
    assert out["status"] == "not_measured" and out["reason"] == "planet"
    assert "distance" not in out
    assert ch.fine_relief(None, good)["reason"] == "earth"


# --------------------------------------------------------------------------- temperature


def test_overlap_share():
    assert ch.overlap_share((-20, 30), (-203, 54)) == pytest.approx(50 / 257)
    assert ch.overlap_share((0, 40), (-83, -13)) == 0.0
    assert ch.overlap_share((-100, 10), (-83, -13)) == 1.0
    with pytest.raises(ValueError):
        ch.overlap_share((0, 1), (5, 5))


def test_temperature_verdicts_and_cold_gap():
    moon = ch.temperature((-20.0, 30.0), "moon")
    assert moon["verdict"] == "breaks" and moon["planet_colder_by_c"] == pytest.approx(183.0)
    mars = ch.temperature((-50.0, 20.0), "mars")
    assert mars["overlap"] == pytest.approx(37 / 70, abs=1e-3) and mars["verdict"] == "holds"
    assert ch.temperature_verdict(0.2) == "partly" and ch.temperature_verdict(0.1999) == "breaks"


def power_payload(tmin: list[float], tmax: list[float], extra: dict | None = None) -> dict:
    months = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
    p = {"TS_MIN": dict(zip(months, tmin)), "TS_MAX": dict(zip(months, tmax))}
    for v in p.values():
        v["ANN"] = 0.0
    return {"header": {"fill_value": -999.0}, "properties": {"parameter": {**p, **(extra or {})}}}


def test_power_extremes_ignore_annual_and_need_twelve_months():
    tmin = [-25, -22, -15, -5, 0, 5, 8, 7, 2, -5, -15, -22]
    tmax = [5, 8, 15, 22, 28, 34, 36, 35, 28, 20, 12, 6]
    assert ch.power_extremes(power_payload(tmin, tmax)) == (-25, 36)
    tmin[3] = -999.0
    with pytest.raises(ValueError):
        ch.power_extremes(power_payload(tmin, tmax))
    with pytest.raises(KeyError):
        ch.power_extremes({"properties": {"parameter": {}}})


# --------------------------------------------------------------------------- operations


def test_operations_bands_and_empty():
    assert ch.operations(np.array([0.1, 0.5, np.nan]), 40.0)["verdict"] == "remote"
    assert ch.operations(np.array([3.0, 10.0]), 12.0)["verdict"] == "rural"
    out = ch.operations(np.array([30.0, 500.0]), 2.0)
    assert out["verdict"] == "populated" and out["population_max_km2"] == 500.0
    assert ch.operations(np.array([np.nan, -3.4e38]), 5.0)["status"] == "not_measured"


def test_copernicus_tile_names():
    assert ch.copernicus_tile_names(74.4, 36.6, 74.9, 37.1) == [
        "Copernicus_DSM_COG_10_N36_00_E074_00_DEM", "Copernicus_DSM_COG_10_N37_00_E074_00_DEM"]
    assert ch.copernicus_tile_names(-69.2, -31.2, -68.8, -30.8) == [
        "Copernicus_DSM_COG_10_S32_00_W070_00_DEM", "Copernicus_DSM_COG_10_S32_00_W069_00_DEM",
        "Copernicus_DSM_COG_10_S31_00_W070_00_DEM", "Copernicus_DSM_COG_10_S31_00_W069_00_DEM"]
    assert ch.copernicus_tile_names(179.8, 10.1, 180.2, 10.4) == [
        "Copernicus_DSM_COG_10_N10_00_E179_00_DEM", "Copernicus_DSM_COG_10_N10_00_W180_00_DEM"]


def test_window_bounds_widen_with_latitude():
    w, s, e, n = ch.window_bounds_deg(0.0, 10.0)
    assert n - s == pytest.approx(50 / 111.32) and e - w == pytest.approx(50 / 111.32)
    w2, _, e2, _ = ch.window_bounds_deg(60.0, 10.0)
    assert e2 - w2 == pytest.approx(2 * (e - w), rel=1e-6)


# --------------------------------------------------------------------------- readers (synthetic rasters)

rasterio = pytest.importorskip("rasterio")


def write_tif(path: Path, data: np.ndarray, transform, crs: str, nodata=None) -> None:
    with rasterio.open(path, "w", driver="GTiff", width=data.shape[1], height=data.shape[0], count=1,
                       dtype="float32", crs=crs, transform=transform, nodata=nodata) as dst:
        dst.write(data.astype("float32"), 1)


def test_moon_window_block_means_a_projected_plane(tmp_path):
    from rasterio.transform import from_origin

    from parallax.characterize import sources

    n = 2600
    data = (np.arange(n)[None, :] * 20.0 * math.tan(math.radians(7.0))).repeat(n, 0)
    crs = "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +R=1737400 +units=m +no_defs"
    path = tmp_path / "moon.tif"
    write_tif(path, data, from_origin(-26000, 26000, 20, 20), crs)
    grid = sources.moon_fine_window(str(path), 0.0, 0.0)
    assert grid.shape == (ch.FINE_CELLS, ch.FINE_CELLS)
    fp = ch.fine_fingerprint(grid)
    assert fp["valid_share"] == 1.0 and fp["histogram"][4] == pytest.approx(1.0)  # 5-10 degrees


def test_earth_window_reads_named_tiles_and_leaves_ocean_empty(tmp_path):
    from rasterio.transform import from_origin

    from parallax.characterize import sources

    name = "Copernicus_DSM_COG_10_N36_00_E074_00_DEM"
    res = 1 / 2400  # 1.5 arc-seconds: finer than 60 m, like the real 1 arc-second tiles, but a smaller fixture
    yy = np.arange(2400)[:, None].repeat(2400, 1)
    data = yy * (111_320 * res) * math.tan(math.radians(6.0))  # north-south ramp, about 6 degrees
    write_tif(tmp_path / f"{name}.tif", data, from_origin(74.0, 37.0, res, res), "EPSG:4326", nodata=-32767)
    grid = sources.earth_fine_window(36.5, 74.5, str(tmp_path))
    assert grid.shape == (ch.FINE_CELLS, ch.FINE_CELLS)
    assert np.isfinite(grid).mean() > 0.99
    fp = ch.fine_fingerprint(grid)
    assert fp["histogram"][4] > 0.9
    edge = sources.earth_fine_window(36.95, 74.5, str(tmp_path))  # half the window falls on a missing tile
    assert 0.3 < np.isfinite(edge).mean() < 0.7


def test_population_cells_inside_window(tmp_path):
    from rasterio.transform import from_origin

    from parallax.characterize import sources

    res = 2.5 / 60
    data = np.full((120, 120), 2.0)
    data[60:, :] = 40.0
    write_tif(tmp_path / "gpw.tif", data, from_origin(70.0, 40.0, res, res), "EPSG:4326", nodata=-3.4e38)
    vals = sources.population_densities(str(tmp_path / "gpw.tif"), 37.5, 72.5)
    assert 120 < vals.size < 170  # about 10.8 x 13.6 cells of 2.5 arc-minutes at 37.5 N
    assert set(np.unique(vals)) <= {2.0, 40.0}


# --------------------------------------------------------------------------- ice (characterization v1.1)


def test_ice_sides_and_frozen_signals():
    assert ch.moon_ice(np.array([0, 0, 1] + [0] * 97))["signal"] is True  # 1 % in shadow
    assert ch.moon_ice(np.zeros(200))["signal"] is False
    assert ch.moon_ice(np.array([np.nan, 255.0]))["status"] == "not_measured"
    m = ch.mars_ice(np.array([0.4, 0.2, -0.5, -30.0]))
    assert m["swim_positive_share"] == pytest.approx(2 / 3, abs=1e-4) and m["signal"] is True
    assert ch.mars_ice(np.array([-30.0, np.nan]))["status"] == "not_measured"
    e = ch.earth_ice(np.array([0.9, 0.6, 0.1, 0.0]))
    assert e["pzi_share"] == 0.5 and e["signal"] is True
    assert ch.earth_ice(np.array([np.nan, -9999.0]))["signal"] is False
    with pytest.raises(ValueError):
        ch.earth_ice(np.array([45.0, 80.0]))  # a 0-100 scale would silently read as "no permafrost"


def test_ice_verdicts():
    yes, no = {"status": "measured", "signal": True}, {"status": "measured", "signal": False}
    assert ch.ice(yes, yes)["verdict"] == "holds"
    assert ch.ice(yes, no)["verdict"] == "breaks"
    assert ch.ice(no, no)["verdict"] == "none"
    assert ch.ice(no, yes)["verdict"] == "earth_only"
    missing = ch.ice({"status": "not_measured", "reason": "outside SWIM coverage (60 S to 60 N)"}, yes)
    assert missing["status"] == "not_measured" and "SWIM" in missing["reason"]


def test_box_values_geographic_and_0_360(tmp_path):
    from rasterio.transform import from_origin

    from parallax.characterize import sources

    data = np.zeros((180, 360))
    data[:, 300:] = 1.0  # 300-360 E, i.e. -60..0 W
    write_tif(tmp_path / "g360.tif", data, from_origin(0.0, 90.0, 1.0, 1.0), "EPSG:4326")
    vals = sources.box_values(str(tmp_path / "g360.tif"), -33.5, 10.0, -31.5, 12.0)
    assert vals.size == 4 and set(vals) == {1.0}


def test_box_values_mars_simple_cylindrical_metres(tmp_path):
    from rasterio.transform import from_origin

    from parallax.characterize import sources

    R = 3_396_190.0
    deg = math.pi * R / 180
    res = 3000.0
    cols, rows = int(360 * deg / res), int(120 * deg / res)
    data = np.full((rows, cols), -0.5)
    x327 = int(327 * deg / res)
    data[:, x327 - 40: x327 + 40] = 0.7  # a band around 327 E (33 W)
    crs = f"+proj=eqc +lat_ts=0 +lon_0=180 +x_0={180 * deg} +R={R} +units=m +no_defs"
    write_tif(tmp_path / "swim.tif", data.astype("float32"), from_origin(0.0, 60 * deg, res, res), crs, nodata=-30)
    vals = sources.box_values(str(tmp_path / "swim.tif"), *sources.mars_box(19.1, -33.0))
    assert vals.size > 100
    assert ch.mars_ice(vals)["swim_positive_share"] > 0.9


def test_moon_psr_values_in_polar_plane(tmp_path):
    from rasterio.transform import from_origin

    from parallax.characterize import sources

    data = np.zeros((1000, 1000))
    data[400:600, 400:600] = 1.0  # a 24 km shadowed crater floor at the pole: 40,000 of about 174,000 cells
    crs = "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +R=1737400 +units=m +no_defs"
    write_tif(tmp_path / "lpsr.tif", data, from_origin(-60000, 60000, 120, 120), crs)
    vals = sources.moon_psr_values(str(tmp_path / "lpsr.tif"), -90.0, 0.0)
    out = ch.moon_ice(vals)
    assert out["status"] == "measured" and 0.21 < out["psr_share"] < 0.25 and out["signal"] is True


def test_box_values_reads_esri_flt_with_its_hdr_sidecar(tmp_path):
    """The global permafrost map is an ESRI .flt + .hdr pair; the sidecar must be found."""
    from parallax.characterize import sources

    nrows, ncols, cell = 120, 120, 0.01  # about 1 km cells, like the real 30 arc-second map
    data = np.zeros((nrows, ncols), dtype="<f4")
    data[:, :] = 0.8
    (tmp_path / "PZI.flt").write_bytes(data.tobytes())
    (tmp_path / "PZI.hdr").write_text(
        f"ncols {ncols}\nnrows {nrows}\nxllcorner 74\nyllcorner 36\ncellsize {cell}\nNODATA_value -9999\nbyteorder LSBFIRST\n")
    vals = sources.box_values(str(tmp_path / "PZI.flt"), *ch.window_bounds_deg(36.8, 74.7))
    assert vals.size > 0 and ch.earth_ice(vals)["signal"] is True
