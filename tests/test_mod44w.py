from pathlib import Path

import pytest
from parallax.data.mod44w import (
    latlon_to_sinusoidal,
    latlon_to_tile,
    latlon_to_pixel,
    normalize_longitude,
    tile_bounds,
)



def test_normalize_longitude_wraps_antimeridian():
    cases = [
        (-540.0, -180.0),
        (-180.225, 179.775),
        (-180.0, -180.0),
        (-179.775, -179.775),
        (0.0, 0.0),
        (179.775, 179.775),
        (180.0, 180.0),
        (180.225, -179.775),
        (540.0, 180.0),
    ]

    for longitude, expected in cases:
        assert normalize_longitude(
            longitude
        ) == pytest.approx(expected)


def test_latlon_to_tile_control_points():
    cases = [
        (45.0, -3.0, (17, 4)),
        (40.0, -3.0, (17, 5)),
        (39.5, 2.9, (18, 5)),
        (45.0, 0.0, (18, 4)),
    ]

    for latitude, longitude, expected in cases:
        assert latlon_to_tile(
            latitude,
            longitude,
        ) == expected


def test_latlon_to_pixel_control_points():
    cases = [
        (45.0, -3.0, (2400, 3781)),
        (40.0, -3.0, (0, 3696)),
        (39.5, 2.9, (240, 1074)),
        (45.0, 0.0, (2400, 0)),
    ]

    for latitude, longitude, expected in cases:
        assert latlon_to_pixel(
            latitude,
            longitude,
        ) == expected


def test_tile_bounds_are_contiguous():
    west = tile_bounds(17, 4)
    east = tile_bounds(18, 4)

    assert west.xmax == pytest.approx(east.xmin, abs=1e-9)

    north = tile_bounds(17, 4)
    south = tile_bounds(17, 5)

    assert south.ymax == north.ymin


def test_sinusoidal_control_coordinates():
    x, y = latlon_to_sinusoidal(
        45.0,
        -3.0,
    )

    assert abs(x - (-235880.33)) < 0.01
    assert abs(y - 5003777.34) < 0.01


import numpy as np

from parallax.data.mod44w import (
    extract_water_mask,
    read_water_mask,
)


def test_mod44w_real_water_mask_reader(tmp_path):
    source = Path(
        "data/earth/mod44w/raw/MOD44W_h17v04.hdf"
    )

    output = tmp_path / "water_mask.tif"

    extract_water_mask(
        source,
        output,
    )

    mask = read_water_mask(output)

    assert mask.shape == (4800, 4800)
    assert mask.dtype == np.uint8

    values, counts = np.unique(
        mask,
        return_counts=True,
    )

    observed = dict(
        zip(
            values.tolist(),
            counts.tolist(),
        )
    )

    assert observed == {
        0: 7_192_580,
        1: 15_847_420,
    }

    assert sum(observed.values()) == 23_040_000


def test_tiles_for_geographic_footprint_control():
    from parallax.data.mod44w import (
        tiles_for_geographic_footprint,
    )

    tiles = tiles_for_geographic_footprint(
        west=-3.316666666666663,
        south=44.775,
        east=-2.6833333333333296,
        north=45.225,
    )

    assert tiles == {
        (17, 4),
    }


def test_tiles_for_geographic_footprint_crosses_antimeridian():
    from parallax.data.mod44w import (
        tiles_for_geographic_footprint,
    )

    tiles = tiles_for_geographic_footprint(
        west=179.333333333333,
        south=59.341666666667,
        east=180.225,
        north=59.791666666667,
    )

    assert tiles == {
        (8, 3),
        (27, 3),
    }


def test_tiles_for_geographic_footprint_crosses_regular_tile_boundary():
    from parallax.data.mod44w import (
        tiles_for_geographic_footprint,
    )

    tiles = tiles_for_geographic_footprint(
        west=-179.408333333333,
        south=-56.000000000000,
        east=-178.608333333333,
        north=-55.550000000000,
    )

    assert tiles == {
        (7, 14),
        (8, 14),
    }


def test_tiles_for_geographic_footprint_detects_curved_boundary_intersection():
    """
    A geographic footprint can intersect a MODIS tile through the
    curvature of the sinusoidal projection even when sparse perimeter
    sampling misses the crossing.

    Regression control from EXP-001B geometry validation.
    """

    from parallax.data.mod44w import (
        tiles_for_geographic_footprint,
    )

    tiles = tiles_for_geographic_footprint(
        west=156.06666666666666,
        south=-40.25833333333334,
        east=156.65,
        north=-39.80833333333334,
    )

    assert tiles == {
        (29, 12),
        (29, 13),
        (30, 12),
        (30, 13),
    }


def test_tiles_for_geographic_footprint_excludes_zero_area_row_contact():
    """
    A footprint ending exactly on a MODIS row boundary must not include
    the adjacent row solely because of floating-point grid noise.

    Tile membership requires positive-area intersection.
    """

    from parallax.data.mod44w import (
        tiles_for_geographic_footprint,
    )

    tiles = tiles_for_geographic_footprint(
        west=-179.88333333333333,
        south=19.55,
        east=-179.40833333333333,
        north=20.0,
    )

    assert tiles == {
        (1, 7),
    }


def test_tiles_for_geographic_footprint_detects_narrow_corner_wedge():
    """
    Detect a real positive-area MODIS tile intersection that even dense
    512-point perimeter sampling can miss.

    EXP-001B control: h20v04 is intersected by a narrow sinusoidal wedge
    approximately 54.5 m high with ~16 m maximum penetration.
    """

    from parallax.data.mod44w import (
        tiles_for_geographic_footprint,
    )

    tiles = tiles_for_geographic_footprint(
        west=25.525000000000006,
        south=39.78333333333333,
        east=26.108333333333338,
        north=40.233333333333334,
    )

    assert tiles == {
        (19, 4),
        (19, 5),
        (20, 4),
        (20, 5),
    }


def test_tiles_for_geographic_footprint_excludes_zero_area_column_contact():
    """
    A footprint ending exactly on a MODIS horizontal tile boundary must
    not include the neighbouring tile when the intersection has zero area.
    """

    import math

    from parallax.data.mod44w import (
        MODIS_RADIUS_M,
        tile_bounds,
        tiles_for_geographic_footprint,
    )

    tile = tile_bounds(18, 9)

    boundary_lon = math.degrees(
        tile.xmax / MODIS_RADIUS_M
    )

    tiles = tiles_for_geographic_footprint(
        west=boundary_lon - 1.0,
        south=-0.5,
        east=boundary_lon,
        north=0.5,
    )

    assert tiles == {
        (18, 8),
        (18, 9),
    }
