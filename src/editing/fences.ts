const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/**
 * Для каждой строки: лежит ли она внутри ограждённого блока кода (включая строки самих ограждений).
 * Незакрытый блок тянется до конца документа, как и в CommonMark.
 */
export function fencedLines(lines: string[]): boolean[] {
  const result: boolean[] = [];
  let open: { char: string; length: number } | undefined;

  for (const line of lines) {
    const match = FENCE.exec(line);
    if (!open) {
      // у открывающей ``` в info-строке не может быть обратных кавычек
      const opens = match && !(match[1]![0] === "`" && match[2]!.includes("`"));
      if (opens) open = { char: match[1]![0]!, length: match[1]!.length };
      result.push(Boolean(opens));
    } else {
      const closes = match && match[1]![0] === open.char && match[1]!.length >= open.length && match[2]!.trim() === "";
      if (closes) open = undefined;
      result.push(true);
    }
  }
  return result;
}
