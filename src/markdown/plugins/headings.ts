import type { HfmParser } from "../createParser";

/** Уровень в Markdown → уровень в HTML Хабра (HFM_SPEC.md, «Блочные элементы»). */
const LEVEL_MAP: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 3, 5: 3, 6: 3 };

/**
 * Сдвигает уровни заголовков и оставляет в них только текст:
 * ссылки, код и форматирование Хабр выбрасывает.
 */
export function headingsPlugin(md: HfmParser): void {
  md.core.ruler.push("hfm_headings", (state) => {
    const { tokens } = state;
    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i];
      if (open?.type !== "heading_open") continue;

      const level = Number(open.tag.slice(1));
      const tag = `h${LEVEL_MAP[level] ?? 3}`;
      open.tag = tag;

      const inline = tokens[i + 1];
      if (inline?.type === "inline" && inline.children) {
        const text = inline.children
          .map((t) => (t.type === "softbreak" || t.type === "hardbreak" ? " " : t.content))
          .join("");
        const textToken = new state.Token("text", "", 0);
        textToken.content = text;
        inline.children = [textToken];
      }

      const close = tokens[i + 2];
      if (close?.type === "heading_close") close.tag = tag;
    }
  });
}
