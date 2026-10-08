import MarkdownIt from "markdown-it";
import { anchorPlugin } from "./plugins/anchor";
import { imagesPlugin } from "./plugins/images";
import { linksPlugin } from "./plugins/links";
import { mentionsPlugin } from "./plugins/mentions";
import { blockquotesPlugin } from "./plugins/blockquotes";
import { codePlugin } from "./plugins/code";
import { tablesPlugin } from "./plugins/tables";
import { headingsPlugin } from "./plugins/headings";
import { spoilerPlugin } from "./plugins/spoiler";

export type HfmParser = InstanceType<typeof MarkdownIt>;

/**
 * Парсер Хабра ведёт себя как markdown-it с typographer и linkify, без breaks
 * (HFM_SPEC.md, «Главное»). Плагины HFM-элементов подключаются здесь же.
 */
export function createParser(): HfmParser {
  const md = new MarkdownIt({
    // Хабр принимает HTML (spoiler, anchor, details, abbr...); безопасность превью держит CSP webview
    html: true,
    typographer: true,
    linkify: true,
    breaks: false,
  });

  return md
    .use(headingsPlugin)
    .use(blockquotesPlugin)
    .use(codePlugin)
    .use(tablesPlugin)
    .use(linksPlugin)
    .use(mentionsPlugin)
    .use(imagesPlugin)
    .use(spoilerPlugin)
    .use(anchorPlugin);
}
