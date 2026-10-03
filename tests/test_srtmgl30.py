import numpy as np

from parallax.data.srtmgl30 import read_dem, read_dem_zip


def test_zip_reader_matches_extracted_dem():
    direct = read_dem(
        "data/earth/coarse/raw/W020N90.DEM"
    )

    zipped = read_dem_zip(
        "data/earth/coarse/raw/w020n90.SRTMGL30.dem.zip"
    )

    assert direct.shape == zipped.shape

    assert np.array_equal(
        np.isnan(direct),
        np.isnan(zipped),
    )

    assert np.array_equal(
        np.nan_to_num(direct, nan=-32768),
        np.nan_to_num(zipped, nan=-32768),
    )


from parallax.data.srtmgl30 import bounds_from_tile_name


def test_bounds_from_northern_tile():
    bounds = bounds_from_tile_name(
        "W020N90.SRTMGL30.dem.zip"
    )

    assert bounds.west == -20.0
    assert bounds.east == 20.0
    assert bounds.south == 40.0
    assert bounds.north == 90.0


def test_bounds_from_equatorial_tile():
    bounds = bounds_from_tile_name(
        "W020N40.SRTMGL30.dem.zip"
    )

    assert bounds.west == -20.0
    assert bounds.east == 20.0
    assert bounds.south == -10.0
    assert bounds.north == 40.0


def test_bounds_from_southern_tile():
    bounds = bounds_from_tile_name(
        "E060S10.SRTMGL30.dem.zip"
    )

    assert bounds.west == 60.0
    assert bounds.east == 100.0
    assert bounds.south == -60.0
    assert bounds.north == -10.0


from parallax.data.srtmgl30 import physical_window_shape


def test_physical_window_shape_at_equator():
    assert physical_window_shape(0) == (54, 54)


def test_physical_window_shape_accounts_for_latitude():
    assert physical_window_shape(30) == (54, 62)
    assert physical_window_shape(60) == (54, 108)


def test_physical_window_shape_is_symmetric_by_latitude():
    assert physical_window_shape(-30) == physical_window_shape(30)
    assert physical_window_shape(-60) == physical_window_shape(60)


from parallax.data.srtmgl30 import physical_stride_shape


def test_physical_stride_shape_at_equator():
    assert physical_stride_shape(0) == (27, 27)


def test_physical_stride_shape_accounts_for_latitude():
    assert physical_stride_shape(30) == (27, 31)
    assert physical_stride_shape(60) == (27, 54)


def test_physical_stride_shape_is_symmetric_by_latitude():
    assert physical_stride_shape(-30) == physical_stride_shape(30)
    assert physical_stride_shape(-60) == physical_stride_shape(60)


from parallax.data.srtmgl30 import candidate_latitudes


def test_candidate_latitudes_respect_srtm_domain():
    latitudes = candidate_latitudes()

    assert len(latitudes) == 514

    assert np.isclose(
        latitudes[0],
        -55.775169909,
    )

    assert np.isclose(
        latitudes[-1],
        59.562666739,
    )

    assert np.allclose(
        np.diff(latitudes),
        np.diff(latitudes)[0],
    )


from parallax.data.srtmgl30 import candidate_longitudes


def test_candidate_longitudes_at_equator():
    longitudes = candidate_longitudes(0)

    assert len(longitudes) == 1601
    assert np.all(longitudes >= -180.0)
    assert np.all(longitudes < 180.0)


def test_candidate_longitudes_account_for_latitude():
    assert len(candidate_longitudes(30)) == 1387
    assert len(candidate_longitudes(60)) == 801


def test_candidate_longitudes_are_symmetric_by_latitude():
    assert np.allclose(
        candidate_longitudes(-30),
        candidate_longitudes(30),
    )


def test_candidate_longitudes_are_uniform():
    longitudes = candidate_longitudes(30)
    steps = np.diff(longitudes)

    assert np.allclose(
        steps,
        steps[0],
    )


from itertools import islice

from parallax.data.srtmgl30 import iter_candidate_centers


def test_candidate_center_ids_are_deterministic():
    first = list(
        islice(iter_candidate_centers(), 3)
    )

    assert first[0][0] == "EXP001B-0000001"
    assert first[1][0] == "EXP001B-0000002"
    assert first[2][0] == "EXP001B-0000003"

    assert first[0][1] == first[1][1]
    assert first[0][2] < first[1][2]


def test_candidate_grid_has_expected_size_and_last_id():
    count = 0
    last = None

    for candidate in iter_candidate_centers():
        count += 1
        last = candidate

    assert count == 690_069
    assert last[0] == "EXP001B-0690069"
    assert np.isclose(
        last[1],
        59.562666739,
    )


from pathlib import Path

from parallax.data.srtmgl30 import find_tile_for_coordinate


def test_find_tile_for_coordinate():
    tiles = sorted(
        Path("data/earth/coarse/raw").glob(
            "*.SRTMGL30.dem.zip"
        )
    )

    controls = [
        (
            0.0,
            0.0,
            "W020N40.SRTMGL30.dem.zip",
        ),
        (
            25.0,
            45.0,
            "e020n40.SRTMGL30.dem.zip",
        ),
        (
            -25.0,
            85.0,
            "e060s10.SRTMGL30.dem.zip",
        ),
        (
            50.0,
            -120.0,
            "w140n90.SRTMGL30.dem.zip",
        ),
    ]

    for lat, lon, expected in controls:
        tile = find_tile_for_coordinate(
            lat,
            lon,
            tiles,
        )

        assert tile.name == expected


from parallax.data.srtmgl30 import coordinate_to_pixel


def test_coordinate_to_pixel():
    bounds = bounds_from_tile_name(
        "W020N40.SRTMGL30.dem.zip"
    )

    assert coordinate_to_pixel(
        39.995833333,
        -19.995833333,
        bounds,
    ) == (0, 0)

    assert coordinate_to_pixel(
        0.0,
        0.0,
        bounds,
    ) == (4800, 2400)

    assert coordinate_to_pixel(
        -9.995833333,
        19.995833333,
        bounds,
    ) == (5999, 4799)


import numpy as np

from parallax.data.srtmgl30 import (
    extract_single_tile_window,
    find_tile_for_coordinate,
    read_tile_dem,
)


def test_single_tile_window_shape_and_land_control():
    tiles = sorted(
        Path("data/earth/coarse/raw").glob(
            "*.SRTMGL30.dem.zip"
        )
    )

    lat = 25.0
    lon = 45.0

    tile = find_tile_for_coordinate(
        lat,
        lon,
        tiles,
    )

    bounds = bounds_from_tile_name(tile.name)
    dem = read_tile_dem(tile)

    window = extract_single_tile_window(
        dem,
        lat,
        lon,
        bounds,
    )

    assert window.shape == (54, 60)
    assert np.isfinite(window).all()
    assert np.isclose(np.nanmean(window), 773.66, atol=0.01)
    assert np.nanmin(window) == 738.0
    assert np.nanmax(window) == 820.0
