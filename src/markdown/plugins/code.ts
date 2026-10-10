import type { HfmParser } from "../createParser";
import { highlightCode } from "../highlight";
import { resolveLanguage } from "../languages";

/**
 * Класс языка получают только имена из списка Хабра; остальное — блок без подсветки.
 * Токены размечаются так же, как это делает Хабр (CodeMirror 6 / Lezer).
 */
export function codePlugin(md: HfmParser): void {
  const render = (content: string, language?: string, line?: string | number | null): string => {
    const cls = language ? ` class="${language}"` : "";
    const mark = line ? ` data-line="${line}"` : "";
    const body = (language && highlightCode(content, language, md.utils.escapeHtml)) || md.utils.escapeHtml(content);
    return `<pre${mark}><code${cls}>${body}</code></pre>\n`;
  };

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!;
    return render(token.content, resolveLanguage(token.info), token.attrGet("data-line"));
  };
  md.renderer.rules.code_block = (tokens, idx) =>
    render(tokens[idx]!.content, undefined, tokens[idx]!.attrGet("data-line"));
}
