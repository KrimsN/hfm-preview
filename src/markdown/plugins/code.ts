import type { HfmParser } from "../createParser";
import { resolveLanguage } from "../languages";

/** Класс языка получают только имена из списка Хабра; остальное — блок без подсветки. */
export function codePlugin(md: HfmParser): void {
  const render = (content: string, language?: string): string => {
    const cls = language ? ` class="${language}"` : "";
    return `<pre><code${cls}>${md.utils.escapeHtml(content)}</code></pre>\n`;
  };

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!;
    return render(token.content, resolveLanguage(token.info));
  };
  md.renderer.rules.code_block = (tokens, idx) => render(tokens[idx]!.content);
}
