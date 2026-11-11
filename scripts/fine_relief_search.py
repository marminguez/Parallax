"""Fine relief for search results v1 (config/search/fine_relief_search_v1.yaml).

Measures the Earth side of the 60 m slope fingerprint (Copernicus GLO-30) for the
windows a team is most likely to see, with the characterization v1 code unchanged,
and compares each with the 60 m fingerprints of the 11 search references already
published on the twin sheets.

Every invocation first runs check F1 on the 21 VAL-004 twins (published values).

    # 1. F1 and timing only (no new window is measured)
    python scripts/fine_relief_search.py --twins-only

    # 2. Full run (resumable; Ctrl-C is safe)
    python scripts/fine_relief_search.py --workers 6

    # 3. Outputs
    python scripts/fine_relief_search.py --assemble

Outputs:
  results/fine_relief/partial.csv          one row per window as it is measured (resume point, gitignored)
  results/fine_relief/checks_v1.json       F1 and timing
  results/fine_relief/fine_relief_v1.json  windows, pairs, P1-P3, provenance (with --assemble)
  web/data/fine-relief.json                what the search shows (with --assemble)
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parallax import characterize as ch  # noqa: E402
from parallax.matching.similarity import jensen_shannon_distance  # noqa: E402

CONFIG = ROOT / "config/search/fine_relief_search_v1.yaml"
INDEX = ROOT / "web/data/earth-index.csv"
SHEETS = ROOT / "results/characterization/twin_sheets_v1.json"
REACHABLE = ROOT / "results/campaign/reachable_twins_v1.json"
ARTEMIS = ROOT / "web/data/artemis-references.json"
OUT = ROOT / "results/fine_relief"
PARTIAL = OUT / "partial.csv"
OUT_WEB = ROOT / "web/data/fine-relief.json"
BINS = ["0-1", "1-2", "2-3", "3-5", "5-10", "10-15", "15-20", ">=20"]
TOP = 50
TOL = 5e-7


# --------------------------------------------------------------------------- references and selection


def target_hist(path: Path) -> np.ndarray:
    pct = json.loads(path.read_text())["terrain"]["1000m"]["slope"]["distribution_pct"]
    return np.array([float(pct[b]) for b in BINS])


def references() -> dict[str, dict]:
    """The 11 search references: 1 km histogram (ranking), destination whose sheet holds the 60 m fingerprint, body."""
    refs = {
        "jezero": {"hist": target_hist(ROOT / "web/data/jezero-target.json"), "sheet": "perseverance", "body": "mars"},
        "shackleton": {"hist": target_hist(ROOT / "web/data/shackleton-target.json"), "sheet": "shackleton", "body": "moon"},
    }
    for r in json.loads(ARTEMIS.read_text())["regions"]:
        refs[r["id"]] = {"hist": target_hist(ROOT / f"web/data/artemis/{r['id']}.json"), "sheet": r["id"], "body": "moon"}
    return refs


def load_index(path: Path = INDEX) -> list[dict]:
    out = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            out.append({"id": r["id"], "lat": float(r["lat"]), "lon": float(r["lon"]),
                        "hist": np.array([float(r[b]) for b in BINS]),
                        "bare": None if r["bare_share"] == "" else float(r["bare_share"]),
                        "ice": None if r["ice_signal"] == "" else r["ice_signal"] == "true"})
    return out


def rank(index: list[dict], ref_id: str, ref: dict, drilling: bool = False) -> list[str]:
    """The web search's order: no conditions (or bare >= 0.5 and permafrost), distance limit 1, no slope limit."""
    rows = []
    for w in index:
        if drilling and not (w["bare"] is not None and w["bare"] >= 0.5 and w["ice"] is True):
            continue
        d = float(jensen_shannon_distance(ref["hist"], w["hist"]))
        if d > 1:
            continue
        key = 0.5 * d + 0.5 * (1 - w["bare"]) if ref_id == "jezero" and w["bare"] is not None else d
        rows.append((key, w["id"]))
    rows.sort()
    return [i for _, i in rows[:TOP]]


def twin_ids() -> dict[str, str]:
    return {d["id"]: d["val004_twin"]["id"] for d in json.loads(REACHABLE.read_text())["destinations"]}


def selection(index: list[dict], refs: dict[str, dict]) -> dict[str, list[str]]:
    """Window id -> the sets that selected it (top_50:<ref>, top_50_drilling:<ref>, twin:<destination>)."""
    why: dict[str, list[str]] = {}
    for rid, ref in refs.items():
        for i in rank(index, rid, ref):
            why.setdefault(i, []).append(f"top_50:{rid}")
        if ref["body"] == "moon":
            for i in rank(index, rid, ref, drilling=True):
                why.setdefault(i, []).append(f"top_50_drilling:{rid}")
    for dest, i in twin_ids().items():
        why.setdefault(i, []).append(f"twin:{dest}")
    return why


