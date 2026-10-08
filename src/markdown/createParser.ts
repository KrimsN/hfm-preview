import MarkdownIt from "markdown-it";
import { anchorPlugin } from "./plugins/anchor";
import { blockquotesPlugin } from "./plugins/blockquotes";
import { codePlugin } from "./plugins/code";
import { embedsPlugin } from "./plugins/embeds";
import { formulasPlugin } from "./plugins/formulas";
import { emphasisPlugin } from "./plugins/emphasis";
import { headingsPlugin } from "./plugins/headings";
import { htmlPlugin } from "./plugins/html";
import { imagesPlugin } from "./plugins/images";
import { listsPlugin } from "./plugins/lists";
import { linksPlugin } from "./plugins/links";
import { mentionsPlugin } from "./plugins/mentions";
import { personaPlugin } from "./plugins/persona";
import { sourceLinesPlugin } from "./plugins/sourceLines";
import { spoilerPlugin } from "./plugins/spoiler";
import { tablesPlugin } from "./plugins/tables";

export type HfmParser = InstanceType<typeof MarkdownIt>;

/**
 * Парсер Хабра ведёт себя как markdown-it с typographer и linkify, без breaks
 * (HFM_SPEC.md, «Главное»). Плагины HFM-элементов подключаются здесь же.
 *
 * Порядок важен: core-правила выполняются в порядке подключения.
 * Очистка HTML идёт первой, персона — до заголовков и картинок, спойлер — после очистки.
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
    .use(formulasPlugin)
    .use(embedsPlugin)
    .use(anchorPlugin)
    .use(htmlPlugin)
    .use(personaPlugin)
    .use(headingsPlugin)
    .use(blockquotesPlugin)
    .use(emphasisPlugin)
    .use(listsPlugin)
    .use(linksPlugin)
    .use(mentionsPlugin)
    .use(imagesPlugin)
    .use(spoilerPlugin)
    .use(codePlugin)
    .use(tablesPlugin)
    .use(sourceLinesPlugin);
}
