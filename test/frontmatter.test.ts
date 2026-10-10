import { describe, expect, it } from "vitest";
import { analyze } from "../src/diagnostics/analyze";
import { findFrontmatter, maskFrontmatter } from "../src/frontmatter/block";
import { charLength, parseFrontmatter, teaserMarkup } from "../src/frontmatter/parse";
import { extractHeadings } from "../src/outline/headings";

const teaser = "а".repeat(150);
const doc = (yaml: string, body = "Текст.\n"): string => `---\n${yaml}\n---\n\n${body}`;
const codes = (text: string, options = {}): string[] => parseFrontmatter(text, options).findings.map((f) => f.code);

describe("findFrontmatter и maskFrontmatter", () => {
  it("находит блок только в начале и только закрытый", () => {
    expect(findFrontmatter(["---", "a: 1", "---", "текст"])).toEqual({ startLine: 0, endLine: 2, yaml: "a: 1" });
    expect(findFrontmatter(["текст", "---", "a: 1", "---"])).toBeUndefined();
    expect(findFrontmatter(["---", "текст без закрытия"])).toBeUndefined();
    expect(findFrontmatter(["---", "---"])).toEqual({ startLine: 0, endLine: 1, yaml: "" });
  });

  it("очищает строки блока, не сдвигая остальные", () => {
    const text = "---\r\nЗаголовок: A\r\n---\r\n# Заголовок\r\n";
    expect(maskFrontmatter(text)).toBe("\r\n\r\n\r\n# Заголовок\r\n");
  });

  it("без frontmatter текст не меняется", () => {
    expect(maskFrontmatter("# A\n\n---\n\nB\n")).toBe("# A\n\n---\n\nB\n");
  });

  it("outline не видит YAML и сохраняет номера строк", () => {
    const text = doc("Заголовок: Статья", "## Раздел\n");
    expect(extractHeadings(text)).toEqual([{ level: 2, title: "Раздел", line: 4 }]);
  });
});

describe("parseFrontmatter: необязательность", () => {
  it("нет блока — нет метаданных и замечаний", () => {
    expect(parseFrontmatter("# A\n")).toEqual({ meta: {}, findings: [] });
  });

  it("пустой блок и пустые поля молчат", () => {
    expect(codes("---\n---\n")).toEqual([]);
    const yaml = [
      "Заголовок:", "Хабы: []", "Ключевые слова:", "Целевая аудитория: ''", "Формат:", "Сложность: -",
      "Язык:", "Перевод:", "КДПВ:", "Текст в ленте: |",
    ].join("\n");
    const result = parseFrontmatter(doc(yaml));
    expect(result.findings).toEqual([]);
    expect(result.meta).toEqual({});
  });

  it("«Не указан» в формате — отсутствие значения", () => {
    expect(parseFrontmatter(doc("Формат: Не указан"))).toMatchObject({ meta: {}, findings: [] });
  });
});

describe("parseFrontmatter: значения", () => {
  it("читает заполненный блок", () => {
    const yaml = [
      "Заголовок: Как мы переписали ленту",
      "Хабы: [Python, Разработка]",
      "Ключевые слова:",
      "  - ленты",
      "  - хабр",
      "Целевая аудитория: Разработчики",
      "Формат: кейс",
      "Сложность: Средний",
      "Язык: ru",
      "Перевод: true",
      "КДПВ: img/cover.png",
      `Текст в ленте: |\n  ${teaser}`,
    ].join("\n");
    const result = parseFrontmatter(doc(yaml), { coverExists: () => true });
    expect(result.findings).toEqual([]);
    expect(result.meta).toEqual({
      title: "Как мы переписали ленту",
      hubs: ["Python", "Разработка"],
      keywords: ["ленты", "хабр"],
      audience: "Разработчики",
      format: "Кейс",
      difficulty: "Средний",
      language: "ru",
      translation: true,
      cover: "img/cover.png",
      teaser,
    });
  });

  it("неизвестное поле — предупреждение с позицией ключа", () => {
    const [finding] = parseFrontmatter(doc("Автор: Я")).findings;
    expect(finding).toMatchObject({ code: "fm-unknown-key", line: 1, start: 0, end: 5 });
  });

  it("значения вне справочников и неверные типы", () => {
    expect(codes(doc("Формат: Рецепт"))).toEqual(["fm-enum"]);
    expect(codes(doc("Сложность: Лёгкая"))).toEqual(["fm-enum"]);
    expect(codes(doc("Язык: de"))).toEqual(["fm-enum"]);
    expect(codes(doc("Перевод: да"))).toEqual(["fm-type-bool"]);
    expect(codes(doc("Хабы: Python"))).toEqual(["fm-type-list"]);
    expect(codes(doc("Заголовок: [a, b]"))).toEqual(["fm-type-string"]);
  });

  it("позиция ошибки значения — само значение", () => {
    const [finding] = parseFrontmatter(doc("Формат: Рецепт")).findings;
    expect(finding).toMatchObject({ line: 1, start: 8, end: 14 });
  });

  it("лимиты хабов и ключевых слов", () => {
    expect(codes(doc("Хабы: [a, b, c, d, e]"))).toEqual([]);
    expect(codes(doc("Хабы: [a, b, c, d, e, f]"))).toEqual(["fm-hubs-max"]);
    const words = Array.from({ length: 11 }, (_, i) => `w${i}`).join(", ");
    expect(codes(doc(`Ключевые слова: [${words}]`))).toEqual(["fm-keywords-max"]);
  });

  it("невалидный YAML — одна ошибка, поля не проверяются", () => {
    const result = parseFrontmatter(doc("Заголовок: [a\nФормат: Рецепт"));
    expect(result.findings.length).toBeGreaterThan(0);
    expect(new Set(result.findings.map((f) => f.code))).toEqual(new Set(["fm-yaml"]));
  });

  it("не набор полей", () => {
    expect(codes(doc("- a\n- b"))).toEqual(["fm-not-map"]);
  });

  it("две горизонтальные линии с текстом между ними — не frontmatter", () => {
    expect(findFrontmatter(["---", "просто текст", "---", "ещё"])).toBeUndefined();
    expect(codes(doc("просто текст"))).toEqual([]);
    expect(extractHeadings(doc("просто текст"))).toEqual([{ level: 2, title: "просто текст", line: 1 }]);
  });
});

