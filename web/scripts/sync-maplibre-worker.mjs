import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dist = dirname(fileURLToPath(import.meta.resolve("maplibre-gl")));
const publicDir = new URL("../public/", import.meta.url);

await mkdir(publicDir, { recursive: true });
// MapLibre 6's module worker imports its sibling shared module.
// Copy both from the installed version so they stay in sync after upgrades.
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(join(dist, file), new URL(file, publicDir));
}
