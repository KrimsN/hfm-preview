import type { LiteElement } from "mathjax-full/js/adaptors/lite/Element.js";
import type { LiteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { LruCache } from "../lru";

export interface RenderedFormula {
  /** data: URI с SVG */
  src: string;
  /** Размеры в ex — как у формул Хабра */
  width: string;
  height: string;
  verticalAlign: string;
}

const CACHE_SIZE = 300;

interface Engine {
  adaptor: LiteAdaptor;
  document: ReturnType<typeof import("mathjax-full/js/mathjax.js").mathjax.document>;
}

let engine: Engine | undefined;

/**
 * MathJax тяжёлый (сотни миллисекунд на загрузку), а формулы нужны не в каждой статье:
 * поднимаем его при первой формуле, а не при активации расширения.
 */
function loadEngine(): Engine {
  if (engine) return engine;
  const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js") as typeof import("mathjax-full/js/adaptors/liteAdaptor.js");
  const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js") as typeof import("mathjax-full/js/handlers/html.js");
  const { TeX } = require("mathjax-full/js/input/tex.js") as typeof import("mathjax-full/js/input/tex.js");
  const { AllPackages } = require("mathjax-full/js/input/tex/AllPackages.js") as typeof import("mathjax-full/js/input/tex/AllPackages.js");
  const { mathjax } = require("mathjax-full/js/mathjax.js") as typeof import("mathjax-full/js/mathjax.js");
  const { SVG } = require("mathjax-full/js/output/svg.js") as typeof import("mathjax-full/js/output/svg.js");

  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  engine = {
    adaptor,
    document: mathjax.document("", {
      InputJax: new TeX({ packages: AllPackages }),
      OutputJax: new SVG({ fontCache: "none" }),
    }),
  };
  return engine;
}

const cache = new LruCache<string, RenderedFormula | null>(CACHE_SIZE);

/** TeX → SVG через MathJax; `null`, если формулу не удалось разобрать. */
export function renderFormula(tex: string, display: boolean): RenderedFormula | null {
  const key = `${display ? "d" : "i"}:${tex}`;
  const cached = cache.get(key);
  if (cached !== undefined || cache.has(key)) return cached ?? null;

  let result: RenderedFormula | null = null;
  try {
    const { adaptor, document } = loadEngine();
    const node = document.convert(tex, { display });
    const svg = adaptor.firstChild(node) as LiteElement | null;
    if (svg && !adaptor.outerHTML(svg).includes("merror")) {
      const markup = adaptor.outerHTML(svg).replace(/(<svg[^>]*?)\sstyle="[^"]*"/, "$1");
      const attr = (name: string) => adaptor.getAttribute(svg, name) ?? "";
      const style = adaptor.getAttribute(svg, "style") ?? "";
      result = {
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`,
        width: attr("width"),
        height: attr("height"),
        verticalAlign: /vertical-align:\s*([-\d.]+ex)/.exec(style)?.[1] ?? "0ex",
      };
    }
  } catch {
    result = null;
  }
  cache.set(key, result);
  return result;
}
