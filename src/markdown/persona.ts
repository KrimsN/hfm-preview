import type { Token } from "./types";

/**
 * Границы блока `<persona>`: заголовок `#####` внутри него — часть разметки персоны,
 * а не раздел статьи. Общее знание для рендера, диагностики и оглавления.
 */
export function personaBoundary(token: Token): "open" | "close" | undefined {
  if (token.type !== "html_block") return undefined;
  if (/<persona>/.test(token.content)) return "open";
  if (/<\/persona>/.test(token.content)) return "close";
  return undefined;
}
