import { readFileSync } from "node:fs";
import { build, context } from "esbuild";

// MathJax читает собственный package.json по относительному пути; в бандле его нет
const mathjaxVersion = JSON.parse(readFileSync("node_modules/mathjax-full/package.json", "utf8")).version;

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * Маркеры начала и конца сборки для фоновой задачи VS Code (.vscode/tasks.json):
 * по ним отладчик понимает, что можно запускать окно расширения.
 * @type {import("esbuild").Plugin}
 */
const watchMarkers = {
  name: "watch-markers",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"));
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) console.error(`    ${location.file}:${location.line}:${location.column}:`);
      }
      console.log("[watch] build finished");
    });
  },
};

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
  logLevel: watch ? "silent" : "info",
  plugins: watch ? [watchMarkers] : [],
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
