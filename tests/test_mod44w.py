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
