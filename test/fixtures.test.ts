import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createParser } from "../src/markdown/createParser";
import { normalizeHtml } from "./normalize";

const dir = join(__dirname, "fixtures");
const md = createParser();

/** Секции, которые пока расходятся с эталоном; причины — в KNOWN. */
const KNOWN: Record<string, string> = {};

const ids = readdirSync(dir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.slice(0, -3));

describe("фикстуры Хабра", () => {
  for (const id of ids) {
    const run = id in KNOWN ? it.skip : it;
    run(`${id}${KNOWN[id] ? ` (${KNOWN[id]})` : ""}`, () => {
      const source = readFileSync(join(dir, `${id}.md`), "utf8");
      const expected = readFileSync(join(dir, `${id}.html`), "utf8");
      expect(normalizeHtml(md.render(source))).toBe(normalizeHtml(expected));
    });
  }
});
