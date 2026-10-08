import { describe, expect, it } from "vitest";
import { extractHeadings } from "../src/outline/headings";

describe("extractHeadings", () => {
  it("находит ATX и setext заголовки с исходными уровнями и строками", () => {
    const text = "# Один\n\nтекст\n\nДва\n---\n\n### Три **жирный**\n";
    expect(extractHeadings(text)).toEqual([
      { level: 1, title: "Один", line: 0 },
      { level: 2, title: "Два", line: 4 },
      { level: 3, title: "Три жирный", line: 7 },
    ]);
  });

  it("пропускает заголовки в блоках кода и цитатах", () => {
    const text = "```md\n# не заголовок\n```\n\n> ## в цитате\n\n## Настоящий\n";
    expect(extractHeadings(text).map((h) => h.title)).toEqual(["Настоящий"]);
  });
});
