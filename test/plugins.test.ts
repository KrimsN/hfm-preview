import { describe, expect, it } from "vitest";
import { createParser } from "../src/markdown/createParser";

const md = createParser();

describe("headings", () => {
  it("сдвигает уровни как Хабр", () => {
    const html = md.render("# a\n\n## b\n\n### c\n\n#### d\n\n##### e\n\n###### f\n");
    expect(html).toBe(
      "<h2>a</h2>\n<h3>b</h3>\n<h4>c</h4>\n<h3>d</h3>\n<h3>e</h3>\n<h3>f</h3>\n",
    );
  });

  it("сдвигает setext-заголовки", () => {
    expect(md.render("a\n===\n\nb\n---\n")).toBe("<h2>a</h2>\n<h3>b</h3>\n");
  });

  it("выбрасывает форматирование, оставляя текст", () => {
    expect(md.render("## С [ссылкой](https://habr.com) и `кодом`")).toBe(
      "<h3>С ссылкой и кодом</h3>\n",
    );
  });
});

describe("spoiler", () => {
  it("рисует spoiler с title", () => {
    const html = md.render('<spoiler title="Заголовок">\n\nТекст\n\n</spoiler>\n');
    expect(html).toBe(
      '<details class="spoiler"><summary>Заголовок</summary><div class="spoiler__content">\n<p>Текст</p>\n</div></details>\n',
    );
  });

  it("подставляет заголовок по умолчанию", () => {
    expect(md.render("<spoiler>\n\nx\n\n</spoiler>\n")).toContain("<summary>Hidden text</summary>");
  });

  it("поддерживает вложенные спойлеры", () => {
    const html = md.render('<spoiler title="a">\n\n<spoiler title="b">\n\nx\n\n</spoiler>\n\n</spoiler>\n');
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html.match(/<\/details>/g)).toHaveLength(2);
  });

  it("превращает details в спойлер", () => {
    const html = md.render("<details>\n<summary>Заголовок</summary>\n\nТекст\n\n</details>\n");
    expect(html).toContain('<details class="spoiler"><summary>Заголовок</summary>');
    expect(html).toContain("</div></details>");
  });

  it("экранирует title", () => {
    expect(md.render('<spoiler title="a&b">\n\nx\n\n</spoiler>\n')).toContain("a&amp;b");
  });
});

describe("anchor", () => {
  it("рисует якорь вне абзаца, в том числе с кириллицей", () => {
    expect(md.render("<anchor>якорь-1</anchor>\n\nТекст\n")).toBe(
      '<a class="anchor" name="якорь-1" id="якорь-1"></a>\n<p>Текст</p>\n',
    );
  });
});

describe("links", () => {
  it("выбрасывает title и добавляет rel", () => {
    expect(md.renderInline('[x](https://a.b "t")')).toBe(
      '<a href="https://a.b" rel="noopener nofollow">x</a>',
    );
  });
});

describe("images", () => {
  it("подпись берётся из title, иначе из alt", () => {
    expect(md.render('![alt](https://a.b/i.png "title")')).toContain("<figcaption>title</figcaption>");
    expect(md.render("![alt](https://a.b/i.png)")).toContain("<figcaption>alt</figcaption>");
  });

  it("без alt и title подписи нет", () => {
    expect(md.render("![](https://a.b/i.png)")).not.toContain("figcaption");
  });

  it("разрывает абзац", () => {
    const html = md.render("до ![](https://a.b/i.png) после");
    expect(html).toBe(
      '<p>до </p>\n<figure class="full-width"><img src="https://a.b/i.png" alt=""></figure>\n<p> после</p>\n',
    );
  });

  it("теряет ссылку вокруг картинки", () => {
    const html = md.render("[![a](https://a.b/i.png)](https://x.y)");
    expect(html).not.toContain("<a ");
    expect(html).toContain("<figure");
  });
});

describe("mentions", () => {
  it("превращает @username в ссылку на профиль", () => {
    expect(md.renderInline("привет @krimsn!")).toBe(
      'привет <a class="mention" href="/users/krimsn" rel="noopener nofollow">@krimsn</a>!',
    );
  });

  it("не трогает e-mail", () => {
    expect(md.renderInline("a@b.com")).not.toContain("mention");
  });
});

describe("code", () => {
  it("ставит класс только для языков из списка", () => {
    expect(md.render("```python\nx\n```")).toBe('<pre><code class="python">x\n</code></pre>\n');
    expect(md.render("```js\nx\n```")).toBe("<pre><code>x\n</code></pre>\n");
    expect(md.render("```unknown\nx\n```")).toBe("<pre><code>x\n</code></pre>\n");
  });

  it("экранирует содержимое", () => {
    expect(md.render("```xml\n<a>\n```")).toContain("&lt;a&gt;");
  });
});

describe("tables", () => {
  it("рисует таблицу как Хабр и игнорирует выравнивание", () => {
    const html = md.render("| a | b |\n|:-:|--:|\n| 1 | 2 |\n");
    expect(html).toBe(
      '<div class="table"><table><tbody>\n<tr>\n<th><p align="left">a</p></th><th><p align="left">b</p></th></tr>\n<tr>\n<td><p align="left">1</p></td><td><p align="left">2</p></td></tr>\n</tbody></table></div>\n',
    );
  });
});

describe("blockquotes", () => {
  it("расплющивает вложенные цитаты", () => {
    expect(md.render("> a\n>> b")).toBe("<blockquote>\n<p>a</p>\n<p>b</p>\n</blockquote>\n");
  });

  it("превращает код в inline-код, заголовок в абзац", () => {
    const html = md.render("> ```python\n> print(1)\n> ```\n>\n> ## Заголовок\n");
    expect(html).toBe(
      "<blockquote>\n<p><code>print(1)</code></p>\n<p>Заголовок</p>\n</blockquote>\n",
    );
  });
});
