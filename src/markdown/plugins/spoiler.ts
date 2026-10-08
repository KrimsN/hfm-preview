import type { HfmParser } from "../createParser";

const DEFAULT_TITLE = "Hidden text";

// Один проход: результат замены не должен попадать под повторный разбор
const SPOILER_TAGS =
  /<spoiler(?:\s+title="([^"]*)")?\s*>|<details[^>]*>\s*(?:<summary>([\s\S]*?)<\/summary>)?|<\/spoiler>|<\/details>/g;

const CLOSE_HTML = "</div></details>";

/**
 * `<spoiler title="…">` и GitHub-овский `<details>` Хабр рисует одинаково.
 * Теги стоят отдельными html-блоками, markdown-it уже разобрал содержимое между ними.
 */
export function spoilerPlugin(md: HfmParser): void {
  const openHtml = (title: string | undefined): string => {
    const text = md.utils.escapeHtml(title?.trim() || DEFAULT_TITLE);
    return `<details class="spoiler"><summary>${text}</summary><div class="spoiler__content">`;
  };

  md.core.ruler.push("hfm_spoiler", (state) => {
    for (const token of state.tokens) {
      if (token.type !== "html_block") continue;
      token.content = token.content.replace(
        SPOILER_TAGS,
        (tag: string, spoilerTitle?: string, summary?: string) =>
          tag.startsWith("</") ? CLOSE_HTML : openHtml(tag.startsWith("<spoiler") ? spoilerTitle : summary),
      );
    }
  });
}
