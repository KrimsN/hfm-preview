import type { CoreState, Token } from "../types";
import type { HfmParser } from "../createParser";

/**
 * Картинка на Хабре всегда блок `figure`: подпись — `title`, иначе `alt`.
 * Картинка внутри абзаца разрывает его, ссылка вокруг картинки теряется.
 */
export function imagesPlugin(md: HfmParser): void {
  const figureHtml = (image: Token): string => {
    const src = md.utils.escapeHtml(String(image.attrGet("src") ?? ""));
    const alt = md.utils.escapeHtml(image.content);
    const caption = md.utils.escapeHtml(String(image.attrGet("title") || image.content));
    const figcaption = caption ? `<figcaption>${caption}</figcaption>` : "";
    return `<figure class="full-width"><img src="${src}" alt="${alt}">${figcaption}</figure>\n`;
  };

  md.core.ruler.push("hfm_images", (state) => {
    const result: Token[] = [];
    const { tokens } = state;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;
      const inline = tokens[i + 1];
      const hasImage =
        token.type === "paragraph_open" &&
        inline?.type === "inline" &&
        inline.children?.some((child) => child.type === "image");

      if (!hasImage || !inline?.children) {
        result.push(token);
        continue;
      }

      result.push(...splitParagraph(state, token, inline, figureHtml));
      i += 2; // inline и paragraph_close
    }
    state.tokens = result;
  });
}

function splitParagraph(
  state: CoreState,
  open: Token,
  inline: Token,
  figureHtml: (image: Token) => string,
): Token[] {
  const out: Token[] = [];
  let segment: Token[] = [];

  const flush = (): void => {
    const hasContent = segment.some((t) => t.type !== "softbreak" && t.content.trim() !== "");
    if (hasContent) out.push(...paragraphOf(state, open, segment));
    segment = [];
  };

  for (const child of inline.children ?? []) {
    if (child.type === "image") {
      flush();
      const figure = new state.Token("html_block", "", 0);
      figure.content = figureHtml(child);
      out.push(figure);
    } else if (child.type !== "link_open" && child.type !== "link_close") {
      segment.push(child);
    } else if (!isImageLink(inline.children ?? [], child)) {
      segment.push(child);
    }
  }
  flush();
  return out;
}

/** Ссылка, внутри которой только картинка, — теряется целиком. */
function isImageLink(children: Token[], linkToken: Token): boolean {
  const idx = children.indexOf(linkToken);
  if (linkToken.type === "link_open") {
    return children[idx + 1]?.type === "image" && children[idx + 2]?.type === "link_close";
  }
  return children[idx - 1]?.type === "image" && children[idx - 2]?.type === "link_open";
}

function paragraphOf(state: CoreState, template: Token, children: Token[]): Token[] {
  const open = new state.Token("paragraph_open", "p", 1);
  open.block = true;
  open.map = template.map;
  const inline = new state.Token("inline", "", 0);
  inline.children = children;
  inline.content = children.map((t) => t.content).join("");
  const close = new state.Token("paragraph_close", "p", -1);
  close.block = true;
  return [open, inline, close];
}
