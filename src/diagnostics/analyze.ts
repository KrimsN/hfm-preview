import { maskFrontmatter } from "../frontmatter/block";
import { parseFrontmatter, type FrontmatterOptions } from "../frontmatter/parse";
import { parseTokens } from "../markdown/plain";
import { LINE_CHECKS } from "./checks/lines";
import { checkStructure } from "./checks/structure";
import type { Add, Reporter } from "./context";
import { displayFormulaLines, maskInlineFormulas } from "./formulas";
import { blank } from "./text";
import type { Finding } from "./types";
import { typographyFindings } from "./typography";

export type { Finding };

const ANCHOR = /<anchor>\s*([^<]+?)\s*<\/anchor>/g;

/** Строка без inline-кода, комментариев, тегов и адресов ссылок: для поиска «голого» текста. */
function maskForText(line: string): string {
  let masked = maskInlineFormulas(blank(line, /`[^`\n]*`/g));
  masked = blank(masked, /<!--[\s\S]*?-->/g);
  masked = blank(masked, /<\/?[a-zA-Z][^<>]*>/g);
  return blank(masked, /\]\([^)]*\)/g);
}

/**
 * Находит конструкции, которые Хабр не поддерживает или ломает (HFM_SPEC.md, «Что важно для плагина»).
 * Чистая функция: работает с текстом, VS Code не нужен. Сами проверки лежат в `checks/`.
 */
export function analyze(source: string, options: { typography?: boolean } & FrontmatterOptions = {}): Finding[] {
  // frontmatter проверяется отдельно, а остальные правила видят его пустые строки: номера строк не сдвигаются
  const frontmatter = parseFrontmatter(source, options);
  const text = maskFrontmatter(source);
  const lines = text.split(/\r?\n/);
  const findings: Finding[] = [...frontmatter.findings];

  const add: Add = (code, line, start, end, args) => {
    findings.push({ code, line, start, end, ...(args ? { args } : {}) });
  };
  const report: Reporter = {
    add,
    wholeLine: (code, line) => {
      const row = lines[line] ?? "";
      const start = row.length - row.trimStart().length;
      add(code, line, start, Math.max(row.trimEnd().length, start + 1));
    },
  };

  const skip = checkStructure(parseTokens(text), lines, report);
  // многострочные формулы $$ … $$ — не разметка
  for (const line of displayFormulaLines(lines)) skip.add(line);

  const anchors = new Set<string>();
  lines.forEach((line, n) => {
    if (skip.has(n)) return;
    for (const m of line.matchAll(ANCHOR)) anchors.add(m[1]!);
  });

  lines.forEach((line, n) => {
    if (skip.has(n)) return;
    const view = {
      n,
      code: maskInlineFormulas(blank(line, /`[^`\n]*`/g)),
      bare: maskForText(line),
      anchors,
    };
    for (const check of LINE_CHECKS) check(view, add);
  });

  if (options.typography ?? true) {
    findings.push(...typographyFindings(lines.map((line, n) => (skip.has(n) ? "" : maskForText(line)))));
  }

  return findings.sort((a, b) => a.line - b.line || a.start - b.start);
}
