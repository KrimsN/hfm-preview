import { fencedLines } from "./fences";

/** Замена `[start, end)` в строке `line`; `text` может содержать перевод строки. */
export interface TextChange {
  line: number;
  start: number;
  end: number;
  text: string;
}

export interface ListAction {
  changes: TextChange[];
  /** Где окажется курсор после применения правок (координаты нового текста) */
  cursor: { line: number; col: number };
}

interface ListLine {
  indent: string;
  marker: string;
  ordered: boolean;
  number: number;
  delimiter: string;
  spacing: string;
  content: string;
  /** Колонка, с которой начинается текст пункта */
  contentStart: number;
}

const ITEM = /^([ \t]*)([-+*]|(\d{1,9})([.)]))([ \t]+)(.*)$/;
const RULE = /^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/;
/** Ширина отступа, который Хабр увидит у вложенного пункта */
const FALLBACK_INDENT = 2;

const widthOf = (indent: string): number => indent.replaceAll("\t", "    ").length;

function parse(line: string): ListLine | undefined {
  if (RULE.test(line)) return undefined;
  const m = ITEM.exec(line);
  if (!m) return undefined;
  const [, indent, marker, digits, delimiter, spacing, content] = m;
  return {
    indent: indent!,
    marker: marker!,
    ordered: digits !== undefined,
    number: digits === undefined ? 0 : Number(digits),
    delimiter: delimiter ?? "",
    spacing: spacing!,
    content: content!,
    contentStart: indent!.length + marker!.length + spacing!.length,
  };
}

const markerWithNumber = (item: ListLine, number: number): string =>
  item.ordered ? `${number}${item.delimiter}` : item.marker;

/** Пункт списка под курсором, если с ним можно работать: вне блока кода и правее маркера. */
function itemAt(lines: string[], line: number, col: number): ListLine | undefined {
  const text = lines[line];
  if (text === undefined) return undefined;
  // скан блоков кода дорогой, а Enter и Tab нажимают в основном вне списков: сначала дешёвая проверка строки
  const item = parse(text);
  if (!item || col < item.contentStart) return undefined;
  return fencedLines(lines.slice(0, line + 1))[line] ? undefined : item;
}

/** Номер для пункта, который встаёт на ширину `width` прямо под строкой `line`. */
function numberAmongSiblings(lines: string[], line: number, width: number, item: ListLine): number {
  for (let j = line - 1; j >= 0; j--) {
    const text = lines[j]!;
    if (text.trim() === "") continue;
    const above = parse(text);
    if (!above) {
      if (widthOf(/^[ \t]*/.exec(text)![0]) > 0) continue; // продолжение пункта
      break;
    }
    const w = widthOf(above.indent);
    if (w < width) break;
    if (w === width) return above.ordered && above.delimiter === item.delimiter ? above.number + 1 : 1;
  }
  return 1;
}

/** Строки, которые вложены в пункт `line` и должны ехать вместе с ним. */
function childLines(lines: string[], line: number, width: number): number[] {
  const children: number[] = [];
  for (let j = line + 1; j < lines.length; j++) {
    const text = lines[j]!;
    if (text.trim() === "") {
      let k = j + 1;
      while (k < lines.length && lines[k]!.trim() === "") k++;
      if (k >= lines.length || widthOf(/^[ \t]*/.exec(lines[k]!)![0]) <= width) break;
      continue;
    }
    if (widthOf(/^[ \t]*/.exec(text)![0]) <= width) break;
    children.push(j);
  }
  return children;
}

