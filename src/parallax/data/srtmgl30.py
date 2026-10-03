"""Reader and terrain utilities for NASA SRTMGL30 V002."""

from dataclasses import dataclass
from pathlib import Path
import zipfile

import numpy as np


ROWS = 6000
COLS = 4800
NODATA = -32768

EARTH_RADIUS_M = 6_371_008.8

PIXEL_DEGREES = 30 / 3600  # 30 arc-seconds


@dataclass(frozen=True)
class TileBounds:
    west: float
    east: float
    south: float
    north: float


def read_dem(path: str | Path) -> np.ndarray:
    """Read an SRTMGL30 binary DEM as float64."""

    path = Path(path)

    expected_bytes = ROWS * COLS * 2

    if path.stat().st_size != expected_bytes:
        raise ValueError(
            f"Unexpected file size: {path.stat().st_size:,} bytes. "
            f"Expected {expected_bytes:,}."
        )

    dem = np.fromfile(
        path,
        dtype=">i2",
    ).reshape(ROWS, COLS)

    dem = dem.astype("float64")

    dem[dem == NODATA] = np.nan

    return dem


def read_dem_zip(path: str | Path) -> np.ndarray:
    """Read an SRTMGL30 DEM directly from its ZIP archive."""

    path = Path(path)

    expected_values = ROWS * COLS

    with zipfile.ZipFile(path) as archive:
        dem_files = [
            name
            for name in archive.namelist()
            if name.upper().endswith(".DEM")
        ]

        if len(dem_files) != 1:
            raise ValueError(
                f"Expected exactly one DEM in {path.name}; "
                f"found {len(dem_files)}."
            )

        with archive.open(dem_files[0]) as stream:
            raw = stream.read()

    expected_bytes = expected_values * 2

    if len(raw) != expected_bytes:
        raise ValueError(
            f"Unexpected DEM size in {path.name}: "
            f"{len(raw):,} bytes. Expected {expected_bytes:,}."
        )

    dem = np.frombuffer(
        raw,
        dtype=">i2",
    ).reshape(ROWS, COLS)

    dem = dem.astype("float64")

    dem[dem == NODATA] = np.nan

    return dem


def pixel_latitudes(bounds: TileBounds) -> np.ndarray:
    """
    Return latitude of each raster row.

    SRTMGL30 is stored north -> south.
    """

    return (
        bounds.north
        - (np.arange(ROWS) + 0.5) * PIXEL_DEGREES
    )


def pixel_spacing_m(
    bounds: TileBounds,
) -> tuple[np.ndarray, float]:
    """
    Calculate E-W and N-S pixel spacing in metres.

    Longitude spacing varies with latitude.
    """

    latitudes = pixel_latitudes(bounds)

    angular_step = np.deg2rad(
        PIXEL_DEGREES
    )

    dy = (
        EARTH_RADIUS_M
        * angular_step
    )

    dx = (
        EARTH_RADIUS_M
        * np.cos(
            np.deg2rad(latitudes)
        )
        * angular_step
    )

    return dx, dy


def slope_degrees(
    dem: np.ndarray,
    bounds: TileBounds,
) -> np.ndarray:
    """
    Calculate approximate terrain slope.

    Geographic pixel spacing is corrected by latitude.
    """

    dx, dy = pixel_spacing_m(bounds)

    dz_dy = np.gradient(
        dem,
        axis=0,
    ) / dy

    dz_dx_raw = np.gradient(
        dem,
        axis=1,
    )

    dz_dx = (
        dz_dx_raw
        / dx[:, None]
    )

    gradient = np.sqrt(
        dz_dx**2
        + dz_dy**2
    )

    return np.degrees(
        np.arctan(gradient)
    )

def bounds_from_tile_name(name: str) -> TileBounds:
    """
    Derive geographic bounds from an SRTMGL30 tile name.

    Examples:
        W020N90 -> west=-20, east=20, south=40, north=90
        E060S10 -> west=60, east=100, south=-60, north=-10
    """

    stem = Path(name).name.upper().split(".")[0]

    if len(stem) != 7:
        raise ValueError(f"Invalid SRTMGL30 tile name: {name}")

    lon_hemisphere = stem[0]
    lon_value = int(stem[1:4])
    lat_hemisphere = stem[4]
    lat_value = int(stem[5:7])

    if lon_hemisphere not in {"E", "W"}:
        raise ValueError(f"Invalid longitude hemisphere: {name}")

    if lat_hemisphere not in {"N", "S"}:
        raise ValueError(f"Invalid latitude hemisphere: {name}")

    west = (
        lon_value
        if lon_hemisphere == "E"
        else -lon_value
    )

    north = (
        lat_value
        if lat_hemisphere == "N"
        else -lat_value
    )

    return TileBounds(
        west=float(west),
        east=float(west + 40),
        south=float(north - 50),
        north=float(north),
    )


