import { maskFrontmatter } from "../frontmatter/block";
import { personaBoundary } from "../markdown/persona";
import { parseTokens } from "../markdown/plain";

export interface Heading {
  /** Уровень в исходном Markdown, 1–6 */
  level: number;
  title: string;
  /** Строка заголовка, с нуля */
  line: number;
}

/**
 * Заголовки документа: ATX и setext, без заголовков в блоках кода.
 * Заголовки внутри цитат Хабр превращает в абзацы, а заголовок внутри `<persona>` — часть персоны:
 * пропускаем и их.
 */
export function extractHeadings(text: string): Heading[] {
  const headings: Heading[] = [];
  const tokens = parseTokens(maskFrontmatter(text));
  let inPersona = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const boundary = personaBoundary(token);
    if (boundary) inPersona = boundary === "open";
    if (inPersona || token.type !== "heading_open" || token.level !== 0 || !token.map) continue;

    const inline = tokens[i + 1];
    const title = (inline?.children ?? [])
      .map((child) => (child.type === "softbreak" || child.type === "hardbreak" ? " " : child.content))
      .join("")
      .trim();
    headings.push({ level: Number(token.tag.slice(1)), title: title || "(без названия)", line: token.map[0] });
  }
  return headings;
}
