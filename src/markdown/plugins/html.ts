import type { HfmParser } from "../createParser";
import { DROPPED_TAGS, isHabrImageUrl, passthroughAttrs, renamedTag, safeHref } from "../../dialect";
import { type HfmEnv, resolveImageSrc } from "../env";
import { embedHtml, iframeToUrl } from "./embeds";

const COMMENT = /<!--[\s\S]*?-->/g;
const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g;

const DROPPED = new Set(DROPPED_TAGS);
const TABLE_CELLS = new Set(["td", "th"]);
const TABLE_STRUCTURE = new Set(["tbody", "thead", "tfoot"]);

/** Тег без чужих атрибутов: остаются только разрешённые данными диалекта. */
function rebuildTag(slash: string, name: string, attrs: string, allowed: readonly string[]): string {
  const kept = allowed.flatMap((key) => {
    const value = attr(attrs, key);
    // кавычки и скобки вырезаем: значение попадёт в строку, которую разбирают дальше (спойлер)
    return value === undefined ? [] : [` ${key}="${value.replace(/["<>]/g, "")}"`];
  });
  return `<${slash}${name}${slash ? "" : kept.join("")}>`;
}

function attr(attrs: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs);
  return match ? (match[1] ?? match[2]) : undefined;
}

/**
 * Приводит произвольный HTML к модели документа Хабра (HFM_SPEC.md, «Произвольный HTML»):
 * `<span>`, `<mark>`, `<kbd>`, `<small>` и атрибуты `style`/`align` пропадают, текст остаётся.
 */
export function cleanHtml(md: HfmParser, html: string, block: boolean, env?: HfmEnv): string {
  const esc = md.utils.escapeHtml;

  return html.replace(COMMENT, "").replace(TAG, (_whole, slash: string, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase();
    const closing = slash === "/";

    if (name === "br") return "<br>";
    const passthrough = passthroughAttrs(name);
    if (passthrough) return rebuildTag(slash, name, attrs, passthrough);
    if (DROPPED.has(name)) return "";
    const renamed = renamedTag(name);
    if (renamed) return `<${slash}${renamed}>`;
    if (TABLE_STRUCTURE.has(name)) return "";

    if (name === "table") {
      return closing ? "</tbody></table></div>" : '<div class="table"><table><tbody>';
    }
    if (name === "tr") return closing ? "</tr>" : "<tr>";
    if (TABLE_CELLS.has(name)) {
      return closing ? `</p></${name}>` : `<${name}><p align="left">`;
    }
    if (name === "p") return closing ? "</p>" : "<p>";
    if (name === "a") {
      if (closing) return "</a>";
      const href = attr(attrs, "href");
      // схему проверяем после раскрытия сущностей: `java&#9;script:` браузер прочтёт как `javascript:`
      const safe = href === undefined ? undefined : safeHref(md.utils.unescapeAll(href));
      return safe === undefined ? "<a>" : `<a href="${esc(safe)}" rel="noopener nofollow">`;
    }
    if (name === "abbr") {
      if (closing) return "</abbr>";
      return `<abbr class="habraabbr" title="${esc(attr(attrs, "title") ?? "")}">`;
    }
    if (name === "img") {
      const src = attr(attrs, "src") ?? "";
      if (/\sinline(\s|=|$)/i.test(` ${attrs}`)) {
        // inline-картинки Хабр принимает только со своего хранилища
        return isHabrImageUrl(src) ? `<img src="${esc(src)}">` : "";
      }
      const alt = esc(attr(attrs, "alt") ?? "");
      const width = attr(attrs, "width");
      const img = `<img src="${esc(resolveImageSrc(env, src))}" alt="${alt}"${width ? ` width="${esc(width)}"` : ""}>`;
      return block ? `<figure class="full-width">${img}${alt ? `<figcaption>${alt}</figcaption>` : ""}</figure>` : img;
    }
    if (name === "iframe") {
      if (closing) return "";
      const src = attr(attrs, "src");
      return src ? embedHtml(md, iframeToUrl(src)).trimEnd() : "";
    }
    // неизвестные теги (script, style, form...) выбрасываем вместе с атрибутами
    return "";
  });
}

export function htmlPlugin(md: HfmParser): void {
  md.core.ruler.push("hfm_html", (state) => {
    for (const token of state.tokens) {
      if (token.meta?.generated) continue;
      if (token.type === "html_block") {
        const cleaned = cleanHtml(md, token.content, true, state.env as HfmEnv);
        token.content = cleaned.trim() === "" ? "" : cleaned;
      } else if (token.type === "inline") {
        for (const child of token.children ?? []) {
          if (child.type === "html_inline" && !child.meta?.generated) {
            child.content = cleanHtml(md, child.content, false, state.env as HfmEnv);
          }
        }
      }
    }
  });
}
