/**
 * Формулы в тексте: внутри них `~`, `"`, `[^…]` и эмодзи-подобные `:a:` — обычный TeX, а не разметка.
 * Правила повторяют синтаксис плагина формул (`markdown/plugins/formulas.ts`).
 */

const INLINE_FORMULAS = [
  /\$inline\$.+?\$inline\$/g,
  /\$\$display\$\$.*?\$\$display\$\$/g,
  /\$\$.+?\$\$/g,
  // как в pandoc: после открывающего $ не пробел, перед закрывающим не пробел и после него не цифра
  /(?<![\\$])\$(?=\S)(?:\\\$|[^$\n])*?[^\s\\]\$(?!\d)/g,
];

/** Строка, в которой формулы заменены пробелами: длина и позиции не меняются. */
export function maskInlineFormulas(line: string): string {
  if (!line.includes("$")) return line;
  return INLINE_FORMULAS.reduce((masked, re) => masked.replace(re, (m) => " ".repeat(m.length)), line);
}

/** Номера строк, которые лежат внутри многострочных блоков `$$ … $$` (включая строки с самими `$$`). */
export function displayFormulaLines(lines: readonly string[]): Set<number> {
  const result = new Set<number>();
  for (let start = 0; start < lines.length; start++) {
    const first = lines[start]!.trimStart();
    if (!first.startsWith("$$") || lines[start]!.length - first.length >= 4) continue;

    const opener = first.startsWith("$$display$$") ? "$$display$$" : "$$";
    let text = first.slice(opener.length);
    for (let end = start; end < lines.length; end++) {
      const close = text.indexOf(opener);
      if (close >= 0) {
        // после закрывающего `$$` в строке не должно быть текста: иначе это не блок
        if (text.slice(close + opener.length).trim() === "") {
          for (let l = start; l <= end; l++) result.add(l);
          start = end;
        }
        break;
      }
      text = lines[end + 1] ?? "";
    }
  }
  return result;
}
