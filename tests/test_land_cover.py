"""Synthetic rasters validate accounting and missing coverage, not real sites."""
import sys
from pathlib import Path
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from land_cover import characterize
from download_worldcover import required_tiles


def write_map(directory, values):
    path = directory / 'ESA_WorldCover_10m_2021_v200_N00E000_Map.tif'
    with rasterio.open(path, 'w', driver='GTiff', height=600, width=600,
                       count=1, dtype='uint8', crs='EPSG:4326',
                       transform=from_origin(-0.3, 0.3, 0.001, 0.001), nodata=0) as ds:
        ds.write(values, 1)
    return path


def test_missing_cover_is_unknown_not_zero_vegetation(tmp_path):
    r = characterize(0,0,tmp_path)
    assert r['status'] == 'unavailable'
    assert r['coverageFraction'] == 0
    assert r['classes'] == []


def test_class_proportions_and_full_window_accounting(tmp_path):
    values = np.full((600,600),10,dtype='uint8')
    values[:,300:] = 60
    write_map(tmp_path, values)
    r = characterize(0,0,tmp_path)
    assert r['status'] == 'available'
    assert r['classifiedSamples'] == r['totalSamples'] == 250000
    classes = {c['code']:c for c in r['classes']}
    assert classes[10]['fractionOfClassified'] == pytest.approx(0.5,abs=0.002)
    assert classes[60]['fractionOfClassified'] == pytest.approx(0.5,abs=0.002)
    assert sum(c['fractionOfClassified'] for c in r['classes']) == pytest.approx(1)
    assert r['year'] == 2021 and r['analysisResolutionM'] == 100


def test_unrecognized_and_nodata_classes_are_missing_not_bare(tmp_path):
    values = np.full((600,600),60,dtype='uint8')
    values[:,300:] = 255
    write_map(tmp_path, values)
    r = characterize(0,0,tmp_path)
    assert r['status'] == 'partial'
    assert r['coverageFraction'] == pytest.approx(0.5,abs=0.002)
    bare = next(c for c in r['classes'] if c['code'] == 60)
    assert bare['fractionOfClassified'] == 1
    assert bare['fractionOfWindow'] == pytest.approx(0.5,abs=0.002)


def test_bad_raster_does_not_turn_into_valid_evidence(tmp_path):
    (tmp_path / 'ESA_WorldCover_10m_2021_v200_N00E000_Map.tif').write_text('invalid')
    r = characterize(0,0,tmp_path)
    assert r['status'] == 'error'
    assert r['classes'] == []


def test_download_plan_covers_windows_on_both_sides_of_tile_boundary():
    assert required_tiles(-3.1,-2.9,42.9,43.1) == ['N42W003','N42W006']
    with pytest.raises(ValueError): required_tiles(0,11,0,1)
    with pytest.raises(ValueError): required_tiles(float('nan'),1,0,1)
