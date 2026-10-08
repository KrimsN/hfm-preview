import { describe, expect, it } from "vitest";
import { previewTitle, uniqueLabels } from "../src/preview/titles";

describe("uniqueLabels", () => {
  it("уникальные имена остаются короткими", () => {
    expect(uniqueLabels(["/a/one.habr.md", "/a/two.habr.md"])).toEqual(["one.habr.md", "two.habr.md"]);
  });

  it("одинаковые имена расширяются папкой", () => {
    expect(uniqueLabels(["/proj/a/post.habr.md", "/proj/b/post.habr.md", "/proj/c/other.habr.md"])).toEqual([
      "a/post.habr.md",
      "b/post.habr.md",
      "other.habr.md",
    ]);
  });

  it("расширяет до тех пор, пока подписи не станут уникальными", () => {
    expect(uniqueLabels(["/x/a/post.md", "/y/a/post.md"])).toEqual(["x/a/post.md", "y/a/post.md"]);
  });

  it("работает с обратными слэшами Windows и одним файлом", () => {
    expect(uniqueLabels(["E:\\p\\a\\post.md", "E:\\p\\b\\post.md"])).toEqual(["a/post.md", "b/post.md"]);
    expect(uniqueLabels(["/a/post.md"])).toEqual(["post.md"]);
  });

  it("не зацикливается, когда один путь — суффикс другого", () => {
    expect(uniqueLabels(["/post.md", "/a/post.md"])).toEqual(["post.md", "a/post.md"]);
  });
});

describe("previewTitle", () => {
  it("добавляет префикс", () => {
    expect(previewTitle("post.habr.md")).toBe("Превью: post.habr.md");
  });
});
