"""Raster readers for the VAL-004 planetary grids (need rasterio and pyproj)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import GRID_M, MARS_RADIUS_M, WINDOW_CELLS, block_mean, window_histogram

GDAL_ENV = {"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".TIF,.tif", "GDAL_HTTP_MAX_RETRY": "5", "GDAL_HTTP_RETRY_DELAY": "3"}


def _path(dem: str) -> str:
    return "/vsicurl/" + dem if dem.startswith(("https://", "http://")) else dem


# --------------------------------------------------------------------------- Moon: native polar plane


@dataclass
class PlaneGrid:
    """A 1 km grid in a DEM's own projected plane."""

    elevation: np.ndarray  # (rows, cols), NaN where any source pixel was missing
    left: float
    top: float
    crs_wkt: str
    native_resolution_m: float

    def centre_xy(self, r0: int, c0: int, size: int = WINDOW_CELLS) -> tuple[float, float]:
        return self.left + (c0 + size / 2) * GRID_M, self.top - (r0 + size / 2) * GRID_M

    def to_lonlat(self, x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        from pyproj import CRS, Transformer

        projected = CRS.from_wkt(self.crs_wkt)
        geographic = projected.geodetic_crs
        t = Transformer.from_crs(projected, geographic, always_xy=True)
        lon, lat = t.transform(np.asarray(x), np.asarray(y))
        return np.asarray(lon), np.asarray(lat)

    def to_xy(self, lon: float, lat: float) -> tuple[float, float]:
        from pyproj import CRS, Transformer

        projected = CRS.from_wkt(self.crs_wkt)
        t = Transformer.from_crs(projected.geodetic_crs, projected, always_xy=True)
        x, y = t.transform(lon, lat)
        return float(x), float(y)


def plane_grid_1km(dem: str, progress=None) -> PlaneGrid:
    """Block-mean a projected DEM to 1 km, reading strips so the whole file never sits in memory.

    The grid starts at the DEM's top-left corner. Same aggregation as the frozen
    Shackleton target (block mean in the native plane; any missing pixel voids
    the 1 km cell).
    """
    import rasterio
    from rasterio.windows import Window

    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(_path(dem)) as src:
            res = abs(src.transform.a)
            if abs(abs(src.transform.e) - res) > 1e-6:
                raise RuntimeError("Expected square DEM pixels.")
            factor = GRID_M / res
            if abs(factor - round(factor)) > 1e-9:
                raise RuntimeError(f"1 km is not an integer multiple of the {res} m source grid.")
            factor = int(round(factor))
            rows, cols = src.height // factor, src.width // factor
            scale = (src.scales or (1.0,))[0] or 1.0
            offset = (src.offsets or (0.0,))[0] or 0.0
            out = np.full((rows, cols), np.nan)
            for r in range(rows):
                strip = src.read(1, window=Window(0, r * factor, cols * factor, factor), masked=True)
                data = strip.astype("float64").filled(np.nan) * scale + offset
                out[r] = block_mean(data, factor)[0]
                if progress and (r % 25 == 0 or r == rows - 1):
                    progress(r + 1, rows)
            return PlaneGrid(out, float(src.transform.c), float(src.transform.f), src.crs.to_wkt(), float(res))


# --------------------------------------------------------------------------- Mars: local AEQD windows, the Earth method


def mars_aeqd_crs(lat: float, lon: float):
    from pyproj import CRS

    return CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +R={MARS_RADIUS_M} +units=m +no_defs")


class MarsDEM:
    """Open once, then build any number of 50 km windows (local AEQD, 1 km, bilinear)."""

    def __init__(self, dem: str):
        import rasterio

        self._env = rasterio.Env(**GDAL_ENV)
        self._env.__enter__()
        self.src = rasterio.open(_path(dem))
        self.scale = (self.src.scales or (1.0,))[0] or 1.0
        self.offset = (self.src.offsets or (0.0,))[0] or 0.0
        self.nodata = self.src.nodata

    def close(self) -> None:
        self.src.close()
        self._env.__exit__(None, None, None)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def window(self, lat: float, lon: float, size: int = WINDOW_CELLS) -> np.ndarray:
        import rasterio
        from rasterio.transform import from_origin
        from rasterio.warp import Resampling, reproject

        half = size * GRID_M / 2
        dst = np.full((size, size), np.nan, dtype="float64")
        reproject(
            source=rasterio.band(self.src, 1),
            destination=dst,
            src_nodata=self.nodata,
            dst_transform=from_origin(-half, half, GRID_M, GRID_M),
            dst_crs=mars_aeqd_crs(lat, lon),
            dst_nodata=np.nan,
            resampling=Resampling.bilinear,
        )
        return dst * self.scale + self.offset

    def histogram(self, lat: float, lon: float) -> np.ndarray:
        """Fingerprint of the window, or ValueError if any cell is missing (e.g. across the antimeridian)."""
        return window_histogram(self.window(lat, lon))
