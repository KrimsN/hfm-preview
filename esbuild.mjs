import { readFileSync } from "node:fs";
import { build, context } from "esbuild";

// MathJax читает собственный package.json по относительному пути; в бандле его нет
const mathjaxVersion = JSON.parse(readFileSync("node_modules/mathjax-full/package.json", "utf8")).version;

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  define: { PACKAGE_VERSION: JSON.stringify(mathjaxVersion) },
  sourcemap: !production,
  minify: production,
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
