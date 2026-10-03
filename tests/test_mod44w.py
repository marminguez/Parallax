from parallax.data.mod44w import (
    latlon_to_sinusoidal,
    latlon_to_tile,
    latlon_to_pixel,
    tile_bounds,
)


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

    assert west.xmax == east.xmin

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
