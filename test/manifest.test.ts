import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import diagnostics from "../src/data/diagnostics.json";
import languages from "../src/data/languages.json";
import { canHighlight } from "../src/markdown/highlight";
import { FIELDS } from "../src/frontmatter/schema";
import { frontmatterTemplate } from "../src/frontmatter/template";

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

describe("схема frontmatter", () => {
  const types = new Set(["string", "list", "enum", "bool", "path", "text"]);

  it("у каждого поля известный тип и уникальный ключ", () => {
    expect(new Set(FIELDS.map((f) => f.key)).size).toBe(FIELDS.length);
    for (const field of FIELDS) expect(types.has(field.type), field.id).toBe(true);
  });

  it("у справочников есть значения, у списков — лимит и существующее правило", () => {
    for (const field of FIELDS) {
      if (field.type === "enum") expect(field.options?.length, field.id).toBeGreaterThan(0);
      if (field.type === "list") {
        expect(field.limit, field.id).toBeDefined();
        expect(Object.hasOwn(diagnostics, field.limitRule ?? ""), field.id).toBe(true);
      }
    }
  });

  it("поле из схемы есть в ArticleMeta: заготовка содержит все ключи", () => {
    const template = frontmatterTemplate();
    for (const field of FIELDS) expect(template).toContain(`${field.key}:`);
  });
});

describe("каждое правило из данных реализовано", () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? sources(join(dir, entry.name)) : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : [],
    );
  // часть правил привязана к полям в схеме frontmatter, а не к коду
  const code = [...sources("src"), "src/data/frontmatter.json"].map((file) => readFileSync(file, "utf8")).join("\n");

  it.each(Object.keys(diagnostics))("%s", (rule) => {
    expect(code).toContain(`"${rule}"`);
  });
});
