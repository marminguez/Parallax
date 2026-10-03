"""MOD44W V061 sinusoidal-grid geometry utilities."""

from __future__ import annotations

import math
from dataclasses import dataclass


MODIS_RADIUS_M = 6_371_007.181
MODIS_TILE_SIZE_M = 1_111_950.0

MODIS_XMIN_M = -20_015_109.347
MODIS_YMAX_M = 10_007_554.677

MODIS_PIXELS_PER_TILE = 4800

MODIS_PIXEL_SIZE_M = (
    MODIS_TILE_SIZE_M / MODIS_PIXELS_PER_TILE
)


@dataclass(frozen=True)
class Mod44wTileBounds:
    """Sinusoidal bounds of one MOD44W tile."""

    h: int
    v: int
    xmin: float
    xmax: float
    ymin: float
    ymax: float


def latlon_to_sinusoidal(
    latitude_deg: float,
    longitude_deg: float,
) -> tuple[float, float]:
    """Convert geographic coordinates to MODIS sinusoidal metres."""

    if not -90.0 <= latitude_deg <= 90.0:
        raise ValueError(
            "Latitude must be between -90 and 90 degrees."
        )

    if not -180.0 <= longitude_deg <= 180.0:
        raise ValueError(
            "Longitude must be between -180 and 180 degrees."
        )

    lat_rad = math.radians(latitude_deg)
    lon_rad = math.radians(longitude_deg)

    x = (
        MODIS_RADIUS_M
        * lon_rad
        * math.cos(lat_rad)
    )

    y = MODIS_RADIUS_M * lat_rad

    return x, y


def sinusoidal_to_tile(
    x: float,
    y: float,
) -> tuple[int, int]:
    """Return MODIS horizontal/vertical tile indices."""

    h = math.floor(
        (x - MODIS_XMIN_M)
        / MODIS_TILE_SIZE_M
    )

    v = math.floor(
        (MODIS_YMAX_M - y)
        / MODIS_TILE_SIZE_M
    )

    if not 0 <= h < 36:
        raise ValueError(
            f"Invalid MODIS horizontal tile: h={h}"
        )

    if not 0 <= v < 18:
        raise ValueError(
            f"Invalid MODIS vertical tile: v={v}"
        )

    return h, v


def latlon_to_tile(
    latitude_deg: float,
    longitude_deg: float,
) -> tuple[int, int]:
    """Return MODIS h/v tile for a geographic coordinate."""

    x, y = latlon_to_sinusoidal(
        latitude_deg,
        longitude_deg,
    )

    return sinusoidal_to_tile(x, y)


def tile_bounds(
    h: int,
    v: int,
) -> Mod44wTileBounds:
    """Return sinusoidal bounds for an MOD44W tile."""

    if not 0 <= h < 36:
        raise ValueError("h must be in [0, 35].")

    if not 0 <= v < 18:
        raise ValueError("v must be in [0, 17].")

    xmin = (
        MODIS_XMIN_M
        + h * MODIS_TILE_SIZE_M
    )

    xmax = xmin + MODIS_TILE_SIZE_M

    ymax = (
        MODIS_YMAX_M
        - v * MODIS_TILE_SIZE_M
    )

    ymin = ymax - MODIS_TILE_SIZE_M

    return Mod44wTileBounds(
        h=h,
        v=v,
        xmin=xmin,
        xmax=xmax,
        ymin=ymin,
        ymax=ymax,
    )


def latlon_to_pixel(
    latitude_deg: float,
    longitude_deg: float,
) -> tuple[int, int]:
    """Return row/column inside the MOD44W tile."""

    x, y = latlon_to_sinusoidal(
        latitude_deg,
        longitude_deg,
    )

    h, v = sinusoidal_to_tile(x, y)
    bounds = tile_bounds(h, v)

    col = math.floor(
        (x - bounds.xmin)
        / MODIS_PIXEL_SIZE_M
    )

    row = math.floor(
        (bounds.ymax - y)
        / MODIS_PIXEL_SIZE_M
    )

    col = min(
        MODIS_PIXELS_PER_TILE - 1,
        max(0, col),
    )

    row = min(
        MODIS_PIXELS_PER_TILE - 1,
        max(0, row),
    )

    return row, col


from pathlib import Path
import subprocess

import numpy as np


WATER_MASK_SUBDATASET = (
    "MOD44W_250m_GRID:water_mask"
)

LAND_VALUE = 0
WATER_VALUE = 1
INVALID_VALUE = 253


def water_mask_subdataset(
    hdf_path: str | Path,
) -> str:
    """
    Return the GDAL subdataset identifier for MOD44W water_mask.
    """

    path = Path(hdf_path)

    if not path.exists():
        raise FileNotFoundError(path)

    return (
        f'HDF4_EOS:EOS_GRID:"{path}":'
        f"{WATER_MASK_SUBDATASET}"
    )


def extract_water_mask(
    hdf_path: str | Path,
    output_path: str | Path,
) -> Path:
    """
    Extract MOD44W water_mask into a GeoTIFF using GDAL.
    """

    source = water_mask_subdataset(hdf_path)
    output = Path(output_path)

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    subprocess.run(
        [
            "gdal_translate",
            source,
            str(output),
            "-of",
            "GTiff",
            "-co",
            "COMPRESS=LZW",
        ],
        check=True,
    )

    return output


def read_water_mask(
    path: str | Path,
) -> np.ndarray:
    """
    Read a cached MOD44W water_mask GeoTIFF.

    Returns a uint8 array containing the native categorical values:

        0   = land
        1   = water
        253 = fill / invalid

    NoData values are preserved and must never be interpreted as land
    or water.
    """

    import rasterio

    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(path)

    with rasterio.open(path) as src:
        if src.count != 1:
            raise ValueError(
                "MOD44W water mask must contain exactly one band."
            )

        if src.width != MODIS_PIXELS_PER_TILE:
            raise ValueError(
                f"Unexpected MOD44W width: {src.width}."
            )

        if src.height != MODIS_PIXELS_PER_TILE:
            raise ValueError(
                f"Unexpected MOD44W height: {src.height}."
            )

        data = src.read(1)

        nodata = src.nodata

    if data.dtype != np.uint8:
        raise ValueError(
            f"Unexpected MOD44W dtype: {data.dtype}."
        )

    if nodata is not None and int(nodata) != INVALID_VALUE:
        raise ValueError(
            f"Unexpected MOD44W NoData value: {nodata}."
        )

    allowed = {
        LAND_VALUE,
        WATER_VALUE,
        250,
        INVALID_VALUE,
    }

    values = set(
        int(value)
        for value in np.unique(data)
    )

    unexpected = values - allowed

    if unexpected:
        raise ValueError(
            f"Unexpected MOD44W classes: {sorted(unexpected)}."
        )

    return data
