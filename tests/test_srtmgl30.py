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
