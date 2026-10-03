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
