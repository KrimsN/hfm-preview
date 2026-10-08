import { describe, expect, it } from "vitest";
import { analyze } from "../src/diagnostics/analyze";
import { fixFor } from "../src/diagnostics/fixes";

/** Применяет быстрое исправление первой найденной диагностики с указанным кодом. */
function apply(text: string, code: string): string | undefined {
  const lines = text.split("\n");
  const finding = analyze(text).find((f) => f.code === code);
  if (!finding) throw new Error(`диагностика ${code} не найдена`);
  const line = lines[finding.line]!;
  const fix = fixFor(code, line, finding.start, finding.end);
  return fix && line.slice(0, fix.start) + fix.text + line.slice(fix.end);
}

describe("быстрые исправления", () => {
  it("синоним языка", () => {
    expect(apply("```js\nx\n```", "code-language-synonym")).toBe("```javascript");
  });

  it("подсказка у ссылки", () => {
    expect(apply('[a](https://b.c "t") тут', "link-title")).toBe("[a](https://b.c) тут");
  });

  it("маркер задачи", () => {
    expect(apply("- [ ] дело", "task-list")).toBe("- дело");
    expect(apply("- [x] готово", "task-list")).toBe("- готово");
  });

  it("ссылка вокруг картинки", () => {
    expect(apply("[![alt](https://habrastorage.org/a.png)](https://b.c)", "image-link")).toBe(
      "![alt](https://habrastorage.org/a.png)",
    );
  });

  it("уровень заголовка", () => {
    expect(apply("###### Глубоко", "heading-level")).toBe("### Глубоко");
  });

  it("форматирование в заголовке", () => {
    expect(apply("## **Жирный** [ссылка](https://a.b) и `код`", "heading-formatting")).toBe(
      "## Жирный ссылка и код",
    );
  });

  it("выравнивание таблицы", () => {
    expect(apply("| a | b |\n|:---|:---:|\n| 1 | 2 |", "table-align")).toBe("|---|---|");
  });

  it("цитаты", () => {
    expect(apply("> раз\n>\n> > два", "quote-nested")).toBe("> два");
    expect(apply("> ## Заголовок", "quote-heading")).toBe("> Заголовок");
  });

  it("зачёркивание и кавычки", () => {
    expect(apply("это ~старое~ слово", "strike-single-tilde")).toBe("это ~~старое~~ слово");
    expect(apply('он сказал "привет"', "typographic-quotes")).toBe("он сказал «привет»");
  });

  it("эмодзи только из списка", () => {
    expect(apply("круто :fire: очень", "emoji-shortcode")).toBe("круто 🔥 очень");
    expect(fixFor("emoji-shortcode", ":unknown_one:", 0, 13)).toBeUndefined();
  });

  it("даты", () => {
    expect(apply("родился 21.09.1975", "date-numeric")).toBe("родился 21 сентября 1975");
    expect(apply("пришёл 01 января", "date-numeric")).toBe("пришёл 1 января");
    expect(fixFor("date-numeric", "05/01/1993", 0, 10)).toBeUndefined();
  });

  it("без автоисправления", () => {
    expect(fixFor("footnote", "текст[^1]", 5, 9)).toBeUndefined();
    expect(fixFor("link-relative", "[a](./b.md)", 4, 10)).toBeUndefined();
  });
});