# --------------------------------------------------------------------------- measuring


def measure(w: dict, args) -> dict:
    from parallax.characterize import sources

    try:
        return {"status": "measured", **ch.fine_fingerprint(sources.earth_fine_window(w["lat"], w["lon"], args.copernicus_root))}
    except Exception as e:  # recorded, never filled in
        return {"status": "error", "reason": f"{type(e).__name__}: {e}"[:300]}


def same(new, old) -> bool:
    if isinstance(old, dict):
        return isinstance(new, dict) and all(k in new and same(new[k], v) for k, v in old.items())
    if isinstance(old, list):
        return isinstance(new, list) and len(new) == len(old) and all(same(a, b) for a, b in zip(new, old))
    if isinstance(old, (int, float)) and not isinstance(old, bool) and isinstance(new, (int, float)):
        return abs(float(new) - float(old)) <= TOL
    return new == old


def check_f1(index_by_id: dict, args) -> dict:
    sheets = json.loads(SHEETS.read_text())["sheets"]
    rows, t0 = [], time.perf_counter()
    for dest, wid in twin_ids().items():
        fine = sheets[dest]["dimensions"]["fine_relief"]
        new = measure(index_by_id[wid], args)
        new.pop("status", None)
        ok = same(new, fine["earth"])
        if ok and fine["status"] == "measured":
            again = ch.fine_relief(new, fine["planet"])
            ok = abs(again["distance"] - fine["distance"]) <= TOL and again["verdict"] == fine["verdict"]
        rows.append({"dest": dest, "ok": ok, **({} if ok else {"new": new, "published": fine["earth"]})})
    secs = time.perf_counter() - t0
    return {"pass": all(r["ok"] for r in rows), "twins": len(rows), "failed": [r for r in rows if not r["ok"]],
            "seconds_per_window": round(secs / max(1, len(rows)), 2)}


def read_partial() -> dict[str, dict]:
    out: dict[str, dict] = {}
    if PARTIAL.exists():
        with PARTIAL.open(newline="") as f:
            for r in csv.DictReader(f):
                out[r["id"]] = json.loads(r["value"])
    return out


def run(windows: list[dict], args) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    done = read_partial()
    todo = [w for w in windows if w["id"] not in done or (args.retry_errors and done[w["id"]]["status"] == "error")]
    print(f"fine relief: {len(windows) - len(todo)} already done, {len(todo)} to measure", flush=True)
    new_file = not PARTIAL.exists()
    with PARTIAL.open("a", newline="") as f:
        out = csv.writer(f)
        if new_file:
            out.writerow(["id", "status", "value"])
        t0, n = time.perf_counter(), 0
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            futures = {pool.submit(measure, w, args): w["id"] for w in todo}
            for fut in as_completed(futures):
                v = fut.result()
                out.writerow([futures[fut], v["status"], json.dumps(v, separators=(",", ":"))])
                f.flush()
                n += 1
                if n % 25 == 0 or n == len(todo):
                    rate = n / (time.perf_counter() - t0)
                    print(f"  {n}/{len(todo)} ({rate:.2f}/s, ~{(len(todo) - n) / max(rate, 1e-9) / 60:.0f} min left)", flush=True)


# --------------------------------------------------------------------------- assembling


def predictions(pairs: dict[str, dict[str, dict]], why: dict[str, list[str]], refs: dict[str, dict]) -> dict:
    lunar = [ref for ref, r in refs.items() if r["body"] == "moon"]
    moon_pairs = [p for w in pairs.values() for ref, p in w.items() if ref in lunar and p["status"] == "measured"]
    holds = sum(p["verdict"] == "holds" for p in moon_pairs)
    p1 = holds / len(moon_pairs) if moon_pairs else None
    with_partly = sorted({ref for w in pairs.values() for ref, p in w.items() if ref in lunar and p["status"] == "measured" and p["verdict"] in ("holds", "partly")})
    jez = [pairs[i]["jezero"] for i, tags in why.items() if "top_50:jezero" in tags and i in pairs and pairs[i]["jezero"]["status"] == "measured"]
    jez_ok = sum(p["verdict"] in ("holds", "partly") for p in jez)
    return {
        "P1_moon_rarely_holds": {"pairs": len(moon_pairs), "holds": holds, "share": None if p1 is None else round(p1, 4), "supported": p1 is not None and p1 <= 0.05},
        "P2_moon_somewhere_partly": {"references": with_partly, "supported": len(with_partly) >= 1},
        "P3_jezero_holds": {"measured": len(jez), "holds_or_partly": jez_ok, "supported": len(jez) > 0 and jez_ok >= len(jez) / 2},
    }


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


