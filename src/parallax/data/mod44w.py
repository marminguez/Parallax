"""MOD44W V061 sinusoidal-grid geometry utilities."""

from __future__ import annotations

import math
from dataclasses import dataclass


MODIS_RADIUS_M = 6_371_007.181
MODIS_TILE_SIZE_M = 1_111_950.519667

MODIS_XMIN_M = -20_015_109.354006
MODIS_YMAX_M = 10_007_554.677003

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



def normalize_longitude(
    longitude_deg: float,
) -> float:
    """Normalize longitude to the global [-180, 180] domain.

    Longitudes crossing the antimeridian are wrapped periodically.
    Positive exact multiples mapping to the antimeridian preserve
    +180 degrees rather than becoming -180 degrees.
    """

    normalized = (
        (longitude_deg + 180.0) % 360.0
    ) - 180.0

    if normalized == -180.0 and longitude_deg > 0.0:
        return 180.0

    return normalized


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


def _snap_near_integer(
    value: float,
    tolerance: float = 1e-5,
) -> float:
    """Snap floating-point boundary noise to the nearest integer."""
    nearest = round(value)

    if abs(value - nearest) <= tolerance:
        return float(nearest)

    return value


def sinusoidal_to_tile(
    x: float,
    y: float,
) -> tuple[int, int]:
    """Return MODIS horizontal/vertical tile indices."""

    h_raw = (
        (x - MODIS_XMIN_M)
        / MODIS_TILE_SIZE_M
    )

    v_raw = (
        (MODIS_YMAX_M - y)
        / MODIS_TILE_SIZE_M
    )

    h = math.floor(
        _snap_near_integer(h_raw)
    )

    v = math.floor(
        _snap_near_integer(v_raw)
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

    col_raw = (
        (x - bounds.xmin)
        / MODIS_PIXEL_SIZE_M
    )

    row_raw = (
        (bounds.ymax - y)
        / MODIS_PIXEL_SIZE_M
    )

    col = math.floor(
        _snap_near_integer(col_raw)
    )

    row = math.floor(
        _snap_near_integer(row_raw)
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


def tiles_for_geographic_footprint(
    west: float,
    south: float,
    east: float,
    north: float,
) -> set[tuple[int, int]]:
    """
    Return MOD44W tiles intersected by a geographic footprint.

    The footprint is an axis-aligned geographic rectangle. Tile
    intersections are solved analytically in the MODIS sinusoidal
    projection rather than inferred from perimeter sampling.

    For each intersected MODIS vertical row, the function evaluates the
    exact horizontal extent produced by

        x = R * longitude * cos(latitude)

    over the latitude interval inside that row.

    Footprints crossing the antimeridian are split into continuous
    longitude segments before projection.
    """

    if south >= north:
        raise ValueError(
            "south must be smaller than north."
        )

    if west >= east:
        raise ValueError(
            "west must be smaller than east."
        )

    if south < -90.0 or north > 90.0:
        raise ValueError(
            "Latitude bounds must remain within [-90, 90]."
        )

    if east - west > 360.0:
        raise ValueError(
            "Footprint longitude span cannot exceed 360 degrees."
        )

    # Split the geographic footprint into longitude-continuous pieces.
    # EXP-001B footprints are small, but their unwrapped bounds may cross
    # either side of the antimeridian.
    segments: list[tuple[float, float]] = []

    segment_west = west
    segment_east = east

    while segment_west < -180.0:
        segment_west += 360.0
        segment_east += 360.0

    while segment_west > 180.0:
        segment_west -= 360.0
        segment_east -= 360.0

    if segment_east <= 180.0:
        segments.append(
            (segment_west, segment_east)
        )
    else:
        segments.append(
            (segment_west, 180.0)
        )
        segments.append(
            (-180.0, segment_east - 360.0)
        )

    tiles: set[tuple[int, int]] = set()

    # MODIS sinusoidal vertical tile boundaries correspond to 10-degree
    # latitude bands. Test every row whose latitude interval overlaps
    # the footprint.
    for v in range(18):
        bounds = tile_bounds(18, v)

        row_south = math.degrees(
            bounds.ymin / MODIS_RADIUS_M
        )
        row_north = math.degrees(
            bounds.ymax / MODIS_RADIUS_M
        )

        lat_min = max(
            south,
            row_south,
        )
        lat_max = min(
            north,
            row_north,
        )

        # Require positive-area vertical overlap. MODIS grid constants
        # contain sub-millimetre rounding differences at nominal
        # 10-degree row boundaries, so reuse the module's established
        # 1e-5-pixel numerical tolerance.
        overlap_m = (
            math.radians(lat_max - lat_min)
            * MODIS_RADIUS_M
        )

        geometry_tolerance_m = (
            MODIS_PIXEL_SIZE_M * 1e-5
        )

        if overlap_m <= geometry_tolerance_m:
            continue

        # cos(latitude) can have an interior extremum at the equator.
        critical_latitudes = [
            lat_min,
            lat_max,
        ]

        if lat_min <= 0.0 <= lat_max:
            critical_latitudes.append(0.0)

        for lon_west, lon_east in segments:
            x_values: list[float] = []

            for latitude in critical_latitudes:
                cos_lat = math.cos(
                    math.radians(latitude)
                )

                for longitude in (
                    lon_west,
                    lon_east,
                ):
                    x_values.append(
                        MODIS_RADIUS_M
                        * math.radians(longitude)
                        * cos_lat
                    )

            x_min = min(x_values)
            x_max = max(x_values)

            h_min_raw = (
                (x_min - MODIS_XMIN_M)
                / MODIS_TILE_SIZE_M
            )
            h_max_raw = (
                (x_max - MODIS_XMIN_M)
                / MODIS_TILE_SIZE_M
            )

            h_min = math.floor(
                _snap_near_integer(h_min_raw)
            )
            h_max = math.floor(
                _snap_near_integer(h_max_raw)
            )

            h_min = max(0, h_min)
            h_max = min(35, h_max)

            for h in range(
                h_min,
                h_max + 1,
            ):
                candidate_bounds = tile_bounds(h, v)

                horizontal_overlap_m = (
                    min(x_max, candidate_bounds.xmax)
                    - max(x_min, candidate_bounds.xmin)
                )

                # Require positive-area horizontal overlap, using the
                # same established 1e-5-pixel numerical tolerance as
                # the vertical intersection test.
                if (
                    horizontal_overlap_m
                    <= geometry_tolerance_m
                ):
                    continue

                tiles.add((h, v))

    return tiles
