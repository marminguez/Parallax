import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { NextResponse } from "next/server";
import { validateRequest, rankTerrain, Measurement, Place, SearchResult } from "@/lib/search";
import { findFacilities } from "@/lib/facilities";
import { PUBLIC_DEPLOYMENT } from "@/lib/basemaps";
import { planetaryTargets, targetHistogram, SLOPE_BINS, type FrozenTarget, type PlanetaryTargetId } from "@/lib/targets";
import { parseEarthIndex } from "@/lib/earthIndex";
import type { FineData } from "@/lib/fineRelief";

export const runtime = "nodejs";
export const maxDuration = 120;
const execute = promisify(execFile);
let liveBusy = false;

// Display-only labels (scripts/build_place_labels.py). Missing labels fall back to ids.
const PLACE_NAMES = {
  source: "GeoNames cities1000 (2015 snapshot via reverse_geocoder 1.5.1)",
  attribution: "Place names © GeoNames (geonames.org), CC BY 4.0",
  method: "Nearest populated place (population ≥ 1000) to each window centre, joined after ranking. Labels do not affect matching, filtering or order.",
};
let indexPlaces: Promise<Record<string, Place>> | null = null;
function loadIndexPlaces() {
  indexPlaces ??= readFile(path.join(process.cwd(), "data", "earth-candidate-places.json"), "utf8")
    .then(text => JSON.parse(text).places ?? {})
    .catch(() => ({}));
  return indexPlaces;
}

const dataPath = (...parts: string[]) => path.join(process.cwd(), "data", ...parts);
class MissingEvidence extends Error {}
async function loadTarget(id: PlanetaryTargetId): Promise<FrozenTarget> {
  const spec = planetaryTargets[id];
  try { return JSON.parse(await readFile(dataPath(spec.file), "utf8")); }
  catch { throw new MissingEvidence(`The ${spec.label} reference has not been built on this machine yet. From the repository root run: ${spec.build}`); }
}
let indexHistograms: Promise<Map<string, number[]>> | null = null;
function loadIndexHistograms() {
  indexHistograms ??= readFile(dataPath("earth-slope-histograms.csv"), "utf8").then(text => {
    const [header, ...lines] = text.trim().split(/\r?\n/);
    const columns = header.split(",");
    if (columns.length !== SLOPE_BINS.length + 1 || SLOPE_BINS.some((bin, i) => columns[i + 1] !== bin)) throw new Error("Unexpected histogram columns.");
    return new Map(lines.map(line => { const [id, ...values] = line.split(","); return [id, values.map(Number)]; }));
  });
  indexHistograms.catch(() => { indexHistograms = null; });
  return indexHistograms.catch(() => { throw new MissingEvidence("Slope histograms for the measured index are not available yet, so it can only be ranked against Jezero. From the repository root run: python scripts/export_index_histograms.py"); });
}

// Earth dimensions index (config/search/earth_dimensions_v1.yaml): 42,405 VAL-004 windows with five Earth-side dimensions.
type EarthIndex = { rows: Measurement[]; version: string };
let earthIndex: Promise<EarthIndex> | null = null;
function loadEarthIndex() {
  earthIndex ??= Promise.all([readFile(dataPath("earth-index.csv"), "utf8"), readFile(dataPath("earth-index-extras.json"), "utf8")]).then(([csv, extrasText]) => {
    const extras = JSON.parse(extrasText) as { places: Record<string, [string, string, string, number]>; landFraction: Record<string, number> };
    const rows: Measurement[] = parseEarthIndex(csv).map(r => {
      const p = extras.places[r.id];
      return {
        id: r.id, lat: r.lat, lon: r.lon, jsd: NaN, landFraction: extras.landFraction[r.id] ?? NaN, landStatus: "ELIGIBLE",
        slopeP95: null, slopeMean: null, distribution: r.distribution, earth: r.earth,
        place: p ? { nearest: p[0], admin1: p[1], countryCode: p[2], distanceKm: p[3] } : null,
      };
    });
    return { rows, version: createHash("sha256").update(csv).digest("hex") };
  });
  earthIndex.catch(() => { earthIndex = null; });
  return earthIndex;
}

