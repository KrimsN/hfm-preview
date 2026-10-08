import embeds from "../../data/embeds.json";
import type { HfmParser } from "../createParser";

const OEMBED_LINE = /^<oembed>\s*([^<\s]+)\s*<\/oembed>[ \t]*$/;
const videoHosts = new Set(embeds.videoHosts);

/** `<iframe src="youtube.com/embed/ID">` Хабр превращает в медиаэлемент с обычной ссылкой. */
export function iframeToUrl(src: string): string {
  const youtube = /youtube\.com\/embed\/([\w-]+)/.exec(src);
  return youtube ? `https://www.youtube.com/watch?v=${youtube[1]}` : src;
}

/**
 * Заглушка медиаэлемента: у видео — рамка 16:9, у остального — карточка-ссылка.
 * Настоящие embed-страницы Хабр получает от своего сервиса, в превью их нет.
 */
export function embedHtml(md: HfmParser, url: string): string {
  const href = md.utils.escapeHtml(url);
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // невалидный URL остаётся карточкой без хоста
  }
  const hostLabel = md.utils.escapeHtml(host.replace(/^www\./, ""));

  if (videoHosts.has(host)) {
    return `<a class="embed_video embed__placeholder" href="${href}" rel="noopener nofollow"><span>▶ ${hostLabel}</span></a>\n`;
  }
  return (
    `<div class="embed_link"><div class="embed__caption">` +
    `<div class="embed__caption-title"><span>${href}</span></div>` +
    `<a href="${href}" rel="noopener nofollow" class="embed__caption-host">${hostLabel}</a>` +
    `</div></div>\n`
  );
}

export function embedsPlugin(md: HfmParser): void {
  md.block.ruler.before("html_block", "hfm_oembed", (state, startLine, _endLine, silent) => {
    const start = state.bMarks[startLine]! + state.tShift[startLine]!;
    const match = OEMBED_LINE.exec(state.src.slice(start, state.eMarks[startLine]));
    if (!match) return false;
    if (silent) return true;

    const token = state.push("html_block", "", 0);
    token.content = embedHtml(md, match[1]!);
    token.map = [startLine, startLine + 1];
    token.meta = { generated: true };
    state.line = startLine + 1;
    return true;
  });
}
