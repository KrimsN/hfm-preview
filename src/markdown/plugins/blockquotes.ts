import type { HfmParser } from "../createParser";
import type { Token, TokenConstructor } from "../types";

/**
 * Цитата на Хабре плоская: вложенные цитаты расплющиваются в абзацы внешней,
 * заголовки становятся абзацами, блоки кода — inline-кодом в абзаце.
 */
export function blockquotesPlugin(md: HfmParser): void {
  md.core.ruler.push("hfm_blockquotes", (state) => {
    const result: Token[] = [];
    let depth = 0;

    for (const token of state.tokens) {
      if (token.type === "blockquote_open") {
        if (depth++ > 0) continue;
      } else if (token.type === "blockquote_close") {
        if (--depth > 0) continue;
      } else if (depth > 0) {
        if (token.type === "heading_open" || token.type === "heading_close") {
          token.type = token.nesting === 1 ? "paragraph_open" : "paragraph_close";
          token.tag = "p";
        } else if (token.type === "fence" || token.type === "code_block") {
          result.push(...codeAsParagraph(state.Token, token));
          continue;
        }
      }
      result.push(token);
    }
    state.tokens = result;
  });
}

function codeAsParagraph(TokenCtor: TokenConstructor, block: Token): Token[] {
  const open = new TokenCtor("paragraph_open", "p", 1);
  open.block = true;
  const code = new TokenCtor("code_inline", "code", 0);
  code.content = block.content.replace(/\n$/, "");
  const inline = new TokenCtor("inline", "", 0);
  inline.children = [code];
  inline.content = code.content;
  const close = new TokenCtor("paragraph_close", "p", -1);
  close.block = true;
  return [open, inline, close];
}
