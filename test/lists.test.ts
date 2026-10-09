import { describe, expect, it } from "vitest";
import { fencedLines } from "../src/editing/fences";
import { continueList, indentItem, outdentItem, type ListAction } from "../src/editing/lists";

/** Применяет правки и возвращает текст с курсором `|`. */
function apply(lines: string[], action: ListAction | undefined): string {
  if (!action) return "(нет действия)";
  const out = [...lines];
  const sorted = [...action.changes].sort((a, b) => b.line - a.line || b.start - a.start);
  for (const c of sorted) {
    const l = out[c.line]!;
    out[c.line] = l.slice(0, c.start) + c.text + l.slice(c.end);
  }
  const text = out.join("\n").split("\n");
  const { line, col } = action.cursor;
  text[line] = text[line]!.slice(0, col) + "|" + text[line]!.slice(col);
  return text.join("\n");
}

const at = (src: string) => {
  const lines = src.split("\n");
  const line = lines.findIndex((l) => l.includes("|"));
  const col = lines[line]!.indexOf("|");
  lines[line] = lines[line]!.replace("|", "");
  return { lines, line, col };
};
const enter = (src: string) => { const { lines, line, col } = at(src); return apply(lines, continueList(lines, line, col)); };
const tab = (src: string) => { const { lines, line, col } = at(src); return apply(lines, indentItem(lines, line, col)); };
const shiftTab = (src: string) => { const { lines, line, col } = at(src); return apply(lines, outdentItem(lines, line, col)); };

describe("fencedLines", () => {
  it("отмечает блоки кода вместе с ограждениями", () => {
    expect(fencedLines(["a", "```js", "- x", "```", "b", "~~~", "c"])).toEqual([false, true, true, true, false, true, true]);
  });
});

describe("continueList (Enter)", () => {
  it("продолжает маркированный список тем же маркером", () => {
    expect(enter("- один|")).toBe("- один\n- |");
    expect(enter("* один|")).toBe("* один\n* |");
  });

  it("увеличивает номер и переносит остаток строки", () => {
    expect(enter("1. раз|два")).toBe("1. раз\n2. |два");
  });

  it("перенумеровывает следующие пункты того же уровня", () => {
    expect(enter("1. a|\n2. b\n3. c")).toBe("1. a\n2. |\n3. b\n4. c");
  });

  it("не трогает вложенные пункты и другой список при перенумерации", () => {
    expect(enter("1. a|\n   - x\n2. b\n\nтекст\n\n2. другой")).toBe("1. a\n2. |\n   - x\n3. b\n\nтекст\n\n2. другой");
  });

  it("пустой пункт верхнего уровня очищается", () => {
    expect(enter("- один\n- |")).toBe("- один\n|");
  });

  it("пустой вложенный пункт поднимается на уровень", () => {
    expect(enter("- один\n  - |")).toBe("- один\n- |");
  });

  it("не срабатывает левее маркера, в коде и вне списка", () => {
    expect(enter("|- один")).toBe("(нет действия)");
    expect(enter("```\n- один|\n```")).toBe("(нет действия)");
    expect(enter("обычный текст|")).toBe("(нет действия)");
    expect(enter("---|")).toBe("(нет действия)");
  });
});

describe("indentItem / outdentItem (Tab, Shift+Tab)", () => {
  it("Tab вкладывает пункт в предыдущий", () => {
    expect(tab("- a\n- b|")).toBe("- a\n  - b|");
  });

  it("для нумерованного списка отступ равен ширине маркера, а нумерация начинается с 1", () => {
    expect(tab("1. a\n2. b|")).toBe("1. a\n   1. b|");
  });

  it("номер продолжается, если на новом уровне уже есть соседи", () => {
    expect(tab("1. a\n   1. x\n2. b|")).toBe("1. a\n   1. x\n   2. b|");
  });

  it("вложенные строки уезжают вместе с пунктом", () => {
    expect(tab("- a\n- b|\n  - c")).toBe("- a\n  - b|\n    - c");
  });

  it("Shift+Tab поднимает пункт и его детей", () => {
    expect(shiftTab("- a\n  - b|\n    - c")).toBe("- a\n- b|\n  - c");
  });

  it("Shift+Tab на верхнем уровне и вне списка ничего не делает", () => {
    expect(shiftTab("- a|")).toBe("(нет действия)");
    expect(shiftTab("текст|")).toBe("(нет действия)");
  });

  it("курсор сдвигается вместе с текстом", () => {
    const { lines, line } = at("- a\n- bб|в");
    const action = indentItem(lines, line, 4)!;
    expect(action.cursor).toEqual({ line: 1, col: 6 });
  });
});