function shiftTo(lines: string[], line: number, col: number, item: ListLine, newWidth: number): ListAction {
  const width = widthOf(item.indent);
  const head = " ".repeat(newWidth) + markerWithNumber(item, numberAmongSiblings(lines, line, newWidth, item));
  const oldHeadLength = item.indent.length + item.marker.length;
  const changes: TextChange[] = [{ line, start: 0, end: oldHeadLength, text: head }];

  const delta = newWidth - width;
  for (const j of childLines(lines, line, width)) {
    if (lines[j]!.trim() === "") continue;
    if (delta > 0) {
      changes.push({ line: j, start: 0, end: 0, text: " ".repeat(delta) });
    } else {
      const spaces = /^ */.exec(lines[j]!)![0].length;
      changes.push({ line: j, start: 0, end: Math.min(-delta, spaces), text: "" });
    }
  }
  return { changes, cursor: { line, col: col + head.length - oldHeadLength } };
}

/** Tab: пункт становится вложенным в предыдущий. */
export function indentItem(lines: string[], line: number, col: number): ListAction | undefined {
  const item = itemAt(lines, line, col);
  if (!item) return undefined;

  const width = widthOf(item.indent);
  let step = FALLBACK_INDENT;
  for (let j = line - 1; j >= 0; j--) {
    const above = parse(lines[j]!);
    if (above && widthOf(above.indent) <= width) {
      step = above.contentStart - above.indent.length;
      break;
    }
  }
  return shiftTo(lines, line, col, item, width + step);
}

/** Shift+Tab: пункт поднимается на уровень выше. На верхнем уровне действия нет. */
export function outdentItem(lines: string[], line: number, col: number): ListAction | undefined {
  const item = itemAt(lines, line, col);
  const width = item ? widthOf(item.indent) : 0;
  if (!item || width === 0) return undefined;

  let newWidth = 0;
  for (let j = line - 1; j >= 0; j--) {
    const above = parse(lines[j]!);
    if (above && widthOf(above.indent) < width) {
      newWidth = widthOf(above.indent);
      break;
    }
  }
  return shiftTo(lines, line, col, item, newWidth);
}

/** Номера следующих пунктов того же уровня после вставки нового пункта сдвигаем на единицу. */
function renumberFollowing(lines: string[], line: number, item: ListLine): TextChange[] {
  const base = widthOf(item.indent);
  const changes: TextChange[] = [];
  let expected = item.number + 2;

  for (let j = line + 1; j < lines.length; j++) {
    const text = lines[j]!;
    const w = widthOf(/^[ \t]*/.exec(text)![0]);
    if (text.trim() === "") {
      let k = j + 1;
      while (k < lines.length && lines[k]!.trim() === "") k++;
      const next = k < lines.length ? parse(lines[k]!) : undefined;
      const nextWidth = k < lines.length ? widthOf(/^[ \t]*/.exec(lines[k]!)![0]) : -1;
      const sameLevel = next?.ordered && next.delimiter === item.delimiter && nextWidth === base;
      if (nextWidth < base || (nextWidth === base && !sameLevel)) break;
      continue;
    }
    if (w < base) break;
    if (w > base) continue;

    const sibling = parse(text);
    if (!sibling?.ordered || sibling.delimiter !== item.delimiter) break;
    if (sibling.number !== expected) {
      changes.push({ line: j, start: sibling.indent.length, end: sibling.indent.length + String(sibling.number).length, text: String(expected) });
    }
    expected++;
  }
  return changes;
}

/**
 * Enter в пункте списка: новый пункт с тем же маркером (у нумерованного — следующий номер).
 * Enter в пустом пункте убирает маркер, а у вложенного пункта поднимает его на уровень выше.
 */
export function continueList(lines: string[], line: number, col: number): ListAction | undefined {
  const item = itemAt(lines, line, col);
  if (!item) return undefined;

  if (item.content.trim() === "") {
    if (widthOf(item.indent) > 0) return outdentItem(lines, line, col);
    return { changes: [{ line, start: 0, end: lines[line]!.length, text: "" }], cursor: { line, col: 0 } };
  }

  const prefix = item.indent + markerWithNumber(item, item.number + 1) + item.spacing;
  const changes: TextChange[] = [{ line, start: col, end: col, text: `\n${prefix}` }];
  if (item.ordered) changes.push(...renumberFollowing(lines, line, item));
  return { changes, cursor: { line: line + 1, col: prefix.length } };
}
