"""Inspect the geology sources before the geology dimension is frozen.

Prints schemas and legends only (field names, class codes and how often each code
occurs worldwide). It never reads a twin or destination window, so it computes no
result and running it does not break pre-registration.

    python scripts/probe_geology_sources.py --glim "data/glim/LiMW_GIS 2015.gdb"

Needs: pyogrio (pip install pyogrio), network access to astrogeology.usgs.gov and macrostrat.org.
"""
from __future__ import annotations

import argparse
import json
import urllib.request
from collections import Counter

MARS_UNITS = "https://astrogeology.usgs.gov/pygeoapi/collections/mars/sim3292_global_geologic_map/units"
MACROSTRAT_EXAMPLE = "https://macrostrat.org/api/v2/geologic_units/map?lat=43&lng=-89.3&format=json"  # the API's own documented example


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "parallax-probe/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def probe_glim(path: str) -> None:
    import pyogrio

    print(f"\n== GLiM: {path}")
    for name, geom in pyogrio.list_layers(path):
        info = pyogrio.read_info(path, layer=name)
        print(f"layer {name!r}: {geom}, {info['features']} features, crs {info['crs']}")
        print("  fields:", list(info["fields"]))
        df = pyogrio.read_dataframe(path, layer=name, read_geometry=False)
        for col in df.columns:
            vals = df[col].dropna()
            if vals.dtype == object and 1 < vals.nunique() <= 60:
                print(f"  {col}: {dict(Counter(vals).most_common(60))}")


def probe_mars() -> None:
    print(f"\n== Mars SIM3292 (OGC API): {MARS_UNITS}")
    meta = get_json(MARS_UNITS + "?f=json")
    print("  extent:", json.dumps(meta.get("extent"))[:400])
    print("  crs:", meta.get("crs") or meta.get("storageCrs"))
    units: Counter = Counter()
    offset, sample = 0, None
    while True:
        page = get_json(f"{MARS_UNITS}/items?f=json&skipGeometry=true&limit=500&offset={offset}")
        feats = page.get("features", [])
        if not feats:
            break
        sample = sample or feats[0]["properties"]
        for f in feats:
            props = f["properties"]
            key = next((props[k] for k in ("UnitSymbol", "Unit", "unit", "FIRST_Unit", "UnitLabel") if k in props), None)
            units[key] += 1
        offset += len(feats)
        if len(feats) < 500:
            break
    print("  properties of one feature:", json.dumps(sample)[:600])
    print(f"  {offset} polygons; unit symbols and polygon counts:", dict(sorted(units.items(), key=lambda kv: str(kv[0]))))


def probe_macrostrat() -> None:
    print(f"\n== Macrostrat (fallback for Earth): {MACROSTRAT_EXAMPLE}")
    data = get_json(MACROSTRAT_EXAMPLE)
    for u in data.get("success", {}).get("data", [])[:3]:
        print("  ", {k: u.get(k) for k in ("source_id", "name", "lith", "scale", "t_int_name", "b_int_name")})


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--glim", help="GLiM / Lithological Map of the World vector file (.gdb folder, .gpkg or .shp)")
    args = ap.parse_args()
    for step in ([lambda: probe_glim(args.glim)] if args.glim else []) + [probe_mars, probe_macrostrat]:
        try:
            step()
        except Exception as e:  # report and go on: each source is independent
            print(f"  failed: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
