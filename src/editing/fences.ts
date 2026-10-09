const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

interface FenceScan {
  /** Для каждой строки: лежит ли она внутри блока кода, включая строки самих ограждений */
  fenced: boolean[];
  /** Текст кончился внутри незакрытого блока */
  unclosed: boolean;
  /** Внутри блока встретился открывающий блок с языком той же или большей длины: так сам блок не пишут */
  swallowedOpener: boolean;
}

/** Разбор ограждений по CommonMark. Незакрытый блок тянется до конца документа. */
function scanFences(lines: string[]): FenceScan {
  const fenced: boolean[] = [];
  let open: { char: string; length: number } | undefined;
  let swallowedOpener = false;

  for (const line of lines) {
    const match = FENCE.exec(line);
    if (!open) {
      // у открывающей ``` в info-строке не может быть обратных кавычек
      const opens = match && !(match[1]![0] === "`" && match[2]!.includes("`"));
      if (opens) open = { char: match[1]![0]!, length: match[1]!.length };
      fenced.push(Boolean(opens));
      continue;
    }

    const sameKind = match && match[1]![0] === open.char && match[1]!.length >= open.length;
    if (sameKind && match.at(2)!.trim() === "") open = undefined;
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
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
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
  const rest = scanFences(lines.slice(line + 1));
  return !rest.unclosed && !rest.swallowedOpener;
}