def assemble(windows: list[dict], why: dict[str, list[str]], refs: dict[str, dict]) -> None:
    done = read_partial()
    missing = [w["id"] for w in windows if w["id"] not in done]
    if missing:
        raise SystemExit(f"{len(missing)} windows not attempted yet; run the measurement first.")
    sheets = json.loads(SHEETS.read_text())["sheets"]
    ref_fine = {rid: sheets[r["sheet"]]["dimensions"]["fine_relief"]["planet"] for rid, r in refs.items()}
    pairs, web_windows = {}, {}
    for w in windows:
        v = done[w["id"]]
        earth = {k: v.get(k) for k in ("histogram", "steep_share", "valid_share")} if v["status"] == "measured" else None
        pairs[w["id"]] = {}
        for rid in refs:
            out = ch.fine_relief(earth, ref_fine[rid])
            pairs[w["id"]][rid] = {k: out[k] for k in ("status", "distance", "verdict", "reason") if k in out}
        web_windows[w["id"]] = {"status": v["status"] if v["status"] != "measured" or ch.fine_relief(earth, ref_fine["shackleton"])["status"] == "measured" else "not_measured",
                                "steep": earth["steep_share"] if earth else None,
                                "d": {rid: p.get("distance") for rid, p in pairs[w["id"]].items()}}
    checks = json.loads((OUT / "checks_v1.json").read_text()) if (OUT / "checks_v1.json").exists() else {}
    preds = predictions(pairs, why, refs)
    coverage = {s: sum(1 for w in windows if done[w["id"]]["status"] == s) for s in ("measured", "error")}
    coverage["valid"] = sum(1 for w in web_windows.values() if w["status"] == "measured")
    run = {"version": "fine_relief_search_v1", "config": str(CONFIG.relative_to(ROOT)), "commit": git_commit(),
           "assembled_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "windows": len(windows),
           "coverage": coverage, "checks": checks, "predictions": preds,
           "selected_by": why, "window_values": {w["id"]: done[w["id"]] for w in windows}, "pairs": pairs}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "fine_relief_v1.json").write_text(json.dumps(run, indent=1))
    OUT_WEB.write_text(json.dumps({
        "version": "fine_relief_search_v1", "bands": {"holds": 0.10, "partly": 0.30}, "roverSlopeDeg": 15,
        "references": {rid: {"sheet": refs[rid]["sheet"], "steep": ref_fine[rid]["steep_share"]} for rid in refs},
        "windows": web_windows}, separators=(",", ":")))
    print(json.dumps({"coverage": coverage, "predictions": preds}, indent=1))


# --------------------------------------------------------------------------- main


def parse(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--twins-only", action="store_true", help="run F1 and timing only")
    p.add_argument("--assemble", action="store_true", help="write the outputs")
    p.add_argument("--copernicus-root", default=None, help="local GLO-30 tiles (default: public AWS bucket)")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--retry-errors", action="store_true")
    return p.parse_args(argv)


def main(argv=None) -> None:
    args = parse(argv)
    index = load_index()
    by_id = {w["id"]: w for w in index}
    refs = references()
    why = selection(index, refs)
    windows = [by_id[i] for i in sorted(why)]
    print(f"{len(windows)} windows selected for 60 m relief", flush=True)
    if args.assemble:
        assemble(windows, why, refs)
        return
    f1 = check_f1(by_id, args)
    f1["run_at"], f1["commit"] = datetime.now(timezone.utc).isoformat(timespec="seconds"), git_commit()
    f1["projected_minutes_1_worker"] = round(f1["seconds_per_window"] * len(windows) / 60)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "checks_v1.json").write_text(json.dumps({"F1": f1}, indent=1))
    print(f"F1: {'PASS' if f1['pass'] else 'FAIL'} ({f1['twins']} twins, {f1['seconds_per_window']} s/window, "
          f"~{f1['projected_minutes_1_worker']} min for {len(windows)} windows with 1 worker)", flush=True)
    if not f1["pass"]:
        print(json.dumps(f1["failed"], indent=1)[:3000])
        raise SystemExit("F1 failed: no new window is measured (fine_relief_search_v1.yaml, checks.F1).")
    if not args.twins_only:
        run(windows, args)


if __name__ == "__main__":
    main()
