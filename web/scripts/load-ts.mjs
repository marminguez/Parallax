// Test helper: import a TypeScript module from src/lib without a bundler.
// Relative and "@/lib/*" imports are transpiled recursively and inlined as data URLs.
import { readFile } from "node:fs/promises";
import ts from "typescript";

const cache = new Map();
export async function loadTs(url) {
  const href = url instanceof URL ? url.href : url;
  if (cache.has(href)) return cache.get(href);
  let code = ts.transpileModule(await readFile(new URL(href), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const specifiers = [...code.matchAll(/from\s+"((?:\.\.?\/|@\/lib\/)[^"]+)"/g)].map(m => m[1]);
  for (const spec of new Set(specifiers)) {
    const resolved = spec.startsWith("@/lib/") ? new URL(`../src/lib/${spec.slice(6)}.ts`, import.meta.url) : new URL(spec.endsWith(".ts") ? spec : spec + ".ts", href);
    const dataUrl = await loadTs(resolved);
    code = code.replaceAll(`"${spec}"`, `"${dataUrl}"`);
  }
  const dataUrl = "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  cache.set(href, dataUrl);
  return dataUrl;
}
export const importTs = async relative => import(await loadTs(new URL(relative, new URL("../src/lib/", import.meta.url))));
