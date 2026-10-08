import type { Token, TokenConstructor } from "../types";
import type { HfmParser } from "../createParser";

const MENTION = /(^|[^\w@.\/-])@([A-Za-z0-9_-]+)/g;

/** `@username` → ссылка на профиль; внутри ссылок и кода не трогаем. */
export function mentionsPlugin(md: HfmParser): void {
  md.core.ruler.after("linkify", "hfm_mentions", (state) => {
    for (const block of state.tokens) {
      if (block.type !== "inline" || !block.children) continue;

      const result: Token[] = [];
      let linkDepth = 0;
      for (const child of block.children) {
        if (child.type === "link_open") linkDepth++;
        if (child.type === "link_close") linkDepth--;

        if (child.type !== "text" || linkDepth > 0 || !child.content.includes("@")) {
          result.push(child);
          continue;
        }
        result.push(...splitMentions(state.Token, child.content));
      }
      block.children = result;
    }
  });
}

function splitMentions(TokenCtor: TokenConstructor, text: string): Token[] {
  const out: Token[] = [];
  let last = 0;

  const pushText = (content: string): void => {
    if (!content) return;
    const t = new TokenCtor("text", "", 0);
    t.content = content;
    out.push(t);
  };

  for (const match of text.matchAll(MENTION)) {
    const [whole, prefix = "", name = ""] = match;
    const start = match.index + prefix.length;
    pushText(text.slice(last, start));

    const open = new TokenCtor("link_open", "a", 1);
    open.attrs = [
      ["class", "mention"],
      ["href", `/users/${name}`],
    ];
    const label = new TokenCtor("text", "", 0);
    label.content = `@${name}`;
    out.push(open, label, new TokenCtor("link_close", "a", -1));
    last = match.index + whole.length;
  }
  pushText(text.slice(last));
  return out;
}
