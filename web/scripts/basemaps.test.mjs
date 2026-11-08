import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

process.env.NEXT_PUBLIC_CARTO_KEY = "k 1";
process.env.NEXT_PUBLIC_ARCGIS_TOKEN = "t";
const { withCartoKey, CARTO_STYLE_URL, IMAGERY_TEMPLATE, imageryTile, FALLBACK_STYLE, isBasemapError } = await importTs("basemaps.ts");

test("the CARTO key rides on every cartocdn request, once", () => {
  assert.equal(CARTO_STYLE_URL, "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json?key=k%201");
  assert.equal(withCartoKey("https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/1/0/0.mvt").url, "https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/1/0/0.mvt?key=k%201");
  assert.equal(withCartoKey("https://basemaps.cartocdn.com/fonts/a.pbf?x=1").url, "https://basemaps.cartocdn.com/fonts/a.pbf?x=1&key=k%201");
  assert.equal(withCartoKey(CARTO_STYLE_URL).url, CARTO_STYLE_URL);
  assert.equal(withCartoKey("https://example.com/a.png").url, "https://example.com/a.png");
});

test("with a token, imagery uses the authenticated ArcGIS host", () => {
  assert.equal(IMAGERY_TEMPLATE, "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=t");
  assert.equal(imageryTile(2, 1, -1), "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/2/1/3?token=t");
});

test("a refused CARTO basemap falls back to local land outlines", async () => {
  assert.equal(isBasemapError(undefined, "Unauthorized", false), true);            // style.json refused
  assert.equal(isBasemapError("carto", "AJAXError: 401", true), true);             // tiles refused
  assert.equal(isBasemapError(undefined, "https://basemaps.cartocdn.com/fonts/x.pbf 403", true), true);
  assert.equal(isBasemapError("imagery", "AJAXError", true), false);              // satellite errors are handled apart
  assert.equal(isBasemapError("analysis-windows", "x", true), false);
  assert.equal(FALLBACK_STYLE.sources.land.data, "/land-110m.geojson");
  const { readFile } = await import("node:fs/promises");
  const land = JSON.parse(await readFile("public/land-110m.geojson", "utf8"));
  assert.equal(land.type, "FeatureCollection");
  assert.ok(land.features.length > 0);
});
