import { ATTR_DROPPED_ON, DROPPED_ATTRS, DROPPED_TAGS, isHabrImageUrl } from "../dialect";
import { displayFormulaLines, maskInlineFormulas } from "./formulas";
import { personaBoundary } from "../markdown/persona";
import { parseTokens } from "../markdown/plain";
import { resolveLanguage, suggestLanguage } from "../markdown/languages";
import { HAS_SCHEME } from "../markdown/env";
import type { RuleCode } from "./rules";
import { maskFrontmatter } from "../frontmatter/block";
import { parseFrontmatter, type FrontmatterOptions } from "../frontmatter/parse";
import { blank } from "./text";
import type { Finding } from "./types";
import { typographyFindings } from "./typography";

export type { Finding };

type Add = (code: RuleCode, line: number, start: number, end: number, args?: Record<string, string>) => void;

const IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const IMAGE_LINK = /\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g;
const LINK = /(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)/g;
const FOOTNOTE = /\[\^[^\]\s]+\]/g;
const TASK = /^\s*(?:[-+*]|\d+[.)])\s+(\[[ xX]\])\s/;
const DROPPED_TAG = new RegExp(String.raw`<(${DROPPED_TAGS.join("|")})\b[^>]*>`, "gi");
const DROPPED_ATTR = new RegExp(
  String.raw`<(?:${ATTR_DROPPED_ON.join("|")})\b[^>]*?\s(${DROPPED_ATTRS.join("|")})\s*=`,
  "gi",
);
const INLINE_IMG = /<img\b[^>]*\sinline\b[^>]*>/gi;
const ANCHOR = /<anchor>\s*([^<]+?)\s*<\/anchor>/g;
const EMOJI = /(?<![\w:/])(:[a-z][a-z0-9_+-]*:)(?![\w:])/g;
const SINGLE_TILDE = /(?<![~\\])~(?!~)[^\s~](?:[^~\n]*[^\s~\\])?~(?!~)/g;
const STRAIGHT_QUOTES = /"[^"\n]+"/g;

function isRelative(path: string): boolean {
  return path !== "" && !path.startsWith("#") && !path.startsWith("/") && !HAS_SCHEME.test(path);
}