def physical_window_shape(
    latitude_deg: float,
    window_m: float = 50_000.0,
) -> tuple[int, int]:
    """
    Return SRTMGL30 rows and columns required to approximate
    a physical square window at a given latitude.
    """

    if not -90.0 < latitude_deg < 90.0:
        raise ValueError("Latitude must be between -90 and 90 degrees.")

    if window_m <= 0:
        raise ValueError("Window size must be positive.")

    angular_step = np.deg2rad(PIXEL_DEGREES)

    dy = EARTH_RADIUS_M * angular_step

    dx = (
        EARTH_RADIUS_M
        * np.cos(np.deg2rad(latitude_deg))
        * angular_step
    )

    rows = max(1, round(window_m / dy))
    cols = max(1, round(window_m / dx))

    return rows, cols


def physical_stride_shape(
    latitude_deg: float,
    stride_m: float = 25_000.0,
) -> tuple[int, int]:
    """
    Return SRTMGL30 row and column stride required to approximate
    a physical search stride at a given latitude.
    """

    if not -90.0 < latitude_deg < 90.0:
        raise ValueError("Latitude must be between -90 and 90 degrees.")

    if stride_m <= 0:
        raise ValueError("Stride size must be positive.")

    angular_step = np.deg2rad(PIXEL_DEGREES)

    dy = EARTH_RADIUS_M * angular_step

    dx = (
        EARTH_RADIUS_M
        * np.cos(np.deg2rad(latitude_deg))
        * angular_step
    )

    rows = max(1, round(stride_m / dy))
    cols = max(1, round(stride_m / dx))

    return rows, cols


# EXP-001B v1.1 — documented SRTM observation domain.
SRTM_SOUTH_LIMIT_DEG = -56.0
SRTM_NORTH_LIMIT_DEG = 60.0


def candidate_latitudes(
    window_m: float = 50_000.0,
    stride_m: float = 25_000.0,
) -> np.ndarray:
    """
    Generate deterministic candidate-center latitudes inside
    the EXP-001B SRTM observation domain.
    """

    if window_m <= 0:
        raise ValueError("Window size must be positive.")

    if stride_m <= 0:
        raise ValueError("Stride size must be positive.")

    half_window_deg = np.rad2deg(
        (window_m / 2.0) / EARTH_RADIUS_M
    )

    stride_deg = np.rad2deg(
        stride_m / EARTH_RADIUS_M
    )

    south_center = (
        SRTM_SOUTH_LIMIT_DEG
        + half_window_deg
    )

    north_center = (
        SRTM_NORTH_LIMIT_DEG
        - half_window_deg
    )

    return np.arange(
        south_center,
        north_center + 1e-12,
        stride_deg,
    )


def candidate_longitudes(
    latitude_deg: float,
    stride_m: float = 25_000.0,
) -> np.ndarray:
    """
    Generate deterministic candidate-center longitudes for one latitude.

    Centers are uniformly distributed around the full longitude circle,
    with the number of centers chosen to approximate the requested
    physical E-W stride at that latitude.
    """

    if not -90.0 < latitude_deg < 90.0:
        raise ValueError("Latitude must be between -90 and 90 degrees.")

    if stride_m <= 0:
        raise ValueError("Stride size must be positive.")

    circumference_m = (
        2.0
        * np.pi
        * EARTH_RADIUS_M
        * np.cos(np.deg2rad(latitude_deg))
    )

    count = max(
        1,
        round(circumference_m / stride_m),
    )

    step_deg = 360.0 / count

    return (
        -180.0
        + (np.arange(count) + 0.5) * step_deg
    )


def iter_candidate_centers():
    """
    Yield EXP-001B candidate centers in deterministic order.

    Ordering:
        south -> north
        west -> east within each latitude row
    """

    candidate_id = 0

    for latitude in candidate_latitudes():
        for longitude in candidate_longitudes(latitude):
            candidate_id += 1

            yield (
                f"EXP001B-{candidate_id:07d}",
                float(latitude),
                float(longitude),
            )


def find_tile_for_coordinate(
    latitude_deg: float,
    longitude_deg: float,
    tile_paths,
) -> Path:
    """
    Return the SRTMGL30 tile containing a geographic coordinate.
    """

    if not -90.0 <= latitude_deg <= 90.0:
        raise ValueError("Latitude must be between -90 and 90 degrees.")

    if not -180.0 <= longitude_deg < 180.0:
        raise ValueError(
            "Longitude must be in the interval [-180, 180)."
        )

    matches = []

    for tile_path in tile_paths:
        tile_path = Path(tile_path)
        bounds = bounds_from_tile_name(tile_path.name)

        if (
            bounds.south <= latitude_deg < bounds.north
            and bounds.west <= longitude_deg < bounds.east
        ):
            matches.append(tile_path)

    if len(matches) != 1:
        raise ValueError(
            f"Expected exactly one SRTM tile for "
            f"({latitude_deg}, {longitude_deg}); "
            f"found {len(matches)}."
        )

    return matches[0]


