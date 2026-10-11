import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { NextResponse } from "next/server";
import { validateRequest, rankTerrain, Measurement, SearchResult } from "@/lib/search";
import { findFacilities } from "@/lib/facilities";

export const runtime = "nodejs";
export const maxDuration = 120;
const execute = promisify(execFile);
let liveBusy = false;

export async function POST(req: Request) {
  let body;
  try {
    const text = await req.text();
    if (text.length > 15000) return NextResponse.json({ error: "Experiment is too large." }, { status: 413 });
    body = validateRequest(JSON.parse(text));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid experiment." }, { status: 400 });
  }
  try {
    const createdAt = new Date().toISOString();
    const runId = randomUUID();
    if (body.mode === "facilities") {
      const result = findFacilities(body);
      return NextResponse.json({
        ...result, runId, createdAt, request: body, errors: [],
        provenance: { dataset: "NASA documented capabilities catalogue (3 centres)", version: "2026-10-11", footprintKm: null, resolutionM: null, scope: "Capability discovery only. Operator approval, availability and exact test envelope are not verified.", ranking: "Exact experiment capability + geographic filter; alphabetical catalogue order, no suitability score." },
      } satisfies SearchResult);
    }
    let rows: Measurement[];
    let errors: { id: string; message: string }[] = [];
    let version: string;
    if (body.mode === "live") {
      if (liveBusy) return NextResponse.json({ error: "A live evaluation is already running. Please retry after it finishes." }, { status: 429 });
      liveBusy = true;
      try {
        const root = path.resolve(process.cwd(), "..");
        const { stdout } = await execute(process.env.PARALLAX_PYTHON || "python", [
          path.join(root, "scripts", "search_candidates.py"),
          "--west", String(body.west), "--east", String(body.east),
          "--south", String(body.south), "--north", String(body.north),
        ], {
          cwd: root, timeout: 110000, maxBuffer: 2 * 1024 * 1024,
          env: { ...process.env, PYTHONPATH: [path.join(root, "src"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) },
        });
        const output = JSON.parse(stdout);
        rows = output.rows; errors = output.errors;
        version = createHash("sha256").update(stdout).digest("hex");
      } catch (e) {
        const err = e as Error & { stderr?: string };
        console.error("Live terrain evaluation failed", err.message);
        return NextResponse.json({ error: "Live evaluation unavailable. Use indexed search, or configure PARALLAX_PYTHON with numpy/rasterio/pyproj and local SRTMGL30 DEMs plus MOD44W masks. See web/README.md.", detail: (err.stderr || err.message).slice(-1200) }, { status: 503 });
      } finally { liveBusy = false; }
    } else {
      const csv = await readFile(path.join(process.cwd(), "data", "earth-candidates.csv"), "utf8");
      version = createHash("sha256").update(csv).digest("hex");
      const lines = csv.trim().split(/\r?\n/).slice(1);
      rows = lines.map(line => {
        const [id, lat, lon, jsd, landFraction, landStatus, slopeMean, , , slopeP95] = line.split(",");
        return { id, lat: Number(lat), lon: Number(lon), jsd: Number(jsd), landFraction: Number(landFraction), landStatus, slopeP95: Number(slopeP95), slopeMean: Number(slopeMean) };
      });
    }
    const ranked = rankTerrain(rows, body);
    return NextResponse.json({
      ...ranked, runId, createdAt, request: body, errors, evaluated: rows.length + errors.length,
      provenance: {
        dataset: "SRTMGL30 elevation + MOD44W land/water · Jezero CTX target v0.4",
        version, footprintKm: 50, resolutionM: 1000,
        scope: body.mode === "live" ? "Nine new region cell-centres evaluated from local rasters. Not an exhaustive region search." : "986 measured windows from EXP-001B pilot. 12 evaluation errors and 3 antimeridian exclusions in the original 1001-centre sample. Not a complete Earth search.",
        ranking: body.target === "jezero" ? "Ascending Jensen–Shannon distance to frozen Jezero slope histogram (base 2)." : "Ascending absolute difference from requested regional slope P95. No lunar/Mars analog score.",
      },
    } satisfies SearchResult);
  } catch (e) {
    console.error("Search failed", e);
    return NextResponse.json({ error: "The measured candidate index could not be loaded. No synthetic results were substituted." }, { status: 500 });
  }
}
