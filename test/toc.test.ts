import { describe, expect, it } from "vitest";
import { buildTocEdits, slugify, type LineEdit } from "../src/outline/toc";

/** Применяет правки к строкам так же, как это сделает редактор: по исходным координатам. */
function apply(text: string, edits: LineEdit[]): string {
  const lines = text.split("\n");
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (const e of sorted) lines.splice(e.start, e.end - e.start, ...e.lines);
  return lines.join("\n");
}

const run = (text: string, insertLine = 0) => apply(text, buildTocEdits(text, { insertLine }));

describe("slugify", () => {
  it("транслитерирует кириллицу, если просят", () => {
    expect(slugify("Как это работает?", true)).toBe("kak-eto-rabotaet");
    expect(slugify("Щётка, ёлка и объём", true)).toBe("shchetka-elka-i-obem");
    expect(slugify("Шаг 2: Rust", true)).toBe("shag-2-rust");
  });

  it("оставляет кириллицу, убирает пунктуацию, пробелы превращает в дефисы", () => {
    expect(slugify("Как это работает?")).toBe("как-это-работает");
    expect(slugify("C++ и  Rust: сравнение")).toBe("c-и-rust-сравнение");
    expect(slugify("???")).toBe("section");
  });
});

describe("buildTocEdits", () => {
  it("ставит якорь перед каждым заголовком и собирает оглавление в точке вставки", () => {
    const text = "Вступление\n\n## Один\n\nтекст\n\n### Вложенный\n\n## Два\n";
    expect(run(text, 1)).toBe(
      [
        "Вступление",
        "",
        "<!-- toc -->",
        "- [Один](#один)",
        "  - [Вложенный](#вложенный)",
        "- [Два](#два)",
        "<!-- /toc -->",
        "",
        "<anchor>один</anchor>",
        "",
        "## Один",
        "",
        "текст",
        "",
        "<anchor>вложенный</anchor>",
        "",
        "### Вложенный",
        "",
        "<anchor>два</anchor>",
        "",
        "## Два",
        "",
      ].join("\n"),
    );
  });

  it("повторный запуск ничего не меняет", () => {
    const once = run("## Один\n\n## Два\n");
    expect(run(once)).toBe(once);
  });

  it("перестраивает существующий блок и переиспользует старые якоря", () => {
    const text = [
      "<!-- toc -->",
      "- [Старое](#старое)",
      "<!-- /toc -->",
      "",
      "<anchor>свой</anchor>",
      "## Заголовок",
      "",
      "## Новый",
    ].join("\n");
    const result = run(text);
    expect(result).toContain("- [Заголовок](#свой)");
    expect(result).toContain("- [Новый](#новый)");
    expect(result).not.toContain("Старое");
    expect(result.match(/<anchor>свой<\/anchor>/g)).toHaveLength(1);
  });

  it("разводит одинаковые заголовки суффиксом", () => {
    const result = run("## Итог\n\n## Итог\n");
    expect(result).toContain("<anchor>итог</anchor>");
    expect(result).toContain("<anchor>итог-1</anchor>");
  });

  it("ставит пустую строку между абзацем и якорем", () => {
    expect(run("абзац\n## Заголовок\n")).toContain("абзац\n\n<anchor>заголовок</anchor>\n\n## Заголовок");
  });

  it("заголовки глубже третьего уровня идут в оглавление как третий", () => {
    const result = run("## Один\n\n#### Глубокий\n\n###### Ещё\n");
    expect(result).toContain("- [Один](#один)\n  - [Глубокий](#глубокий)\n  - [Ещё](#ещё)");
    expect(result).toContain("<anchor>ещё</anchor>");
  });

  it("не опирается на пропущенные уровни: h1 → h3 даёт один уровень вложенности", () => {
    expect(run("# А\n\n### Б\n")).toContain("- [А](#а)\n  - [Б](#б)");
  });

  it("экранирует скобки в тексте ссылки", () => {
    expect(run("## Массив [0]\n")).toContain("- [Массив \\[0\\]](#массив-0)");
  });

  it("с транслитерацией якоря пишутся латиницей и в ссылках, и перед заголовками", () => {
    const text = "## Как это работает\n";
    const result = apply(text, buildTocEdits(text, { insertLine: 0, transliterate: true }));
    expect(result).toContain("- [Как это работает](#kak-eto-rabotaet)");
    expect(result).toContain("<anchor>kak-eto-rabotaet</anchor>");
  });

  it("без заголовков правок нет", () => {
    expect(buildTocEdits("просто текст\n", { insertLine: 0 })).toEqual([]);
  });
});

describe("buildTocEdits: frontmatter и персона", () => {
  it("оглавление не попадает выше или внутрь frontmatter", () => {
    const text = "---\nЗаголовок: A\n---\n\n## Раздел\n";
    for (const insertLine of [0, 1, 2]) {
      const result = run(text, insertLine);
      expect(result.startsWith("---\nЗаголовок: A\n---\n")).toBe(true);
      expect(result).toContain("<!-- toc -->");
    }
  });

  it("заголовок внутри <persona> не попадает в оглавление", () => {
    const text = "<persona>\n\n![](https://habrastorage.org/i.jpg)\n##### Имя Фамилия\nРоль\n\n</persona>\n\n## Раздел\n";
    const result = run(text);
    expect(result).not.toContain("Имя Фамилия)");
    expect(result).not.toContain("<anchor>imya");
    expect(result).toContain("- [Раздел](#");
  });
});
