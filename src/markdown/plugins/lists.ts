import type { HfmParser } from "../createParser";

/** В Хабре пункт списка всегда содержит `<p>`, даже если список «плотный». */
export function listsPlugin(md: HfmParser): void {
  md.core.ruler.push("hfm_lists", (state) => {
    for (const token of state.tokens) {
      if (token.type === "paragraph_open" || token.type === "paragraph_close") token.hidden = false;
    }
  });
}
