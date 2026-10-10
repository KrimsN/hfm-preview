import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import diagnostics from "../src/data/diagnostics.json";
import languages from "../src/data/languages.json";
import { canHighlight } from "../src/markdown/highlight";

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

describe("файлы вклада расширения", () => {
  it.each(["package.json", "language-configuration.json", "syntaxes/hfm.tmLanguage.json"])(
    "%s — корректный JSON",
    (path) => {
      expect(() => readJson(path)).not.toThrow();
    },
  );

  it("регэкспы folding-маркеров компилируются и находят region", () => {
    const config = readJson("language-configuration.json") as {
      folding: { markers: { start: string; end: string } };
    };
    const { start, end } = config.folding.markers;
    expect(new RegExp(start).test("<!-- region Раздел -->")).toBe(true);
    expect(new RegExp(end).test("  <!-- endregion -->")).toBe(true);
  });

  it("пути из contributes существуют", () => {
    const pkg = readJson("package.json") as {
      contributes: { grammars: { path: string }[]; languages: { configuration: string }[] };
    };
    for (const { path } of pkg.contributes.grammars) expect(() => readFileSync(path, "utf8")).not.toThrow();
    for (const { configuration } of pkg.contributes.languages) {
      expect(() => readFileSync(configuration, "utf8")).not.toThrow();
    }
  });
});

describe("согласованность данных", () => {
  it("все языки, которые подсвечиваем, есть в списке поддерживаемых Хабром", () => {
    const supported = new Set(languages.supported);
    for (const language of languages.supported) {
      // языки без парсера (1c, elixir, vala) допустимы, обратное — нет
      if (canHighlight(language)) expect(supported.has(language)).toBe(true);
    }
  });

  it("синонимы указывают на поддерживаемые языки", () => {
    for (const target of Object.values(languages.synonyms)) expect(languages.supported).toContain(target);
  });

  it("у каждого правила допустимая важность и непустое сообщение", () => {
    const severities = new Set(["error", "warning", "information", "hint"]);
    for (const [code, rule] of Object.entries(diagnostics)) {
      expect(severities.has(rule.severity), code).toBe(true);
      expect(rule.message.length, code).toBeGreaterThan(0);
    }
  });
});
