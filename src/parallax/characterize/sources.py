"""Data access for twin characterization v1 (rasterio, pyproj, network).

Every reader returns plain numpy arrays or dicts; the measurements themselves
live in parallax.characterize. See config/characterization/dimensions_v1.yaml.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

from parallax.reverse import MARS_RADIUS_M, block_mean

from . import FINE_CELLS, FINE_GRID_M, copernicus_tile_names, window_bounds_deg

GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".TIF,.tif",
    "GDAL_HTTP_MAX_RETRY": "5",
    "GDAL_HTTP_RETRY_DELAY": "3",
}
COPERNICUS_URL = "https://copernicus-dem-30m.s3.amazonaws.com/{name}/{name}.tif"
POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"


def _vsi(path: str) -> str:
    return "/vsicurl/" + path if path.startswith(("https://", "http://")) else path


def _half() -> float:
    return FINE_CELLS * FINE_GRID_M / 2


def _reproject_into(dst: np.ndarray, src, dst_crs) -> None:
    import rasterio
    from rasterio.transform import from_origin
    from rasterio.warp import Resampling, reproject

    scale = (src.scales or (1.0,))[0] or 1.0
    offset = (src.offsets or (0.0,))[0] or 0.0
    tmp = np.full(dst.shape, np.nan, dtype="float64")
    reproject(
        source=rasterio.band(src, 1),
        destination=tmp,
        src_nodata=src.nodata,
        dst_transform=from_origin(-_half(), _half(), FINE_GRID_M, FINE_GRID_M),
        dst_crs=dst_crs,
        dst_nodata=np.nan,
        resampling=Resampling.average,
    )
    filled = np.isfinite(tmp)
    dst[filled] = tmp[filled] * scale + offset


# --------------------------------------------------------------------------- Earth: Copernicus GLO-30


def earth_fine_window(lat: float, lon: float, tile_root: str | None = None) -> np.ndarray:
    """60 m elevation grid (833 x 833) on a local azimuthal-equidistant plane, from Copernicus GLO-30.

    Tiles are read directly from the public AWS bucket (or from tile_root if
    given, with the same file names). Missing tiles (open ocean) stay NaN.
    """
    import rasterio
    from pyproj import CRS

    crs = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m +no_defs")
    dst = np.full((FINE_CELLS, FINE_CELLS), np.nan)
    west, south, east, north = window_bounds_deg(lat, lon, half_km=_half() / 1000 * 1.45)
    with rasterio.Env(**GDAL_ENV):
        for name in copernicus_tile_names(west, south, east, north):
            path = f"{tile_root.rstrip('/')}/{name}.tif" if tile_root else COPERNICUS_URL.format(name=name)
            try:
                with rasterio.open(_vsi(path)) as src:
                    _reproject_into(dst, src, crs)
            except rasterio.errors.RasterioIOError:
                continue  # no tile here: ocean, or outside coverage
    return dst


# --------------------------------------------------------------------------- Moon: LOLA 20 m in its own plane


def moon_fine_window(dem: str, x: float, y: float) -> np.ndarray:
    """60 m grid (833 x 833) by 3 x 3 block mean of LOLA 20 m around a window centre (x, y) in the DEM's plane."""
    import rasterio
    from rasterio.windows import Window

    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(_vsi(dem)) as src:
            res = abs(src.transform.a)
            factor = FINE_GRID_M / res
            if abs(factor - round(factor)) > 1e-9:
                raise RuntimeError(f"60 m is not an integer multiple of the {res} m source grid.")
            factor = int(round(factor))
            size = FINE_CELLS * factor
            from rasterio.transform import rowcol

            row_f, col_f = rowcol(src.transform, x, y, op=lambda v: v)
            row_f, col_f = float(row_f), float(col_f)
            c0, r0 = int(round(col_f - size / 2)), int(round(row_f - size / 2))
            win = Window(c0, r0, size, size)
            data = src.read(1, window=win, masked=True, boundless=True, fill_value=src.nodata if src.nodata is not None else -1e30)
            scale = (src.scales or (1.0,))[0] or 1.0
            offset = (src.offsets or (0.0,))[0] or 0.0
            arr = data.astype("float64").filled(np.nan) * scale + offset
            return block_mean(arr, factor)


# --------------------------------------------------------------------------- Mars: CTX at Jezero only


def mars_fine_window(dem: str, lat: float, lon: float) -> np.ndarray:
    """60 m grid (833 x 833) on a local azimuthal-equidistant plane of the Mars sphere, average resampling."""
    import rasterio
    from pyproj import CRS

    crs = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +R={MARS_RADIUS_M} +units=m +no_defs")
    dst = np.full((FINE_CELLS, FINE_CELLS), np.nan)
    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(_vsi(dem)) as src:
            _reproject_into(dst, src, crs)
    return dst


# --------------------------------------------------------------------------- Population: SEDAC GPWv4


def population_densities(path: str, lat: float, lon: float) -> np.ndarray:
    """Values of GPWv4 cells whose centres fall inside the 50 x 50 km window box."""
    import rasterio
    from rasterio.windows import from_bounds

    west, south, east, north = window_bounds_deg(lat, lon)
    with rasterio.open(path) as src:
        win = from_bounds(west, south, east, north, src.transform).round_offsets().round_lengths()
        data = src.read(1, window=win, masked=True, boundless=True)
        t = src.window_transform(win)
        rows, cols = np.indices(data.shape)
        xs = t.c + (cols + 0.5) * t.a + (rows + 0.5) * t.b
        ys = t.f + (cols + 0.5) * t.d + (rows + 0.5) * t.e
        inside = (xs >= west) & (xs <= east) & (ys >= south) & (ys <= north)
        vals = data.astype("float64").filled(np.nan)
        return vals[inside]


# --------------------------------------------------------------------------- Temperature: NASA POWER


def power_climatology(lat: float, lon: float, cache_dir: Path) -> dict:
    """NASA POWER climatology (TS_MIN, TS_MAX) at a point, cached on disk."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache = cache_dir / f"power_{lat:.4f}_{lon:.4f}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    query = urllib.parse.urlencode({
        "parameters": "TS_MIN,TS_MAX", "community": "RE",
        "longitude": f"{lon:.4f}", "latitude": f"{lat:.4f}", "format": "JSON",
    })
    last: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(f"{POWER_URL}?{query}", timeout=60) as r:
                payload = json.loads(r.read().decode("utf-8"))
            cache.write_text(json.dumps(payload))
            return payload
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"NASA POWER request failed for {lat}, {lon}: {last}")