describe("КДПВ", () => {
  it("расширение, URL и существование файла", () => {
    expect(codes(doc("КДПВ: cover.bmp"))).toEqual(["fm-cover-ext"]);
    expect(codes(doc("КДПВ: cover"))).toEqual(["fm-cover-ext"]);
    expect(codes(doc("КДПВ: https://a.b/c.png"))).toEqual(["fm-cover-url"]);
    expect(codes(doc("КДПВ: Cover.PNG"), { coverExists: () => false })).toEqual(["fm-cover-missing"]);
    expect(codes(doc("КДПВ: cover.webp"), { coverExists: () => true })).toEqual([]);
  });

  it("без проверки существования файл не ищется", () => {
    expect(codes(doc("КДПВ: cover.png"))).toEqual([]);
  });

  it("запоминает, где записан путь", () => {
    expect(parseFrontmatter(doc("КДПВ: img/a.png")).coverLocation).toEqual({ line: 1, start: 6, end: 15 });
  });
});

describe("Текст в ленте", () => {
  const withTeaser = (text: string): string[] => codes(doc(`Текст в ленте: |\n  ${text}`));

  it("пороги длины по символам Unicode", () => {
    expect(withTeaser("а".repeat(99))).toEqual(["fm-teaser-short"]);
    expect(withTeaser("а".repeat(100))).toEqual([]);
    expect(withTeaser("а".repeat(2000))).toEqual([]);
    expect(withTeaser("а".repeat(2001))).toEqual(["fm-teaser-long"]);
    expect(withTeaser("а".repeat(3000))).toEqual(["fm-teaser-long"]);
    expect(withTeaser("а".repeat(3001))).toEqual(["fm-teaser-max"]);
  });

  it("суррогатные пары считаются одним символом", () => {
    expect(charLength("😀😀")).toBe(2);
    expect(withTeaser("😀".repeat(100))).toEqual([]);
  });

  it("ссылки допустимы, остальная разметка — нет", () => {
    expect(teaserMarkup("см. [статью](https://habr.com/ru/a/) и https://habr.com")).toBeUndefined();
    expect(teaserMarkup("## Заголовок")).toBe("заголовок");
    expect(teaserMarkup("- пункт")).toBe("список");
    expect(teaserMarkup("текст ![](a.png)")).toBe("картинка");
    expect(teaserMarkup("тут `код`")).toBe("код");
    expect(teaserMarkup("тут **жирный**")).toBe("выделение");
    expect(teaserMarkup("тут <b>тег</b>")).toBe("HTML-тег");
    expect(withTeaser(`${"а".repeat(120)} **жирный**`)).toEqual(["fm-teaser-markup"]);
  });
});

describe("analyze и frontmatter", () => {
  it("диагностики тела не сдвигаются из-за блока", () => {
    const text = doc("Заголовок: A", "- [ ] задача\n");
    const finding = analyze(text).find((f) => f.code === "task-list");
    expect(finding?.line).toBe(4);
  });

  it("строки блока не порождают замечаний тела (hr, setext)", () => {
    expect(analyze(doc("Заголовок: Статья\nХабы: [a]"))).toEqual([]);
  });

  it("замечания frontmatter попадают в общий список", () => {
    expect(analyze(doc("Формат: Рецепт")).map((f) => f.code)).toEqual(["fm-enum"]);
  });

  it("единственный «#» при остальных заголовках глубже", () => {
    const codesOf = (text: string): string[] => analyze(text).map((f) => f.code);
    expect(codesOf("# Название\n\n## Раздел\n")).toEqual(["heading-single-h1"]);
    expect(codesOf("# Название\n\nТекст.\n")).toEqual([]);
    expect(codesOf("## Раздел\n\n### Подраздел\n")).toEqual([]);
    expect(codesOf("# Один\n\n# Два\n\n## Три\n")).toEqual([]);
    expect(analyze("# Название\n\n## Раздел\n")[0]?.line).toBe(0);
  });
});
