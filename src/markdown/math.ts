import type { LiteElement } from "mathjax-full/js/adaptors/lite/Element.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { SVG } from "mathjax-full/js/output/svg.js";

export interface RenderedFormula {
  /** data: URI с SVG */
  src: string;
  /** Размеры в ex — как у формул Хабра */
  width: string;
  height: string;
  verticalAlign: string;
}

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const document = mathjax.document("", {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: "none" }),
});

const cache = new Map<string, RenderedFormula | null>();

/** TeX → SVG через MathJax; `null`, если формулу не удалось разобрать. */
export function renderFormula(tex: string, display: boolean): RenderedFormula | null {
  const key = `${display ? "d" : "i"}:${tex}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let result: RenderedFormula | null = null;
  try {
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
