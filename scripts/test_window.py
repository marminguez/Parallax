"""Test window v1 (config/search/test_window_v1.yaml): how long a team can rehearse at a site.

Two windows from NASA POWER monthly climatology:
  general  logistics_v1's workable month, unchanged (every category but ISRU)
  frozen   TS <= 0, T2M_MIN >= -25, PRECTOTCORR <= 3 (ISRU)

    python scripts/test_window.py --check-only   # W1 only: offline, from results/campaign/logistics_v1.json
    python scripts/test_window.py                # W1, W2 and P1-P3 on the 21 twins (24 small POWER requests)

Output: results/test_window/twins_v1.json and web/data/test-window-twins.json (only if W1 and W2 pass).
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from campaign_field import day_length_h, MID_MONTH_DOY  # noqa: E402

CONFIG = ROOT / "config/search/test_window_v1.yaml"
LOGISTICS = ROOT / "results/campaign/logistics_v1.json"
REACHABLE = ROOT / "results/campaign/reachable_twins_v1.json"
INDEX = ROOT / "web/data/earth-index.csv"
CACHE = ROOT / "data/cache/power_test_window"
OUT = ROOT / "results/test_window/twins_v1.json"
OUT_WEB = ROOT / "web/data/test-window-twins.json"
POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
PARAMS = "T2M_MIN,T2M_MAX,PRECTOTCORR,TS"
USER_AGENT = "Parallax-NASA-Space-Apps-2026/1.0 (research prototype)"
MONTHS = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
DAYS = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
FILL = -999.0
SHACKLETON_TWIN = "EARTH-133851"
W2_SITES = 3


# ------------------------------------------------------------------ frozen rules (tested)

def general_month(tmin: float, tmax: float, rain: float) -> bool:
    """logistics_v1 workable month, unchanged."""
    return tmin >= -10.0 and tmax <= 35.0 and rain <= 3.0


def frozen_month(ts: float, tmin: float, rain: float) -> bool:
    return ts <= 0.0 and tmin >= -25.0 and rain <= 3.0


def runs(flags: list[bool]) -> list[tuple[int, int]]:
    """Runs of consecutive True months as (start, end) month indexes, December running into January."""
    if all(flags):
        return [(0, 11)]
    if not any(flags):
        return []
    start = next(i for i in range(12) if not flags[i])  # begin after a gap so wrapping runs stay whole
    out, cur = [], None
    for k in range(1, 13):
        i = (start + k) % 12
        if flags[i] and cur is None:
            cur = i
        if not flags[i] and cur is not None:
            out.append((cur, (i - 1) % 12)); cur = None
    if cur is not None:
        out.append((cur, start))
    return sorted(out)


def run_days(r: tuple[int, int]) -> int:
    a, b = r
    idx = range(a, b + 1) if a <= b else [*range(a, 12), *range(0, b + 1)]
    return sum(DAYS[i] for i in idx)


def window(flags: list[bool], lat: float) -> dict:
    rs = runs(flags)
    light = [round(day_length_h(lat, MID_MONTH_DOY[i]), 1) for i in range(12) if flags[i]]
    return {"months": [MONTHS[i] for i in range(12) if flags[i]],
            "runs": [[MONTHS[a], MONTHS[b]] for a, b in rs],
            "days_per_year": sum(DAYS[i] for i in range(12) if flags[i]),
            "longest_block_days": max((run_days(r) for r in rs), default=0),
            "daylight_h": [min(light), max(light)] if light else None}


def windows(monthly: dict, lat: float) -> dict:
    """monthly: {T2M_MIN: [12], T2M_MAX: [12], PRECTOTCORR: [12], TS: [12]} -> both windows. A month with a fill value is in neither."""
    ok = [all(monthly[k][i] is not None and monthly[k][i] > -900 for k in monthly) for i in range(12)]
    g = [ok[i] and general_month(monthly["T2M_MIN"][i], monthly["T2M_MAX"][i], monthly["PRECTOTCORR"][i]) for i in range(12)]
    f = [ok[i] and frozen_month(monthly["TS"][i], monthly["T2M_MIN"][i], monthly["PRECTOTCORR"][i]) for i in range(12)]
    return {"general": window(g, lat), "frozen": window(f, lat)}


def monthly_from_power(payload: dict) -> dict:
    p = payload["properties"]["parameter"]
    return {k: [float(p[k][m]) for m in MONTHS] for k in PARAMS.split(",")}


# ------------------------------------------------------------------ checks

CAMPAIGN_CACHE = ROOT / "data/cache/power_campaign"
THRESHOLDS = {"tmin": -10.0, "tmax": 35.0, "rain": 3.0}


def check_w1() -> dict:
    """The general rule reproduces every published workable month (amendment v1.1): on the raw POWER
    responses logistics_v1 used when all are cached, else on the stored values with threshold-boundary months set aside."""
    sites = json.loads(LOGISTICS.read_text())["sites"]
    raw = all((CAMPAIGN_CACHE / f"{sid}.json").exists() for sid in sites)
    mismatches, boundary = [], []
    for sid, s in sites.items():
        vals = None
        if raw:
            p = json.loads((CAMPAIGN_CACHE / f"{sid}.json").read_text())["properties"]["parameter"]
            vals = [(float(p["T2M_MIN"][m]), float(p["T2M_MAX"][m]), float(p["PRECTOTCORR"][m])) for m in MONTHS]
        for i, m in enumerate(s["calendar"]["months"]):
            tmin, tmax, rain = vals[i] if raw else (m["tmin"], m["tmax"], m["rain"])
            if general_month(tmin, tmax, rain) == m["workable"]:
                continue
            row = {"site": sid, "month": m["month"], "tmin": tmin, "tmax": tmax, "rain": rain, "published": m["workable"]}
            on_edge = not raw and any(m[k] == v for k, v in THRESHOLDS.items())
            (boundary if on_edge else mismatches).append(row)
    return {"pass": not mismatches, "source": "raw POWER cache" if raw else "stored values (rounded)", "sites": len(sites),
            "months": 12 * len(sites), "mismatches": mismatches, "boundary_months": boundary}


# ------------------------------------------------------------------ network (cached)

def power(wid: str, lat: float, lon: float) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{wid}.json"
    if not path.exists():
        q = urllib.parse.urlencode({"parameters": PARAMS, "community": "AG", "longitude": f"{lon:.4f}", "latitude": f"{lat:.4f}", "format": "JSON"})
        last = None
        for attempt in range(5):
            try:
                with urllib.request.urlopen(urllib.request.Request(f"{POWER_URL}?{q}", headers={"User-Agent": USER_AGENT}), timeout=120) as r:
                    path.write_bytes(r.read())
                break
            except (urllib.error.URLError, TimeoutError) as e:
                last = e; time.sleep(10 * (attempt + 1))
        else:
            raise RuntimeError(f"NASA POWER {wid}: {last}")
        time.sleep(2)
    return json.loads(path.read_text())


def index_coords() -> dict[str, tuple[float, float]]:
    with INDEX.open(newline="") as f:
        return {r["id"]: (float(r["lat"]), float(r["lon"])) for r in csv.DictReader(f)}


def twins() -> list[dict]:
    return [{"dest": d["id"], "body": d.get("body"), "id": d["val004_twin"]["id"]} for d in json.loads(REACHABLE.read_text())["destinations"]]


def run() -> None:
    w1 = check_w1()
    print(f"W1: {'PASS' if w1['pass'] else 'FAIL'} ({w1['months']} months of {w1['sites']} sites, {w1['source']}; "
          f"{len(w1['mismatches'])} mismatches, {len(w1['boundary_months'])} on a threshold)", flush=True)
    coords = index_coords()
    stored = json.loads(LOGISTICS.read_text())["sites"]
    w2 = []
    for sid in sorted(stored)[:W2_SITES]:
        lat, lon = coords[sid]
        mon = monthly_from_power(power(sid, lat, lon))
        diffs = [abs(mon[k][i] - m[f]) for i, m in enumerate(stored[sid]["calendar"]["months"]) for k, f in (("T2M_MIN", "tmin"), ("T2M_MAX", "tmax"), ("PRECTOTCORR", "rain"))]
        w2.append({"site": sid, "max_abs_diff": round(max(diffs), 3), "ok": max(diffs) <= 0.1 + 1e-9})
    w2_pass = all(x["ok"] for x in w2)
    print(f"W2: {'PASS' if w2_pass else 'FAIL'} {w2}", flush=True)
    rows = []
    for t in twins():
        lat, lon = coords[t["id"]]
        win = windows(monthly_from_power(power(t["id"], lat, lon)), lat)
        rows.append({**t, "lat": lat, "lon": lon, **win})
        print(f"  {t['dest']:<22} general {win['general']['days_per_year']:>3} d ({'-'.join(map(str, win['general']['runs'])) or 'none'})"
              f"   frozen {win['frozen']['days_per_year']:>3} d ({'-'.join(map(str, win['frozen']['runs'])) or 'none'})", flush=True)
    lunar = [r for r in rows if r["dest"] in LUNAR]
    shack = next(r for r in rows if r["id"] == SHACKLETON_TWIN)
    g_med = statistics.median(r["general"]["days_per_year"] for r in rows)
    f_med = statistics.median(r["frozen"]["days_per_year"] for r in rows)
    preds = {
        "P1_shackleton_twin_freezes": {"months": len(shack["frozen"]["months"]), "holds": len(shack["frozen"]["months"]) >= 3},
        "P2_not_every_lunar_twin_freezes": {"empty": [r["dest"] for r in lunar if not r["frozen"]["months"]], "holds": any(not r["frozen"]["months"] for r in lunar)},
        "P3_frozen_is_shorter": {"median_general_days": g_med, "median_frozen_days": f_med, "holds": f_med < g_med},
    }
    print(json.dumps(preds, indent=1))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"config": str(CONFIG.relative_to(ROOT)), "commit": git_commit(),
                               "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                               "W1": w1, "W2": {"pass": w2_pass, "sites": w2}, "predictions": preds, "twins": rows}, indent=1, ensure_ascii=False))
    if not (w1["pass"] and w2_pass):
        print("W1 or W2 fails: web/data/test-window-twins.json is not written (test_window_v1.yaml, checks).")
        return
    OUT_WEB.write_text(json.dumps({r["dest"]: {"general": r["general"], "frozen": r["frozen"]} for r in rows}, indent=1) + "\n")
    print(f"wrote {OUT_WEB.relative_to(ROOT)}")


LUNAR = {"shackleton", "peak-near-cabeus-b", "haworth", "malapert-massif", "mons-mouton-plateau", "mons-mouton", "nobile-rim-1", "nobile-rim-2", "de-gerlache-rim-2", "slater-plain"}


def git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--check-only", action="store_true")
    a = p.parse_args(argv)
    if a.check_only:
        w1 = check_w1()
        print(f"W1: {'PASS' if w1['pass'] else 'FAIL'} ({w1['months']} months of {w1['sites']} sites, {w1['source']}; "
              f"{len(w1['mismatches'])} mismatches, {len(w1['boundary_months'])} on a threshold)")
        for m in w1["mismatches"] + w1["boundary_months"]:
            print("  ", m)
        return
    run()


if __name__ == "__main__":
    main()
