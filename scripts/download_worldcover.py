"""Download only official ESA WorldCover tiles covering nine analysis windows."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from urllib.request import urlopen
from pyproj import CRS, Transformer

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/'


def required_tiles(west, east, south, north):
    if not all(math.isfinite(v) for v in (west, east, south, north)) or not (-180 <= west < east <= 180 and -55 <= south < north <= 59) or east-west > 10 or north-south > 10:
        raise ValueError('Use valid live-search bounds, at most 10 degrees per axis.')
    tiles = set()
    for iy in (1, 3, 5):
        lat = south + (north-south) * iy / 6
        for ix in (1, 3, 5):
            lon = west + (east-west) * ix / 6
            crs = CRS.from_proj4(f'+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m')
            t = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True)
            left, bottom, right, top = t.transform_bounds(-25000, -25000, 25000, 25000, densify_pts=21)
            if left > right:
                raise ValueError('Split searches away from the antimeridian; crossing windows are not supported yet.')
            for y in range(math.floor(bottom / 3)*3, math.floor(top / 3)*3+1, 3):
                for x in range(math.floor(left / 3)*3, math.floor(right / 3)*3+1, 3):
                    tiles.add(f'{"N" if y >= 0 else "S"}{abs(y):02d}{"E" if x >= 0 else "W"}{abs(x):03d}')
    return sorted(tiles)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('west','east','south','north'): parser.add_argument('--'+key, type=float, required=True)
    parser.add_argument('--plan', action='store_true', help='List tile URLs without downloading.')
    args = parser.parse_args()
    try: tiles = required_tiles(args.west,args.east,args.south,args.north)
    except ValueError as exc: parser.error(str(exc))
    directory = ROOT / 'data/earth/worldcover/raw'
    if not args.plan: directory.mkdir(parents=True,exist_ok=True)
    failures = []
    for tile in tiles:
        name = f'ESA_WorldCover_10m_2021_v200_{tile}_Map.tif'
        url = BASE + name
        if args.plan: print(url); continue
        path = directory / name
        manifest = path.with_suffix('.json')
        if path.is_file() and manifest.is_file():
            try:
                meta = json.loads(manifest.read_text())
                if meta['bytes'] == path.stat().st_size and meta['mtimeNs'] == path.stat().st_mtime_ns:
                    print(f'Already prepared: {name}',flush=True); continue
            except (KeyError, ValueError): pass
        temporary = path.with_suffix('.part')
        print(f'Downloading {name} ...',flush=True)
        try:
            digest = hashlib.sha256()
            with urlopen(url, timeout=60) as response, temporary.open('wb') as output:
                expected = response.headers.get('Content-Length')
                while chunk := response.read(1024*1024):
                    output.write(chunk); digest.update(chunk)
            if expected is not None and temporary.stat().st_size != int(expected): raise ValueError('Incomplete download')
            import rasterio
            with rasterio.open(temporary) as raster:
                if raster.crs != rasterio.crs.CRS.from_epsg(4326) or raster.count != 1: raise ValueError('Unexpected raster format')
            temporary.replace(path)
            manifest.write_text(json.dumps({'url': url, 'sha256':digest.hexdigest(), 'bytes':path.stat().st_size,'mtimeNs':path.stat().st_mtime_ns},indent=2)+'\n')
            print(f'Ready: {name} ({path.stat().st_size / 1e6:.1f} MB)',flush=True)
        except Exception as exc:
            temporary.unlink(missing_ok=True)
            failures.append(name)
            print(f'FAILED {name}: {exc}',flush=True)
    if failures: raise SystemExit(1)
    if not args.plan: print('WorldCover preparation complete. Repeat the live search in Parallax.',flush=True)

if __name__ == '__main__': main()