let fineData: Promise<FineData> | null = null;
function loadFine() {
  fineData ??= readFile(dataPath("fine-relief.json"), "utf8").then(t => JSON.parse(t) as FineData);
  fineData.catch(() => { fineData = null; });
  return fineData;
}

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
    const planetary = body.target === "terrain" ? null : await loadTarget(body.target);
    const referenceHistogram = planetary ? targetHistogram(planetary) : undefined;
    let rows: Measurement[];
    let errors: { id: string; message: string }[] = [];
    let version: string;
    if (body.mode === "live" && PUBLIC_DEPLOYMENT) {
      return NextResponse.json({ error: "Live evaluation needs the local rasters and Python engine, so it only runs on a local install. The public site serves the measured index." }, { status: 501 });
    }
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
    } else if (body.target !== "terrain") {
      const index = await loadEarthIndex();
      rows = index.rows; version = index.version;
    } else {
      const csv = await readFile(path.join(process.cwd(), "data", "earth-candidates.csv"), "utf8");
      version = createHash("sha256").update(csv).digest("hex");
      const places = await loadIndexPlaces();
      const histograms = body.target !== "terrain" && body.target !== "jezero" ? await loadIndexHistograms() : null;
      const lines = csv.trim().split(/\r?\n/).slice(1);
      rows = lines.map(line => {
        const [id, lat, lon, jsd, landFraction, landStatus, slopeMean, , , slopeP95] = line.split(",");
        return { id, lat: Number(lat), lon: Number(lon), jsd: Number(jsd), landFraction: Number(landFraction), landStatus, slopeP95: Number(slopeP95), slopeMean: Number(slopeMean), place: places[id] ?? null, ...(histograms?.has(id) ? { distribution: histograms.get(id) } : {}) };
      });
    }
    const fine = body.mode === "indexed" && body.target !== "terrain" ? await loadFine() : undefined;
    const ranked = rankTerrain(rows, body, 50, referenceHistogram, fine);
    const targetSpec = body.target === "terrain" ? null : planetaryTargets[body.target];
    return NextResponse.json({
      ...ranked, runId, createdAt, request: body, errors, evaluated: rows.length + errors.length,
      ...(body.mode === "indexed" ? { index: body.target === "terrain" ? "pilot" : "earth" } : {}),
      placeNames: PLACE_NAMES,
      ...(planetary && body.target !== "terrain" ? { planetaryReference: { ...planetary, id: body.target } } : {}),
      provenance: {
        dataset: "SRTMGL30 elevation + MOD44W land/water" + (planetary && targetSpec ? ` · ${targetSpec.short} reference v${planetary.version} (${planetary.source.dataset})` : ""),
        version, footprintKm: 50, resolutionM: 1000,
        scope: body.mode === "live" ? "Nine new region cell-centres evaluated from local rasters. Optional WorldCover 2021 characterization uses 100 m sampling; see each candidate for coverage and provenance. Not an exhaustive region search."
          : body.target !== "terrain" ? "42,405 eligible VAL-004 Earth windows (50 km spacing, 56° S to 60° N, ≥ 90 % land) with five Earth-side dimensions (earth dimensions v1): bare ground (WorldCover 2021), access (GPWv4 2020), permafrost (PZI), rock family (GLiM) and temperature (NASA POWER). No regional P95 slope in this index."
          : "986 measured windows from EXP-001B pilot. 12 evaluation errors and 3 antimeridian exclusions in the original 1001-centre sample. Not a complete Earth search.",
        ranking: targetSpec ? (body.mode === "indexed" && body.target === "jezero" ? "Ascending Mars model v2 score (VAL-003): 0.5 × Jensen–Shannon distance (base 2) to the frozen Jezero 1 km slope histogram + 0.5 × (1 − bare ground share)." : `Ascending Jensen–Shannon distance (base 2) to the frozen ${targetSpec.short} 1 km slope histogram${body.target === "jezero" && body.mode !== "indexed" ? "" : ", computed from each window's stored histogram"}.`) : "Ascending absolute difference from requested regional slope P95. No lunar/Mars analog score.",
      },
    } satisfies SearchResult);
  } catch (e) {
    if (e instanceof MissingEvidence) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("Search failed", e);
    return NextResponse.json({ error: "The measured candidate index could not be loaded. No synthetic results were substituted." }, { status: 500 });
  }
}
