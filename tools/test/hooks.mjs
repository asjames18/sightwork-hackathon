import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(fileURLToPath(new URL("../../src/", import.meta.url)));

export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith("@/")) spec = pathToFileURL(path.join(SRC, spec.slice(2))).href;
  const isPath = spec.startsWith(".") || spec.startsWith("file:") || spec.startsWith("/");
  if (isPath && !/\.(m?[jt]s|json)$/.test(spec)) {
    const base = context.parentURL ? new URL(spec, context.parentURL) : new URL(spec);
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      const candidate = new URL(base.href + ext);
      if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context);
    }
  }
  try {
    return await next(spec, context);
  } catch (err) {
    // Packages without an "exports" map (e.g. next/server) need the file extension under Node ESM.
    if (!isPath && !/\.[cm]?js$/.test(spec)) return next(`${spec}.js`, context);
    throw err;
  }
}

export async function load(url, context, next) {
  if (url.endsWith(".json")) {
    return { format: "module", shortCircuit: true, source: `export default ${readFileSync(fileURLToPath(url), "utf8")};` };
  }
  return next(url, context);
}
