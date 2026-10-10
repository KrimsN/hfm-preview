import { describe, expect, it } from "vitest";
import { frontmatterCompletions, presentKeys } from "../src/frontmatter/completion";
import { frontmatterTemplate } from "../src/frontmatter/template";
import { parseFrontmatter } from "../src/frontmatter/parse";
import { resolveCover } from "../src/frontmatter/cover";

const labels = (prefix: string, present: string[] = []): string[] =>
  frontmatterCompletions(prefix, new Set(present)).items.map((i) => i.label);

describe("автодополнение frontmatter", () => {
  it("в начале строки предлагает ещё не записанные поля", () => {
    expect(labels("")).toHaveLength(10);
    expect(labels("", ["Заголовок", "Хабы"])).not.toContain("Заголовок");
    expect(labels("Кл")).toEqual(["Ключевые слова"]);
    expect(frontmatterCompletions("Кл", new Set())).toMatchObject({ typed: 2 });
  });

  it("вставляет ключ вместе с двоеточием", () => {
    expect(frontmatterCompletions("Фор", new Set()).items[0]).toMatchObject({ label: "Формат", insert: "Формат: " });
  });

  it("после двоеточия предлагает значения справочников", () => {
    expect(labels("Формат: ")).toContain("Туториал");
    expect(labels("Формат: Ту")).toEqual(["Туториал"]);
    expect(labels("Сложность: ")).toEqual(["Простой", "Средний", "Сложный"]);
    expect(labels("Язык:")).toEqual(["ru", "en"]);
    expect(labels("Перевод: ")).toEqual(["true", "false"]);
    expect(frontmatterCompletions("Формат: Ту", new Set())).toMatchObject({ typed: 2 });
  });

  it("для свободных полей, списков и вложенных строк ничего не предлагает", () => {
    expect(labels("Заголовок: ")).toEqual([]);
    expect(labels("Хабы: [a, ")).toEqual([]);
    expect(labels("  - пункт")).toEqual([]);
    expect(labels("- пункт")).toEqual([]);
  });

  it("находит записанные ключи", () => {
    expect(presentKeys(["Заголовок: A", "Хабы:", "  - x", "# Формат: x"])).toEqual(new Set(["Заголовок", "Хабы"]));
  });
});

describe("заготовка frontmatter", () => {
  it("разбирается без замечаний и ничего не заполняет", () => {
    const result = parseFrontmatter(frontmatterTemplate() + "Текст.\n");
    expect(result.findings).toEqual([]);
    expect(result.meta).toEqual({});
  });

  it("использует нужный перевод строки", () => {
    expect(frontmatterTemplate("\r\n")).toContain("\r\nЗаголовок:\r\n");
  });
});

describe("resolveCover", () => {
  it("считает пути от папки статьи", () => {
    expect(resolveCover("/docs/post/a.habr.md", "img/c.png").replace(/\\/g, "/")).toMatch(/\/docs\/post\/img\/c\.png$/);
  });
});
