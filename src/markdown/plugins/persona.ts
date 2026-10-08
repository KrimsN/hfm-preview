import type { HfmParser } from "../createParser";
import type { Token } from "../types";

/**
 * `<persona>`: картинка, заголовок `#####` с именем и абзац со специальностью
 * собираются в один блок `div.persona`. Должен идти раньше плагинов заголовков и картинок.
 */
export function personaPlugin(md: HfmParser): void {
  md.core.ruler.push("hfm_persona", (state) => {
    const { tokens } = state;
    const result: Token[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;
      if (token.type !== "html_block" || !/^\s*<persona>\s*$/.test(token.content)) {
        result.push(token);
        continue;
      }

      const end = tokens.findIndex((t, idx) => idx > i && t.type === "html_block" && /<\/persona>/.test(t.content));
      if (end < 0) {
        result.push(token);
        continue;
      }

      const body = tokens.slice(i + 1, end);
      const image = body.flatMap((t) => t.children ?? []).find((c) => c.type === "image");
      const headingIdx = body.findIndex((t) => t.type === "heading_open");
      const name = headingIdx >= 0 ? (body[headingIdx + 1]?.content ?? "") : "";
      const rest = headingIdx >= 0 ? body.slice(headingIdx + 3).find((t) => t.type === "inline") : undefined;

      const esc = md.utils.escapeHtml;
      const html = new state.Token("html_block", "", 0);
      html.meta = { generated: true };
      html.content =
        `<div class="persona">` +
        (image ? `<img class="image persona__image" src="${esc(String(image.attrGet("src") ?? ""))}">` : "") +
        `<h5 class="persona__heading">${esc(name)}</h5>` +
        `<p class="persona__text">${esc(rest?.content ?? "")}</p></div>\n`;
      result.push(html);
      i = end;
    }
    state.tokens = result;
  });
}
