import type { HfmParser } from "../createParser";

/** Хабр выбрасывает `title` у ссылок и добавляет `rel="noopener nofollow"`. */
export function linksPlugin(md: HfmParser): void {
  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    const token = tokens[idx]!;
    const attrs = (token.attrs ?? []).filter(([name]) => name === "href" || name === "class");
    const isMention = attrs.some(([name, value]) => name === "class" && value === "mention");
    token.attrs = isMention ? attrs : [...attrs, ["rel", "noopener nofollow"]];
    return self.renderToken(tokens, idx, options);
  };
}
