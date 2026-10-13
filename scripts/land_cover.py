"""Optional, offline ESA WorldCover 2021 characterization of a terrain window.

Nearest-neighbour samples on a 100 m local metric grid estimate proportions;
these are not exact native-10m area totals, field validation or current cover.
"""
from pathlib import Path
import json
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform_bounds, Resampling

CLASSES = {10: 'Tree cover', 20: 'Shrubland', 30: 'Grassland', 40: 'Cropland',
           50: 'Built-up', 60: 'Bare / sparse vegetation', 70: 'Snow and ice',
           80: 'Permanent water', 90: 'Herbaceous wetland', 95: 'Mangroves', 100: 'Moss and lichen'}
SOURCE = 'https://doi.org/10.5281/zenodo.7254221'
ATTRIBUTION = '© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium'


def characterize(lat, lon, directory=Path('data/earth/worldcover/raw')):
    """Characterize from local tiles (offline; used by live searches)."""
    return characterize_files(lat, lon, sorted(Path(directory).glob('ESA_WorldCover_10m_2021_v200_*_Map.tif')))


def characterize_files(lat, lon, files):
    """Characterize from explicit tiles: local paths or GDAL '/vsicurl/https://…' URLs.

    Remote tiles are read block by block over HTTP (only the window), never downloaded whole.
    """
    base = {'dataset': 'ESA WorldCover', 'year': 2021, 'version': 'v200',
            'nativeResolutionM': 10, 'analysisResolutionM': 100, 'windowKm': 50,
            'method': 'Nearest-neighbour samples at 100 m local AEQD grid centres; estimated proportions among classified samples.',
            'source': SOURCE, 'attribution': ATTRIBUTION, 'sourceTiles': [],
            'coverageFraction': 0, 'classifiedSamples': 0, 'totalSamples': 250000, 'classes': []}
    try:
        crs = f'+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m +no_defs'
        transform = from_origin(-25000, 25000, 100, 100)
        sampled = np.zeros((500, 500), dtype='uint8')
        for path in files:
            remote = isinstance(path, str) and path.startswith('/vsicurl/')
            with rasterio.open(path) as src:
                if src.crs != rasterio.crs.CRS.from_epsg(4326) or src.count != 1:
                    raise ValueError(f'Unexpected WorldCover CRS/bands: {Path(str(path)).name}')
                # Only overlapping source tiles are read. No web access in searches.
                bounds = transform_bounds(crs, src.crs, -25000, -25000, 25000, 25000, densify_pts=21)
                if bounds[0] > bounds[2]:
                    raise ValueError('WorldCover windows crossing the antimeridian are not supported yet.')
                if src.bounds.right <= bounds[0] or src.bounds.left >= bounds[2] or src.bounds.top <= bounds[1] or src.bounds.bottom >= bounds[3]:
                    continue
                tile = np.zeros_like(sampled)
                reproject(rasterio.band(src, 1), tile, src_transform=src.transform, src_crs=src.crs,
                          src_nodata=0, dst_transform=transform, dst_crs=crs, dst_nodata=0,
                          resampling=Resampling.nearest, num_threads=1)
                valid = np.isin(tile, list(CLASSES))
                sampled[valid] = tile[valid]
                if remote:
                    base['sourceTiles'].append({'name': path.rsplit('/', 1)[-1], 'url': path.removeprefix('/vsicurl/')})
                    continue
                path = Path(path)
                record = {'name': path.name, 'bytes': path.stat().st_size}
                manifest = path.with_suffix('.json')
                if manifest.is_file():
                    metadata = json.loads(manifest.read_text())
                    if metadata.get('bytes') == record['bytes'] and metadata.get('mtimeNs') == path.stat().st_mtime_ns:
                        record['sha256'] = metadata.get('sha256')
                        record['url'] = metadata.get('url')
                base['sourceTiles'].append(record)
        counts = {code: int(np.count_nonzero(sampled == code)) for code in CLASSES}
        classified = sum(counts.values())
        base.update(classifiedSamples=classified, coverageFraction=classified / sampled.size)
        if not classified:
            return {**base, 'status': 'unavailable', 'message': 'No classified WorldCover samples for this window. Prepare local tiles with scripts/download_worldcover.py.'}
        base['classes'] = [{'code': code, 'label': label, 'samples': counts[code],
                            'fractionOfClassified': counts[code] / classified,
                            'fractionOfWindow': counts[code] / sampled.size} for code, label in CLASSES.items()]
        return {**base, 'status': 'available' if classified == sampled.size else 'partial',
                'message': 'Historical land-cover characterization only; not a field suitability check.'}
    except Exception as exc:
        return {**base, 'status': 'error', 'classes': [], 'message': f'WorldCover could not be characterized: {exc}'}
