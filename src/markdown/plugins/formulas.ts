import type { HfmParser } from "../createParser";
import { renderFormula } from "../math";

/**
 * Поддерживаются оба синтаксиса Хабра: `$…$` / `$$…$$` и старый
 * `$inline$…$inline$` / `$$display$$…$$display$$`.
 */
export function formulasPlugin(md: HfmParser): void {
  const imgHtml = (tex: string, display: boolean): string => {
    const source = md.utils.escapeHtml(tex);
    const rendered = renderFormula(tex, display);
    const cls = display ? "formula" : "formula inline";
    if (!rendered) return `<code class="${cls} formula-error">${source}</code>`;
    const style = `width: ${rendered.width}; height: ${rendered.height}; vertical-align: ${rendered.verticalAlign}`;
    return `<img class="${cls}" source="${source}" alt="${source}" src="${rendered.src}" style="${style}">`;
  };

  md.inline.ruler.before("escape", "hfm_formula", (state, silent) => {
    if (state.src[state.pos] !== "$") return false;
    const rest = state.src.slice(state.pos);

    let tex: string | undefined;
    let length = 0;
    if (rest.startsWith("$inline$")) {
      const end = rest.indexOf("$inline$", 8);
      if (end > 8) {
        tex = rest.slice(8, end);
        length = end + 8;
      }
    } else if (!rest.startsWith("$$")) {
      // как в pandoc: после открывающего $ не пробел, перед закрывающим не пробел и после него не цифра
      const match = /^\$(?=\S)((?:\\\$|[^$\n])*?[^\s\\])\$(?!\d)/.exec(rest);
      if (match) {
        tex = match[1]!;
        length = match[0].length;
      }
    }
    if (tex === undefined) return false;

    if (!silent) {
      const token = state.push("html_inline", "", 0);
      token.content = imgHtml(tex, false);
      token.meta = { generated: true };
    }
    state.pos += length;
    return true;
  });

  md.block.ruler.before("fence", "hfm_formula_block", (state, startLine, endLine, silent) => {
    const firstStart = state.bMarks[startLine]! + state.tShift[startLine]!;
    if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
    if (state.src.slice(firstStart, firstStart + 2) !== "$$") return false;

    const legacy = state.src.startsWith("$$display$$", firstStart);
    const opener = legacy ? "$$display$$" : "$$";

    let line = startLine;
    let text = state.src.slice(firstStart + opener.length, state.eMarks[line]);
    let closed = false;
    const parts: string[] = [];

    for (;;) {
      const close = text.indexOf(opener);
      if (close >= 0) {
        if (text.slice(close + opener.length).trim() !== "") return false;
        parts.push(text.slice(0, close));
        closed = true;
        break;
      }
      parts.push(text);
      if (++line >= endLine) break;
      text = state.src.slice(state.bMarks[line], state.eMarks[line]);
    }
    if (!closed) return false;
    if (silent) return true;

    const tex = parts.map((p) => p.trim()).join("");
    const token = state.push("html_block", "", 0);
    token.content = `${imgHtml(tex, true)}\n`;
    token.map = [startLine, line + 1];
    token.meta = { generated: true };
    state.line = line + 1;
    return true;
  });
}
