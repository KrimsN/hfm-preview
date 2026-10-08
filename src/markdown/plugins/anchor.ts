import type { HfmParser } from "../createParser";

const ANCHOR_LINE = /^<anchor>([^<\n]+)<\/anchor>[ \t]*$/;

/** `<anchor>name</anchor>` отдельной строкой → `<a class="anchor">` вне абзаца. */
export function anchorPlugin(md: HfmParser): void {
  md.block.ruler.before("html_block", "hfm_anchor", (state, startLine, _endLine, silent) => {
    const start = state.bMarks[startLine]! + state.tShift[startLine]!;
    const line = state.src.slice(start, state.eMarks[startLine]);
    const match = ANCHOR_LINE.exec(line);
    if (!match) return false;
    if (silent) return true;

    const name = md.utils.escapeHtml(match[1]!.trim());
    const token = state.push("html_block", "", 0);
    token.content = `<a class="anchor" name="${name}" id="${name}"></a>\n`;
    token.map = [startLine, startLine + 1];
    state.line = startLine + 1;
    return true;
  });
}
