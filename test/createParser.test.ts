import { describe, expect, it } from "vitest";
import { createParser } from "../src/markdown/createParser";

describe("createParser", () => {
  const md = createParser();

  it("применяет типографику как Хабр", () => {
    expect(md.renderInline("(c) ... \"q\"")).toBe("© … “q”");
  });

  it("склеивает одиночный перенос строки в пробел", () => {
    expect(md.render("a\nb")).toBe("<p>a\nb</p>\n");
  });

  it("превращает голый URL в ссылку", () => {
    expect(md.renderInline("https://habr.com")).toContain('<a href="https://habr.com" rel="noopener nofollow">');
  });

  it("не зачёркивает ~одну тильду~ и не знает task lists", () => {
    expect(md.renderInline("~x~")).not.toContain("<s>");
    expect(md.render("- [ ] a")).toContain("[ ] a");
  });
});
