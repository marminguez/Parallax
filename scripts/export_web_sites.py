"""Export the destination, region and evidence data the public web pages need.

Reads the frozen VAL-004 outputs (results/validation/val004_reverse_map.json and
results/val004/*_twins.csv) and writes web/data/val004-sites.json. Nothing is
recomputed: every distance and class comes from the twins stage.

    python scripts/export_web_sites.py            # data and place labels (works anywhere, a few minutes)
    python scripts/export_web_sites.py --thumbs   # also render missing Moon/Mars thumbnails
                                                  # for the destinations (needs the local DEMs)

Place names are the nearest GeoNames settlement (display only). Mars feature
labels for the hardest windows are nearest-feature tags for orientation, read
after the run; they are not part of any statistic.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

from parallax.places import describe  # noqa: E402

RESULT = ROOT / "results/validation/val004_reverse_map.json"
OUT_DIR = ROOT / "results/val004"
OVERLAYS = ROOT / "config/validation/val004_overlays_v1.yaml"
OUTPUT = ROOT / "web/data/val004-sites.json"

# Approximate centres of named Mars features, used only to tag the hardest windows.
MARS_FEATURES = [
    ("Olympus Mons", 18.65, -133.8),
    ("Elysium Mons", 25.0, 147.2),
    ("Hecates Tholus", 32.1, 150.2),
    ("Arsia Mons", -8.3, -120.1),
    ("Pavonis Mons", 1.5, -113.0),
    ("Ascraeus Mons", 11.9, -104.1),
    ("Ceraunius Tholus", 24.0, -97.4),
]
MARS_R_KM = 3396.19


def gc_km(lat1, lon1, lat2, lon2, r_km):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r_km * math.asin(min(1.0, math.sqrt(a)))


def mars_feature(lat: float, lon: float) -> str:
    name, km = min(((n, gc_km(lat, lon, la, lo, MARS_R_KM)) for n, la, lo in MARS_FEATURES), key=lambda x: x[1])
    if km <= 450:
        return name
    if -16 <= lat <= -2 and -95 <= lon <= -35:
        return "Valles Marineris"
    return "Tharsis" if -20 <= lat <= 45 and -140 <= lon <= -80 else "Other"


def place(lat: float, lon: float) -> dict:
    p = describe(lat, lon)
    return {"nearest": p["nearest"], "admin1": p["admin1"], "cc": p["countryCode"], "km": round(float(p["distanceKm"]), 1)}


def destination(o: dict, name: str, kind: str, body: str, pairs: list[float]) -> dict:
    e = o["earth_twin"]
    return {
        "id": o["id"], "name": name, "kind": kind, "body": body,
        "lat": o.get("lat"), "lon": o.get("lon"), "window": o["window"], "windowKm": o.get("window_centre_km"),
        "distance": round(o["distance"], 4), "cls": o["class"],
        "closerThan": sum(1 for p in pairs if p > o["distance"]), "ofPairs": len(pairs),
        "earth": {"lat": round(e["lat"], 4), "lon": round(e["lon"], 4), **place(e["lat"], e["lon"])},
    }


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--thumbs", action="store_true")
    args = parser.parse_args()

    r = json.loads(RESULT.read_text(encoding="utf-8"))
    overlays = yaml.safe_load(OVERLAYS.read_text(encoding="utf-8"))
    # The 18 validated analog-to-target distances, exactly as exported by the twins stage.
    pairs = sorted(json.loads((ROOT / "web/public/reverse/summary.json").read_text(encoding="utf-8"))["validatedPairs"])

    names = {x["id"]: x["name"] for x in overlays["artemis_iii_regions"]["regions"]}
    pos = {x["id"]: (x["lat"], x["lon"]) for x in overlays["artemis_iii_regions"]["regions"]}
    mars_names = {x["id"]: (x["name"], x.get("kind", "landed"), x["lat"], x["lon"]) for x in overlays["mars_landing_sites"]["sites"] + overlays["mars_landing_sites"].get("also", [])}
    moon_ref = {x["id"]: x for x in overlays["moon_reference"]}

    dests = []
    for o in r["overlays"]["moon_reference"]:
        d = destination({**o, "lat": moon_ref[o["id"]]["lat"], "lon": moon_ref[o["id"]]["lon"]}, moon_ref[o["id"]]["name"], "reference", "moon", pairs)
        dests.append(d)
    for o in r["overlays"]["artemis_iii"]:
        if o["status"] != "evaluated":
            continue
        la, lo = pos[o["id"]]
        dests.append(destination({**o, "lat": la, "lon": lo}, names[o["id"]], "artemis", "moon", pairs))
    for o in r["overlays"]["mars_sites"]:
        if o["status"] != "evaluated":
            continue
        n, kind, la, lo = mars_names[o["id"]]
        dests.append(destination({**o, "lat": la, "lon": lo}, n, "reference" if o["id"] == "perseverance" else kind, "mars", pairs))

    # Hardest windows: the Mars windows without a strong twin, and the five farthest Moon windows.
    mars = read_csv(OUT_DIR / "mars_twins.csv")
    moon = read_csv(OUT_DIR / "moon_twins.csv")
    hard_mars = sorted((w for w in mars if w["class"] != "strong_twin"), key=lambda w: -float(w["distance"]))
    hard = {
        "mars": [{"id": w["id"], "lat": round(float(w["lat"]), 3), "lon": round(float(w["lon"]), 3), "distance": round(float(w["distance"]), 4), "cls": w["class"], "feature": mars_feature(float(w["lat"]), float(w["lon"]))} for w in hard_mars],
        "moon": [{"id": w["id"], "lat": round(float(w["lat"]), 3), "lon": round(float(w["lon"]), 3), "distance": round(float(w["distance"]), 4), "cls": w["class"]} for w in sorted(moon, key=lambda w: -float(w["distance"]))[:5]],
    }
    features: dict[str, int] = {}
    for w in hard["mars"]:
        features[w["feature"]] = features.get(w["feature"], 0) + 1

    # Earth percentiles: where any Earth window's distance sits among all eligible windows (lower = more alike).
    earth = [w for w in read_csv(OUT_DIR / "earth_twins.csv") if w["eligible"] == "True"]
    q = np.linspace(0, 100, 201)
    pct = {b: [round(float(v), 5) for v in np.percentile([float(w[f"{b}_distance"]) for w in earth], q)] for b in ("moon", "mars")}

    out = {
        "id": "VAL-004", "run_at": r["run_at"], "source": "results/validation/val004_reverse_map.json",
        "headline": {b: {"windows": r["bodies"][b]["windows"], "strong": r["bodies"][b]["shares"]["strong_twin"], "median": round(r["bodies"][b]["distance_median"], 4), "bridgePassed": r["bodies"][b]["bridge_passed"]} for b in ("moon", "mars")},
        "earth": r["earth"], "thresholds": r["thresholds"], "pairs": pairs,
        "predictions": {k: v.get("supported") for k, v in r["predictions"].items()},
        "destinations": dests, "hardest": hard, "hardestFeatures": features,
        "earthPercentiles": {"step": 0.5, **pct},
        "valencia": r["valencia"],
    }
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(dests)} destinations, {len(hard['mars'])} hardest Mars windows, {len(earth)} eligible Earth windows")

    export_place_tiles()
    if args.thumbs:
        render_thumbs(dests, hard)


def export_place_tiles() -> None:
    """Nearest GeoNames settlement for every Earth window shown on the public pages, one file per Earth tile.

    Arrays are aligned with web/public/reverse/earth/<tile>.json. Display only.
    """
    src = ROOT / "web/public/reverse/earth"
    dst = ROOT / "web/public/reverse/places"
    dst.mkdir(parents=True, exist_ok=True)
    n = 0
    for tile in sorted(src.glob("*.json")):
        t = json.loads(tile.read_text(encoding="utf-8"))
        rows = [describe(la, lo) for la, lo in zip(t["lat"], t["lon"])]
        out = {"n": [r["nearest"] for r in rows], "a": [r["admin1"] for r in rows], "c": [r["countryCode"] for r in rows], "k": [round(r["distanceKm"]) for r in rows]}
        (dst / tile.name).write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        n += len(rows)
    print(f"Place labels: {n} Earth windows in {len(list(src.glob('*.json')))} tiles")


def render_thumbs(dests: list[dict], hard: dict) -> None:
    """Display only: shaded-relief thumbnails for destination windows that no Earth window points to."""
    import run_val004 as run
    from parallax import reverse as rv
    from parallax.reverse.readers import MarsDEM

    moon_dem = run.dem_source(run.MOON_DEM_LOCAL, run.MOON_DEM_URL, None)
    mars_dem = run.dem_source(run.MARS_DEM_LOCAL, run.MARS_DEM_URL, None)
    moon_rows = {w["id"]: w for w in read_csv(OUT_DIR / "moon_windows.csv")}
    folder = run.WEB / "thumbs"
    want_moon = [moon_rows[d["window"]] for d in dests if d["body"] == "moon"] + [moon_rows[w["id"]] for w in hard["moon"]]
    todo_moon = [{"id": w["id"], "lat": float(w["lat"]), "lon": float(w["lon"])} for w in want_moon if not (folder / "moon" / f"{w['id']}.jpg").exists()]
    if todo_moon:
        run.thumbs_moon(todo_moon, folder / "moon", moon_dem)
    want_mars = [(d["window"], d["lat"], d["lon"]) for d in dests if d["body"] == "mars"] + [(w["id"], w["lat"], w["lon"]) for w in hard["mars"]]
    mars_rows = {w["id"]: w for w in read_csv(OUT_DIR / "mars_windows.csv")}
    todo_mars = [(i, float(mars_rows[i]["lat"]), float(mars_rows[i]["lon"])) for i, _, _ in want_mars if not (folder / "mars" / f"{i}.jpg").exists()]
    if todo_mars:
        with MarsDEM(mars_dem) as m:
            for i, la, lo in todo_mars:
                elev = run.mars_thumb_elevation(m, la, lo)
                run.save_png(np.repeat(rv.hillshade(elev, 200.0, altitude_deg=25.0)[..., None], 3, axis=2), folder / "mars" / f"{i}.jpg", quality=78)
    print(f"Thumbnails rendered: {len(todo_moon)} Moon, {len(todo_mars)} Mars")


if __name__ == "__main__":
    main()
