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
      'привет <a class="mention" href="/users/krimsn">@krimsn</a>!',
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

describe("formulas", () => {
  it("рисует inline-формулу в двух синтаксисах", () => {
    for (const src of ["$e=mc^2$", "$inline$e=mc^2$inline$"]) {
      const html = md.renderInline(src);
      expect(html).toContain('class="formula inline"');
      expect(html).toContain('source="e=mc^2"');
    }
  });

  it("не считает долларами формулу цену", () => {
    expect(md.renderInline("цена 100$ и 200$ за штуку")).toBe("цена 100$ и 200$ за штуку");
  });

  it("рисует блочные формулы вне абзаца, в том числе многострочную", () => {
    for (const src of ["$$x^2$$", "$$display$$x^2$$display$$", "$$\nx^2\n$$"]) {
      const html = md.render(src);
      expect(html).toMatch(/^<img class="formula" source="x\^2"/);
    }
  });
});

describe("embeds", () => {
  it("видео — рамка, остальное — карточка-ссылка", () => {
    expect(md.render("<oembed>https://www.youtube.com/watch?v=x</oembed>")).toContain("embed_video");
    expect(md.render("<oembed>https://github.com/a/b</oembed>")).toContain("embed_link");
  });

  it("iframe превращается в медиаэлемент", () => {
    const html = md.render('<iframe src="https://www.youtube.com/embed/abc" width="560"></iframe>\n');
    expect(html).toContain("embed_video");
    expect(html).toContain("watch?v=abc");
  });
});

describe("persona", () => {
  it("собирает блок персоны", () => {
    const html = md.render("<persona>\n\n  ![](https://a.b/i.jpg)\n  ##### Имя\n  Роль\n\n</persona>\n");
    expect(html).toBe(
      '<div class="persona"><img class="image persona__image" src="https://a.b/i.jpg"><h5 class="persona__heading">Имя</h5><p class="persona__text">Роль</p></div>\n',
    );
  });
});

describe("html", () => {
  it("выбрасывает span, mark, kbd, small и переименовывает b/i", () => {
    expect(md.render('a <span style="color:red">b</span> <mark>c</mark> <kbd>d</kbd> <b>e</b> <i>f</i>')).toBe(
      "<p>a b c d <strong>e</strong> <em>f</em></p>\n",
    );
  });

  it("убирает комментарии, в том числе многострочные", () => {
    expect(md.render("a <!-- x --> b")).toBe("<p>a  b</p>\n");
    expect(md.render("<!--\nx\n-->\n\nтекст")).toBe("<p>текст</p>\n");
  });

  it("div и p теряют выравнивание", () => {
    expect(md.render('<div align="center">x</div>')).toBe("<p>x</p>");
  });

  it("abbr получает класс habraabbr", () => {
    expect(md.renderInline('<abbr title="Расшифровка">КДПВ</abbr>')).toBe(
      '<abbr class="habraabbr" title="Расшифровка">КДПВ</abbr>',
    );
  });

  it("inline-картинка не с habrastorage пропадает", () => {
    expect(md.renderInline('a <img inline="true" src="https://a.b/i.png" /> b')).toBe("a  b");
    expect(md.renderInline('<img inline="true" src="https://habrastorage.org/i.png" />')).toContain("<img");
  });

  it("HTML-таблица получает разметку таблицы Хабра", () => {
    expect(md.render("<table><tr><td>x</td></tr></table>")).toBe(
      '<div class="table"><table><tbody><tr><td><p align="left">x</p></td></tr></tbody></table></div>',
    );
  });

  it("спойлер не ломается очисткой", () => {
    expect(md.render('<spoiler title="a">\n\nx\n\n</spoiler>\n')).toContain('<div class="spoiler__content">');
  });
});
