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
