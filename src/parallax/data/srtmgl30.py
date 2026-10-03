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