def coordinate_to_pixel(
    latitude_deg: float,
    longitude_deg: float,
    bounds: TileBounds,
) -> tuple[int, int]:
    """
    Convert a geographic coordinate to an SRTMGL30 pixel index.

    The coordinate must lie inside the supplied tile bounds.
    """

    if not (
        bounds.south <= latitude_deg < bounds.north
        and bounds.west <= longitude_deg < bounds.east
    ):
        raise ValueError(
            "Coordinate lies outside the supplied tile bounds."
        )

    row = int(
        (bounds.north - latitude_deg)
        / PIXEL_DEGREES
    )

    col = int(
        (longitude_deg - bounds.west)
        / PIXEL_DEGREES
    )

    if not (0 <= row < ROWS and 0 <= col < COLS):
        raise ValueError(
            f"Calculated pixel is outside raster: "
            f"row={row}, col={col}."
        )

    return row, col


import zipfile


def read_tile_dem(path: str | Path) -> np.ndarray:
    """
    Read an SRTMGL30 DEM from a ZIP archive.
    """

    path = Path(path)

    with zipfile.ZipFile(path) as archive:
        dem_names = [
            name
            for name in archive.namelist()
            if name.upper().endswith(".DEM")
        ]

        if len(dem_names) != 1:
            raise ValueError(
                f"Expected exactly one DEM in {path}; "
                f"found {len(dem_names)}."
            )

        with archive.open(dem_names[0]) as stream:
            raw = stream.read()

    expected_bytes = ROWS * COLS * 2

    if len(raw) != expected_bytes:
        raise ValueError(
            f"Unexpected DEM size: {len(raw):,} bytes. "
            f"Expected {expected_bytes:,}."
        )

    dem = np.frombuffer(
        raw,
        dtype=">i2",
    ).reshape(ROWS, COLS)

    dem = dem.astype("float64")
    dem[dem == NODATA] = np.nan

    return dem


def extract_single_tile_window(
    dem: np.ndarray,
    latitude_deg: float,
    longitude_deg: float,
    bounds: TileBounds,
    window_m: float = 50_000.0,
) -> np.ndarray:
    """
    Extract a physical window fully contained within one SRTM tile.
    """

    rows, cols = physical_window_shape(
        latitude_deg=latitude_deg,
        window_m=window_m,
    )

    center_row, center_col = coordinate_to_pixel(
        latitude_deg,
        longitude_deg,
        bounds,
    )

    row_start = center_row - rows // 2
    row_end = row_start + rows

    col_start = center_col - cols // 2
    col_end = col_start + cols

    if (
        row_start < 0
        or row_end > ROWS
        or col_start < 0
        or col_end > COLS
    ):
        raise ValueError(
            "Window extends outside tile boundaries."
        )

    return dem[
        row_start:row_end,
        col_start:col_end,
    ]


def extract_cross_tile_window_ew(
    west_dem: np.ndarray,
    east_dem: np.ndarray,
    latitude_deg: float,
    longitude_deg: float,
    west_bounds: TileBounds,
    window_m: float = 50_000.0,
) -> np.ndarray:
    """
    Extract a physical window crossing one E-W tile boundary.

    The supplied DEMs must represent adjacent tiles where the west tile
    ends exactly where the east tile begins.
    """

    rows, cols = physical_window_shape(
        latitude_deg=latitude_deg,
        window_m=window_m,
    )

    center_row, center_col = coordinate_to_pixel(
        latitude_deg,
        longitude_deg,
        west_bounds,
    )

    row_start = center_row - rows // 2
    row_end = row_start + rows

    col_start = center_col - cols // 2
    col_end = col_start + cols

    if row_start < 0 or row_end > ROWS:
        raise ValueError(
            "Window extends outside tile latitude bounds."
        )

    west_cols = max(
        0,
        min(col_end, COLS) - max(col_start, 0),
    )

    east_cols = cols - west_cols

    if west_cols <= 0 or east_cols <= 0:
        raise ValueError(
            "Window does not cross the E-W tile boundary."
        )

    west_part = west_dem[
        row_start:row_end,
        col_start:COLS,
    ]

    east_part = east_dem[
        row_start:row_end,
        :east_cols,
    ]

    if west_part.shape != (rows, west_cols):
        raise ValueError(
            f"Unexpected west fragment shape: "
            f"{west_part.shape}."
        )

    if east_part.shape != (rows, east_cols):
        raise ValueError(
            f"Unexpected east fragment shape: "
            f"{east_part.shape}."
        )

    return np.concatenate(
        [west_part, east_part],
        axis=1,
    )
