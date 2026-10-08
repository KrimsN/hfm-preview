import MarkdownIt from "markdown-it";

export type HfmParser = InstanceType<typeof MarkdownIt>;

/**
 * Парсер Хабра ведёт себя как markdown-it с typographer и linkify, без breaks
 * (HFM_SPEC.md, «Главное»). Плагины HFM-элементов подключаются здесь же.
 */
export function createParser(): HfmParser {
  return new MarkdownIt({
    // Хабр принимает HTML (spoiler, anchor, details, abbr...); безопасность превью держит CSP webview
    html: true,
    typographer: true,
    linkify: true,
    breaks: false,
  });
}
