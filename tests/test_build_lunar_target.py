import importlib.util
import math
from pathlib import Path

import numpy as np
import pytest

SCRIPT = Path(__file__).parents[1] / "scripts/build_lunar_target_50km.py"
spec = importlib.util.spec_from_file_location("build_lunar_target_50km", SCRIPT)
lunar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lunar)

PS_MOON = "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"


def plane(slope_deg: float, size: int, resolution_m: float) -> np.ndarray:
    x = np.arange(size) * resolution_m
    return np.tile(x * math.tan(math.radians(slope_deg)), (size, 1)) + 1000.0


def test_uniform_plane_falls_in_one_class_at_every_scale():
    terrain = lunar.build_terrain(plane(7.0, 500, 100.0), 100.0)
    for scale in ("100m", "500m", "1000m"):
        slope = terrain[scale]["slope"]
        assert slope["distribution_pct"]["5-10"] == pytest.approx(100.0)
        assert slope["p95_deg"] == pytest.approx(7.0, abs=1e-6)
    assert terrain["1000m"]["shape"] == [50, 50]
    assert sum(terrain["1000m"]["slope"]["distribution_pct"].values()) == pytest.approx(100.0)


def test_steep_walls_reach_the_open_top_class():
    terrain = lunar.build_terrain(plane(31.0, 500, 100.0), 100.0)
    assert terrain["1000m"]["slope"]["distribution_pct"][">=20"] == pytest.approx(100.0)


@pytest.mark.parametrize("bad", ["nan", "km", "non_integer"])
def test_incomplete_or_wrong_unit_inputs_are_rejected(bad):
    dem = plane(5.0, 500, 100.0)
    resolution = 100.0
    if bad == "nan":
        dem[10, 10] = np.nan
    elif bad == "km":
        dem = dem / 1e6
    else:
        resolution = 30.0
    with pytest.raises(ValueError):
        lunar.build_terrain(dem, resolution)


def test_site_centre_is_frozen_from_the_iau_gazetteer():
    site = lunar.SITES["shackleton"]
    assert (site["center_lat_deg"], site["center_lon_deg"]) == (-89.67, 129.78)
    assert "5450" in site["reference_url"]


def test_reads_a_polar_stereographic_window_and_builds_the_target(tmp_path):
    rasterio = pytest.importorskip("rasterio")
    from pyproj import Transformer
    from rasterio.transform import from_origin

    to_ps = Transformer.from_crs(f"+proj=longlat +R={lunar.MOON_RADIUS_M} +no_defs", PS_MOON, always_xy=True)
    cx, cy = to_ps.transform(129.78, -89.67)
    resolution, size = 100.0, 800  # 80 km raster around the site
    left, top = math.floor((cx - 40_000) / resolution) * resolution, math.ceil((cy + 40_000) / resolution) * resolution
    dem = plane(12.0, size, resolution).astype("float32")
    path = tmp_path / "moon.tif"
    with rasterio.open(path, "w", driver="GTiff", width=size, height=size, count=1, dtype="float32", crs=PS_MOON, transform=from_origin(left, top, resolution, resolution), nodata=-9999) as dst:
        dst.write(dem, 1)
    data, meta = lunar.read_window(str(path), lunar.SITES["shackleton"])
    assert data.shape == (500, 500)
    assert meta["native_resolution_m"] == resolution
    target = lunar.build_target("shackleton", data, meta, str(path))
    assert target["target"]["planet"] == "Moon"
    assert target["coverage_pct"] == 100.0
    assert target["terrain"]["1000m"]["slope"]["distribution_pct"]["10-15"] == pytest.approx(100.0)
    assert set(target["terrain"]) == {"100m", "500m", "1000m"}


def test_window_outside_the_dem_is_an_error(tmp_path):
    rasterio = pytest.importorskip("rasterio")
    from rasterio.transform import from_origin

    path = tmp_path / "small.tif"
    with rasterio.open(path, "w", driver="GTiff", width=100, height=100, count=1, dtype="float32", crs=PS_MOON, transform=from_origin(0, 10_000, 100, 100)) as dst:
        dst.write(np.ones((100, 100), dtype="float32") * 1000, 1)
    with pytest.raises(RuntimeError):
        lunar.read_window(str(path), lunar.SITES["shackleton"])
