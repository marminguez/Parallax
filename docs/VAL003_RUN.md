# VAL-003 — how to run

Pre-registration: [`config/validation/atlas_sites_v1.yaml`](../config/validation/atlas_sites_v1.yaml) (committed before evaluation).
Script: `scripts/run_val003.py` (one command, resumable, cached in `results/val003/cache/`).

From the repository root, in the Python environment used for live evaluation, with the local SRTMGL30/MOD44W data:

```bash
python scripts/run_val003.py --plan    # counts only, no network
python scripts/run_val003.py --check   # one window + one site; must end with CHECK OK
nohup python scripts/run_val003.py > results/val003/overnight.log 2>&1 &
```

Land cover is read from ESA WorldCover's public cloud tiles, only the 50 km window (no multi-GB downloads); local tiles in `data/earth/worldcover/raw` are used when present. If the run stops, start it again: finished windows are not recomputed.

Outputs: `results/validation/val003_atlas_sites.json` and `.csv`, plus `results/val003/run.log`. Commit `results/validation/` and `results/val003/run.log` (the cache can stay local).
