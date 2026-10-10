import data from "./data/dialect.json";

/** Правила диалекта Хабра, общие для рендера и диагностики: меняются правкой `data/dialect.json`. */

const imageHosts = data.imageHosts.map((host) => host.toLowerCase());
const linkSchemes = new Set(data.linkSchemes);
const SCHEME = /^[a-z][a-z\d+.-]*:/i;

const passthrough = new Map<string, readonly string[]>(Object.entries(data.html.passthrough));
const renamed = new Map<string, string>(Object.entries(data.html.renamed));

/** Разрешённые атрибуты тега, который Хабр пропускает как есть; `undefined` — тег не из этого списка. */
export const passthroughAttrs = (tag: string): readonly string[] | undefined => passthrough.get(tag);
/** Во что Хабр переименовывает тег (`b` → `strong`). */
export const renamedTag = (tag: string): string | undefined => renamed.get(tag);
export const DROPPED_TAGS: readonly string[] = data.html.dropped;
export const ATTR_DROPPED_ON: readonly string[] = data.html.attrDroppedOn;
export const DROPPED_ATTRS: readonly string[] = data.html.attrDropped;

/** Картинка на хранилище Хабра (сам хост или его поддомен), только по http(s). */
export function isHabrImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return imageHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** `href` с безопасной схемой либо `undefined`; относительные ссылки и якоря проходят. */
export function safeHref(href: string): string | undefined {
  // браузер игнорирует пробелы и управляющие символы внутри схемы: `java\tscript:`
  const compact = href.replace(/[\u0000- ]/g, "");
  const scheme = SCHEME.exec(compact)?.[0].toLowerCase();
  return scheme === undefined || linkSchemes.has(scheme) ? href : undefined;
}