/** Строка без inline-кода, комментариев, тегов и адресов ссылок: для поиска «голого» текста. */
function maskForText(line: string): string {
  let masked = maskInlineFormulas(blank(line, /`[^`\n]*`/g));
  masked = blank(masked, /<!--[\s\S]*?-->/g);
  masked = blank(masked, /<\/?[a-zA-Z][^<>]*>/g);
  return blank(masked, /\]\([^)]*\)/g);
}

/**
 * Находит конструкции, которые Хабр не поддерживает или ломает (HFM_SPEC.md, «Что важно для плагина»).
 * Чистая функция: работает с текстом, VS Code не нужен.
 */
export function analyze(source: string, options: { typography?: boolean } & FrontmatterOptions = {}): Finding[] {
  // frontmatter проверяется отдельно, а остальные правила видят его пустые строки: номера строк не сдвигаются
  const frontmatter = parseFrontmatter(source, options);
  const text = maskFrontmatter(source);
  const lines = text.split(/\r?\n/);
  const tokens = parseTokens(text);
  const findings: Finding[] = [...frontmatter.findings];
  const add: Add = (code, line, start, end, args) => {
    findings.push({ code, line, start, end, ...(args ? { args } : {}) });
  };
  const wholeLine = (code: RuleCode, line: number): void => {
    const source = lines[line] ?? "";
    const start = source.length - source.trimStart().length;
    add(code, line, start, Math.max(source.trimEnd().length, start + 1));
  };

  const skip = new Set<number>();
  const markSkip = (map: [number, number] | null): void => {
    if (!map) return;
    for (let l = map[0]; l < map[1]; l++) skip.add(l);
  };

  // --- структурные правила по токенам
  let quoteDepth = 0;
  let inPersona = false; // заголовок ##### внутри <persona> — часть разметки персоны
  const bodyHeadings: { level: number; line: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const map = token.map;

    if (token.type === "blockquote_open") {
      quoteDepth++;
      if (quoteDepth > 1 && map) wholeLine("quote-nested", map[0]);
    } else if (token.type === "blockquote_close") {
      quoteDepth--;
    } else if (token.type === "fence" || token.type === "code_block") {
      markSkip(map);
      if (quoteDepth > 0 && map) wholeLine("quote-code", map[0]);
      if (token.type === "fence" && map) checkFenceLanguage(token.info, lines[map[0]] ?? "", map[0], add);
    } else if (token.type === "html_block" && map && token.content.trimStart().startsWith("<!--")) {
      markSkip(map);
    } else if (personaBoundary(token)) {
      inPersona = personaBoundary(token) === "open";
    } else if (token.type === "heading_open" && map && !inPersona) {
      if (quoteDepth > 0) {
        wholeLine("quote-heading", map[0]);
      } else {
        bodyHeadings.push({ level: Number(token.tag.slice(1)), line: map[0] });
        if (Number(token.tag.slice(1)) >= 4) wholeLine("heading-level", map[0]);
        const children = tokens[i + 1]?.children ?? [];
        const formatted = children.some((c) =>
          ["link_open", "code_inline", "strong_open", "em_open", "s_open", "image"].includes(c.type),
        );
        if (formatted) wholeLine("heading-formatting", map[0]);
      }
    } else if (token.type === "table_open" && map) {
      if ((lines[map[0] + 1] ?? "").includes(":")) wholeLine("table-align", map[0] + 1);
    } else if (token.type === "paragraph_open" && map) {
      const children = tokens[i + 1]?.children ?? [];
      const hasImage = children.some((c) => c.type === "image");
      const hasText = children.some(
        (c) => !["image", "link_open", "link_close", "softbreak"].includes(c.type) && c.content.trim() !== "",
      );
      if (hasImage && hasText) wholeLine("image-in-paragraph", map[0]);
    }
  }

  // многострочные формулы $$ … $$ — не разметка
  for (const line of displayFormulaLines(lines)) skip.add(line);

  // единственный «#» при остальных заголовках глубже: автор, скорее всего, поставил им название статьи
  const topLevel = bodyHeadings.filter((h) => h.level === 1);
  if (topLevel.length === 1 && bodyHeadings.length > 1) wholeLine("heading-single-h1", topLevel[0]!.line);

  // --- якоря документа
  const anchors = new Set<string>();
  lines.forEach((line, n) => {
    if (skip.has(n)) return;
    for (const m of line.matchAll(ANCHOR)) anchors.add(m[1]!);
  });

  // --- построчные правила
  lines.forEach((line, n) => {
    if (skip.has(n)) return;
    const code = maskInlineFormulas(blank(line, /`[^`\n]*`/g));

    for (const m of code.matchAll(IMAGE_LINK)) add("image-link", n, m.index, m.index + m[0].length);

    for (const m of code.matchAll(IMAGE)) {
      const src = m[1]!;
      const at = m.index + m[0].indexOf(src);
      if (isRelative(src) || (src.startsWith("/") && !src.startsWith("//"))) {
        add("image-relative", n, at, at + src.length, { src });
      } else if (/^https?:\/\//i.test(src) && !isHabrImageUrl(src)) {
        add("image-external", n, at, at + src.length);
      }
    }

    for (const m of code.matchAll(LINK)) {
      const href = m[1]!;
      const at = m.index + m[0].indexOf(href);
      if (href.startsWith("#")) {
        let name = href.slice(1);
        try {
          name = decodeURIComponent(name);
        } catch {
          // оставляем как написано
        }
        if (name && !anchors.has(name)) add("anchor-missing", n, at, at + href.length, { name });
      } else if (isRelative(href)) {
        add("link-relative", n, at, at + href.length, { href });
      }
      if (m[2] !== undefined) add("link-title", n, at + href.length, m.index + m[0].length - 1);
    }

    for (const m of code.matchAll(FOOTNOTE)) add("footnote", n, m.index, m.index + m[0].length);

    const task = TASK.exec(code);
    if (task) {
      const at = task[0].indexOf(task[1]!);
      add("task-list", n, at, at + task[1]!.length);
    }

    for (const m of code.matchAll(DROPPED_TAG)) {
      add("html-dropped", n, m.index, m.index + m[0].length, { tag: m[1]!.toLowerCase() });
    }
    for (const m of code.matchAll(DROPPED_ATTR)) {
      const attr = m[1]!.toLowerCase();
      const at = m.index + m[0].length - attr.length - 1;
      add("html-attr-dropped", n, at, at + attr.length, { attr });
    }
    for (const m of code.matchAll(INLINE_IMG)) {
      const src = /\ssrc\s*=\s*["']([^"']*)["']/i.exec(m[0])?.[1] ?? "";
      if (!isHabrImageUrl(src)) add("inline-image-external", n, m.index, m.index + m[0].length);
    }

    const bare = maskForText(line);
    for (const m of bare.matchAll(EMOJI)) add("emoji-shortcode", n, m.index, m.index + m[0].length, { code: m[1]! });
    for (const m of bare.matchAll(SINGLE_TILDE)) add("strike-single-tilde", n, m.index, m.index + m[0].length);
    for (const m of bare.matchAll(STRAIGHT_QUOTES)) add("typographic-quotes", n, m.index, m.index + m[0].length);
  });

  if (options.typography ?? true) {
    findings.push(...typographyFindings(lines.map((line, n) => (skip.has(n) ? "" : maskForText(line)))));
  }

  return findings.sort((a, b) => a.line - b.line || a.start - b.start);
}

function checkFenceLanguage(info: string, line: string, lineNumber: number, add: Add): void {
  const lang = info.trim().split(/\s+/)[0] ?? "";
  if (!lang || resolveLanguage(lang)) return;

  const start = line.indexOf(lang);
  const end = start + lang.length;
  const suggestion = suggestLanguage(lang);
  if (suggestion) add("code-language-synonym", lineNumber, start, end, { lang, suggestion });
  else add("code-language-unknown", lineNumber, start, end, { lang });
}
