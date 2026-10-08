import type { HfmParser } from "../createParser";

/** `***текст***`: Хабр вкладывает `<em>` в `<strong>`, markdown-it — наоборот. */
export function emphasisPlugin(md: HfmParser): void {
  md.core.ruler.push("hfm_emphasis", (state) => {
    for (const block of state.tokens) {
      const children = block.children;
      if (block.type !== "inline" || !children) continue;

      for (let i = 0; i < children.length; i++) {
        const first = children[i]!;
        const wanted =
          first.type === "em_open" ? "strong_open" : first.type === "strong_close" ? "em_close" : null;
        if (!wanted) continue;

        // между тегами markdown-it оставляет пустые text-токены
        let j = i + 1;
        while (children[j]?.type === "text" && children[j]!.content === "") j++;
        if (children[j]?.type === wanted) {
          children[i] = children[j]!;
          children[j] = first;
        }
      }
    }
  });
}
