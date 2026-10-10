const FENCE = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
const LIST_ITEM = /^[ \t]*(?:[-+*]|\d{1,9}[.)])[ \t]/;
/** Отступ, больше которого вне списка идёт блок кода с отступом, а не ограждение */
const MAX_FENCE_INDENT = 3;

const indentWidth = (indent: string): number => indent.replaceAll("\t", "    ").length;

interface FenceScan {
  /** Для каждой строки: лежит ли она внутри блока кода, включая строки самих ограждений */
  fenced: boolean[];
  /** Текст кончился внутри незакрытого блока */
  unclosed: boolean;
  /** Внутри блока встретился открывающий блок с языком той же или большей длины: так сам блок не пишут */
  swallowedOpener: boolean;
}

/**
 * Разбор ограждений по CommonMark. Незакрытый блок тянется до конца документа.
 * Ограждение с отступом больше трёх пробелов считается блоком кода только внутри списка;
 * `inList` говорит, что список начался выше переданных строк.
 */
function scanFences(lines: string[], inList = false): FenceScan {
  const fenced: boolean[] = [];
  let open: { char: string; length: number } | undefined;
  let swallowedOpener = false;

  for (const line of lines) {
    const match = FENCE.exec(line);
    if (!open) {
      // у открывающей ``` в info-строке не может быть обратных кавычек
      const opens =
        match &&
        !(match[2]![0] === "`" && match[3]!.includes("`")) &&
        (inList || indentWidth(match[1]!) <= MAX_FENCE_INDENT);
      if (opens) open = { char: match[2]![0]!, length: match[2]!.length };
      else if (line.trim() !== "") inList = LIST_ITEM.test(line) || (inList && /^[ \t]/.test(line));
      fenced.push(Boolean(opens));
      continue;
    }

    const sameKind = match && match[2]![0] === open.char && match[2]!.length >= open.length;
    if (sameKind && match[3]!.trim() === "") open = undefined;
    else if (sameKind) swallowedOpener = true;
    fenced.push(true);
  }
  return { fenced, unclosed: open !== undefined, swallowedOpener };
}

/** Для каждой строки: лежит ли она внутри ограждённого блока кода (включая строки самих ограждений). */
export function fencedLines(lines: string[]): boolean[] {
  return scanFences(lines).fenced;
}

export interface OpeningFence {
  indent: string;
  fence: string;
  info: string;
}

/** Открывающее ограждение блока кода вместе с отступом и языком (info-строкой). */
export function openingFence(line: string): OpeningFence | undefined {
  const match = FENCE.exec(line);
  if (!match || (match[2]![0] === "`" && match[3]!.replace(/`+$/, "").includes("`"))) return undefined;
  return { indent: match[1]!, fence: match[2]!, info: match[3]! };
}

/**
 * У открывающего ограждения в строке `line` нет закрывающего.
 *
 * Ограждение без языка может быть и закрывающим, и открывающим, поэтому смотрим на остаток документа
 * без этой строки. Если он сам по себе сбалансирован, то новый блок остался открытым. Если в остатке
 * нечётное число ограждений, то первое из них закрывает наш блок. Остаток тоже может оказаться
 * сбалансированным, если «проглотит» открывающий блок с языком, но так блоки не пишут (`swallowedOpener`).
 */
export function needsClosingFence(lines: string[], line: number): boolean {
  if (!openingFence(lines[line] ?? "")) return false;
  // отступ у открывающего ограждения бывает у блока, вложенного в список
  const nested = indentWidth(openingFence(lines[line]!)!.indent) > 0;
  const rest = scanFences(lines.slice(line + 1), nested);
  return !rest.unclosed && !rest.swallowedOpener;
}
