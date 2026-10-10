import { resolveLanguage, suggestLanguage } from "../../markdown/languages";
import { personaBoundary } from "../../markdown/persona";
import type { Token } from "../../markdown/types";
import type { Add, Reporter } from "../context";

const FORMATTED_HEADING_CHILDREN = ["link_open", "code_inline", "strong_open", "em_open", "s_open", "image"];

/**
 * Структурные правила по токенам Markdown: цитаты, заголовки, таблицы, блоки кода.
 * Возвращает строки, которые остальные проверки пропускают (код и комментарии).
 */
export function checkStructure(tokens: readonly Token[], lines: readonly string[], { add, wholeLine }: Reporter): Set<number> {
  const skip = new Set<number>();
  const markSkip = (map: [number, number] | null): void => {
    if (!map) return;
    for (let l = map[0]; l < map[1]; l++) skip.add(l);
  };

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
        const level = Number(token.tag.slice(1));
        bodyHeadings.push({ level, line: map[0] });
        if (level >= 4) wholeLine("heading-level", map[0]);
        const children = tokens[i + 1]?.children ?? [];
        if (children.some((c) => FORMATTED_HEADING_CHILDREN.includes(c.type))) wholeLine("heading-formatting", map[0]);
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

  // единственный «#» при остальных заголовках глубже: автор, скорее всего, поставил им название статьи
  const topLevel = bodyHeadings.filter((h) => h.level === 1);
  if (topLevel.length === 1 && bodyHeadings.length > 1) wholeLine("heading-single-h1", topLevel[0]!.line);

  return skip;
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
