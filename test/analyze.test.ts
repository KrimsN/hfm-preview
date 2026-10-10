import { describe, expect, it } from "vitest";
import { analyze } from "../src/diagnostics/analyze";
import { effectiveSeverity, formatMessage } from "../src/diagnostics/rules";

const codes = (text: string): string[] => analyze(text).map((f) => f.code);

describe("analyze: ломается", () => {
  it("ссылка без схемы", () => {
    expect(codes("[x](./other.md) и [y](page)")).toEqual(["link-relative", "link-relative"]);
    expect(codes("[x](https://a.b) [y](/abs) [z](mailto:a@b.c) [w](#a)")).not.toContain("link-relative");
  });

  it("картинка без схемы", () => {
    const [finding] = analyze("![](img/x.png)");
    expect(finding).toMatchObject({ code: "image-relative", line: 0, start: 4, end: 13 });
  });

  it("внешняя картинка не с habrastorage", () => {
    expect(codes("![](https://a.b/x.png)")).toEqual(["image-external"]);
    expect(codes("![](https://habrastorage.org/x.png)")).toEqual([]);
    expect(codes("![](https://cdn.habrastorage.org/x.png)")).toEqual([]);
  });

  it("ссылка на заголовок без <anchor>", () => {
    expect(codes("[к нему](#intro)")).toEqual(["anchor-missing"]);
    expect(codes("<anchor>intro</anchor>\n\n[к нему](#intro)")).toEqual([]);
    expect(codes("<anchor>якорь</anchor>\n\n[к нему](#%D1%8F%D0%BA%D0%BE%D1%80%D1%8C)")).toEqual([]);
  });

  it("img inline с внешним src", () => {
    expect(codes('<img inline="true" src="https://a.b/i.png" />')).toEqual(["inline-image-external"]);
    expect(codes('<img inline="true" src="https://habrastorage.org/i.png" />')).toEqual([]);
  });
});

describe("analyze: теряется молча", () => {
  it("сноски и task list", () => {
    expect(codes("текст[^1]\n\n[^1]: сноска")).toEqual(["footnote", "footnote"]);
    expect(codes("- [ ] дело\n- [x] готово")).toEqual(["task-list", "task-list"]);
  });

  it("вложенные цитаты, код и заголовок в цитате", () => {
    expect(codes("> a\n>> b")).toContain("quote-nested");
    expect(codes("> ```js\n> x\n> ```")).toContain("quote-code");
    expect(codes("> ## h")).toEqual(["quote-heading"]);
  });

  it("заголовки 4–6 и форматирование в заголовке", () => {
    expect(codes("#### h")).toEqual(["heading-level"]);
    expect(codes("## [ссылка](https://a.b) и `код`")).toEqual(["heading-formatting"]);
    expect(codes("## обычный")).toEqual([]);
  });

  it("выравнивание колонок таблицы", () => {
    expect(codes("| a | b |\n|:--|--:|\n| 1 | 2 |")).toEqual(["table-align"]);
    expect(codes("| a | b |\n|---|---|\n| 1 | 2 |")).toEqual([]);
  });

  it("title ссылки и ссылка вокруг картинки", () => {
    expect(codes('[x](https://a.b "t")')).toEqual(["link-title"]);
    expect(codes("[![a](https://habrastorage.org/i.png)](https://a.b)")).toContain("image-link");
  });

  it("span, mark, kbd, style, align", () => {
    expect(codes("a <span>b</span>")).toEqual(["html-dropped"]);
    expect(codes('<div align="center">x</div>')).toEqual(["html-attr-dropped"]);
  });

  it("эмодзи-шорткоды и одинарная тильда", () => {
    expect(codes("привет :smile:")).toEqual(["emoji-shortcode"]);
    expect(codes("время 12:30:45")).toEqual([]);
    expect(codes("~зачёркнуто~")).toEqual(["strike-single-tilde"]);
    expect(codes("~~зачёркнуто~~")).toEqual([]);
  });
});

describe("analyze: меняется и подсказки", () => {
  it("картинка в абзаце", () => {
    expect(codes("текст ![](https://habrastorage.org/i.png) текст")).toEqual(["image-in-paragraph"]);
    expect(codes("![](https://habrastorage.org/i.png)")).toEqual([]);
  });

  it("прямые кавычки", () => {
    expect(codes('он сказал "привет"')).toEqual(["typographic-quotes"]);
    expect(codes("он сказал «привет»")).toEqual([]);
  });

  it("язык блока кода: синоним и неизвестный", () => {
    const [synonym] = analyze("```js\nx\n```");
    expect(synonym).toMatchObject({ code: "code-language-synonym", line: 0, start: 3, end: 5 });
    expect(formatMessage(synonym!.code, synonym!.args)).toContain("javascript");
    expect(codes("```unknown\nx\n```")).toEqual(["code-language-unknown"]);
    expect(codes("```python\nx\n```")).toEqual([]);
  });
});

describe("analyze: что не трогаем", () => {
  it("содержимое блоков кода, inline-кода и комментариев", () => {
    const text = [
      "```python",
      '[x](./a.md) :smile: "q"',
      "```",
      "",
      "`[x](./a.md) :smile:`",
      "",
      "<!--",
      "[x](./a.md)",
      "-->",
    ].join("\n");
    expect(codes(text)).toEqual([]);
  });

  it("заголовок персоны", () => {
    const text = "<persona>\n\n  ![](https://habrastorage.org/i.jpg)\n  ##### Имя\n  Роль\n\n</persona>";
    expect(codes(text)).toEqual([]);
  });

  it("корректная статья даёт пустой результат", () => {
    expect(codes("# Заголовок\n\nТекст со [ссылкой](https://habr.com).\n\n- один\n- два\n")).toEqual([]);
  });
});

describe("analyze: формулы не считаются разметкой", () => {
  it("тильда и кавычки внутри $…$ не дают предупреждений", () => {
    expect(codes("Тут $x ~y~ z$ формула")).toEqual([]);
    expect(codes('Тут $f("a")$ формула')).toEqual([]);
  });

  it("многострочный блок $$ … $$ пропускается целиком", () => {
    expect(codes("$$\na ~b~ c\n:smile:\n$$")).toEqual([]);
  });

  it("текст рядом с формулой по-прежнему проверяется", () => {
    expect(codes("~зачёркнуто~ и $x$")).toEqual(["strike-single-tilde"]);
  });

  it("одиночный доллар (цена) ничего не маскирует", () => {
    expect(codes("Стоит $5, а ~это~ нет")).toEqual(["strike-single-tilde"]);
  });
});

describe("effectiveSeverity: настройка hfm.diagnostics.rules", () => {
  it("по умолчанию берёт уровень из данных", () => {
    expect(effectiveSeverity("image-external")).toBe("warning");
  });

  it("off отключает правило, остальные значения меняют уровень", () => {
    expect(effectiveSeverity("image-external", { "image-external": "off" })).toBeUndefined();
    expect(effectiveSeverity("image-external", { "image-external": "error" })).toBe("error");
  });

  it("мусор в настройке игнорируется", () => {
    expect(effectiveSeverity("image-external", { "image-external": 5 })).toBe("warning");
    expect(effectiveSeverity("image-external", { constructor: "off" })).toBe("warning");
  });
});
