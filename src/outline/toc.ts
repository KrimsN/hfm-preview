import { extractHeadings, type Heading } from "./headings";

/** Замена строк `[start, end)` на `lines`; при `start === end` — вставка перед строкой `start`. */
export interface LineEdit {
  start: number;
  end: number;
  lines: string[];
}

export interface TocOptions {
  /** Куда вставить оглавление, если в документе его ещё нет; строка с нуля */
  insertLine: number;
  /** Писать имена якорей латиницей: `как-это` → `kak-eto` (по умолчанию кириллица остаётся) */
  transliterate?: boolean;
}

export const TOC_START = "<!-- toc -->";
export const TOC_END = "<!-- /toc -->";

const ANCHOR_LINE = /^<anchor>([^<\n]+)<\/anchor>[ \t]*$/;
const ANCHOR_ANY = /<anchor>([^<\n]+)<\/anchor>/g;
/** Хабр превращает заголовки глубже третьего уровня в `h3`, оглавление считает их так же. */
const MAX_TOC_LEVEL = 3;
const FALLBACK_SLUG = "section";

// Упрощённая транслитерация по ГОСТ 7.79 (система Б) плюс украинские буквы
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g",
};

function transliterate(text: string): string {
  return Array.from(text, (ch) => TRANSLIT[ch] ?? ch).join("");
}

/**
 * Имя якоря из текста заголовка: буквы и цифры любого алфавита, пробелы → `-`.
 * Кириллицу Хабр принимает, но в скопированной ссылке она превращается в %D0%BA…, поэтому есть транслитерация.
 */
export function slugify(title: string, latin = false): string {
  const lower = title.toLowerCase();
  const slug = (latin ? transliterate(lower) : lower)
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || FALLBACK_SLUG;
}

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base;
  for (let n = 1; used.has(slug); n++) slug = `${base}-${n}`;
  used.add(slug);
  return slug;
}

/** Имя якоря, стоящего непосредственно над заголовком (через пустые строки), если он есть. */
function anchorAbove(lines: string[], headingLine: number): { name: string; line: number } | undefined {
  let i = headingLine - 1;
  while (i >= 0 && lines[i]!.trim() === "") i--;
  const match = i >= 0 ? ANCHOR_LINE.exec(lines[i]!.trim()) : null;
  return match ? { name: match[1]!.trim(), line: i } : undefined;
}

function findTocBlock(lines: string[]): { start: number; end: number } | undefined {
  const start = lines.findIndex((l) => l.trim().toLowerCase() === TOC_START);
  if (start < 0) return undefined;
  const end = lines.findIndex((l, i) => i > start && l.trim().toLowerCase() === TOC_END);
  return end < 0 ? undefined : { start, end: end + 1 };
}

function escapeLinkText(title: string): string {
  return title.replace(/[\\[\]]/g, "\\$&");
}

function tocLines(entries: { heading: Heading; slug: string }[]): string[] {
  const out = [TOC_START];
  const stack: number[] = []; // уровни открытых родителей
  for (const { heading, slug } of entries) {
    const level = Math.min(heading.level, MAX_TOC_LEVEL);
    while (stack.length > 0 && stack[stack.length - 1]! >= level) stack.pop();
    out.push(`${"  ".repeat(stack.length)}- [${escapeLinkText(heading.title)}](#${slug})`);
    stack.push(level);
  }
  out.push(TOC_END);
  return out;
}

/**
 * Правки, которые ставят якорь перед каждым заголовком и собирают оглавление.
 * Повторный запуск идемпотентен: существующие якоря переиспользуются, блок между
 * `<!-- toc -->` и `<!-- /toc -->` перестраивается (Хабр HTML-комментарии выбрасывает).
 */
export function buildTocEdits(text: string, options: TocOptions): LineEdit[] {
  const lines = text.split(/\r?\n/);
  const headings = extractHeadings(text);

  const used = new Set<string>();
  for (const line of lines) for (const m of line.matchAll(ANCHOR_ANY)) used.add(m[1]!.trim());

  const edits: LineEdit[] = [];
  const entries: { heading: Heading; slug: string }[] = [];

  for (const heading of headings) {
    const existing = anchorAbove(lines, heading.line);
    let slug = existing?.name;
    if (slug === undefined) {
      slug = uniqueSlug(slugify(heading.title, options.transliterate), used);
      const needBlankBefore = heading.line > 0 && lines[heading.line - 1]!.trim() !== "";
      edits.push({
        start: heading.line,
        end: heading.line,
        lines: [...(needBlankBefore ? [""] : []), `<anchor>${slug}</anchor>`, ""],
      });
    }
    entries.push({ heading, slug });
  }

  if (entries.length === 0) return edits;

  const block = findTocBlock(lines);
  if (block) {
    edits.push({ start: block.start, end: block.end, lines: tocLines(entries) });
    return edits;
  }

  const at = Math.min(Math.max(options.insertLine, 0), lines.length);
  const blankBefore = at === 0 || lines[at - 1]!.trim() === "";
  const blankAfter = at >= lines.length || lines[at]!.trim() === "";
  edits.push({
    start: at,
    end: at,
    lines: [...(blankBefore ? [] : [""]), ...tocLines(entries), ...(blankAfter ? [] : [""])],
  });
  return edits;
}
