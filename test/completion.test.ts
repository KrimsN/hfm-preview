import { describe, expect, it } from "vitest";
import { anchorLinkPrefix, collectAnchors, fenceLanguagePrefix } from "../src/editing/context";

describe("collectAnchors", () => {
  it("собирает якоря по порядку и подписывает их заголовками", () => {
    const text = "<anchor>one</anchor>\n\n## Первый\n\n<anchor>two</anchor>\nтекст\n\n<anchor>one</anchor>\n";
    expect(collectAnchors(text)).toEqual([
      { name: "one", heading: "Первый" },
      { name: "two", heading: undefined },
    ]);
  });

  it("пропускает якоря в блоках кода и якоря не на отдельной строке", () => {
    expect(collectAnchors("```\n<anchor>x</anchor>\n```\n\nтекст <anchor>y</anchor>")).toEqual([]);
  });
});

describe("контекст автодополнения", () => {
  it("адрес ссылки на якорь", () => {
    expect(anchorLinkPrefix("см. [раздел](#")).toBe("");
    expect(anchorLinkPrefix("см. [раздел](#inst")).toBe("inst");
    expect(anchorLinkPrefix("см. [раздел](https://a.b/#x")).toBeUndefined();
    expect(anchorLinkPrefix("## Заголовок #")).toBeUndefined();
  });

  it("язык после ограждения кода", () => {
    expect(fenceLanguagePrefix("```")).toBe("");
    expect(fenceLanguagePrefix("```py")).toBe("py");
    expect(fenceLanguagePrefix("  ~~~rust")).toBe("rust");
    expect(fenceLanguagePrefix("```js title")).toBeUndefined();
    expect(fenceLanguagePrefix("текст ```")).toBeUndefined();
  });
});
