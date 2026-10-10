import { ATTR_DROPPED_ON, DROPPED_ATTRS, DROPPED_TAGS, isHabrImageUrl } from "../../dialect";
import { HAS_SCHEME } from "../../markdown/env";
import type { Add } from "../context";

/**
 * Построчные проверки. Каждая смотрит на одно представление строки и сообщает о находках;
 * новое правило — новая функция в `LINE_CHECKS`.
 */
export interface LineView {
  /** Номер строки, с нуля */
  n: number;
  /** Строка без inline-кода и формул: здесь ищем ссылки, картинки и HTML */
  code: string;
  /** Строка без кода, формул, комментариев, тегов и адресов ссылок: здесь ищем «голый» текст */
  bare: string;
  /** Имена якорей документа */
  anchors: ReadonlySet<string>;
}

type LineCheck = (view: LineView, add: Add) => void;

const IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const IMAGE_LINK = /\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g;
const LINK = /(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)/g;
const FOOTNOTE = /\[\^[^\]\s]+\]/g;
const TASK = /^\s*(?:[-+*]|\d+[.)])\s+(\[[ xX]\])\s/;
const DROPPED_TAG = new RegExp(String.raw`<(${DROPPED_TAGS.join("|")})\b[^>]*>`, "gi");
// предел внутри тега нужен, чтобы строка из тысяч `<div ` без атрибутов не давала квадратичный перебор
const DROPPED_ATTR = new RegExp(
  String.raw`<(?:${ATTR_DROPPED_ON.join("|")})\b[^>]{0,500}?\s(${DROPPED_ATTRS.join("|")})\s*=`,
  "gi",
);
const INLINE_IMG = /<img\b[^>]*\sinline\b[^>]*>/gi;
const EMOJI = /(?<![\w:/])(:[a-z][a-z0-9_+-]*:)(?![\w:])/g;
const SINGLE_TILDE = /(?<![~\\])~(?!~)[^\s~](?:[^~\n]*[^\s~\\])?~(?!~)/g;
const STRAIGHT_QUOTES = /"[^"\n]+"/g;

function isRelative(path: string): boolean {
  return path !== "" && !path.startsWith("#") && !path.startsWith("/") && !HAS_SCHEME.test(path);
}

const imageLinks: LineCheck = ({ n, code }, add) => {
  for (const m of code.matchAll(IMAGE_LINK)) add("image-link", n, m.index, m.index + m[0].length);
};

const images: LineCheck = ({ n, code }, add) => {
  for (const m of code.matchAll(IMAGE)) {
    const src = m[1]!;
    const at = m.index + m[0].indexOf(src);
    if (isRelative(src) || (src.startsWith("/") && !src.startsWith("//"))) {
      add("image-relative", n, at, at + src.length, { src });
    } else if (/^https?:\/\//i.test(src) && !isHabrImageUrl(src)) {
      add("image-external", n, at, at + src.length);
    }
  }
};

const links: LineCheck = ({ n, code, anchors }, add) => {
  for (const m of code.matchAll(LINK)) {
    const href = m[1]!;
    const at = m.index + m[0].indexOf(href);
    if (href.startsWith("#")) {
      let name = href.slice(1);
      try {
        name = decodeURIComponent(name);
      } catch {
        // оставляем как написано
      }
      if (name && !anchors.has(name)) add("anchor-missing", n, at, at + href.length, { name });
    } else if (isRelative(href)) {
      add("link-relative", n, at, at + href.length, { href });
    }
    if (m[2] !== undefined) add("link-title", n, at + href.length, m.index + m[0].length - 1);
  }
};

const footnotes: LineCheck = ({ n, code }, add) => {
  for (const m of code.matchAll(FOOTNOTE)) add("footnote", n, m.index, m.index + m[0].length);
};

const taskLists: LineCheck = ({ n, code }, add) => {
  const task = TASK.exec(code);
  if (!task) return;
  const at = task[0].indexOf(task[1]!);
  add("task-list", n, at, at + task[1]!.length);
};

const droppedTags: LineCheck = ({ n, code }, add) => {
  for (const m of code.matchAll(DROPPED_TAG)) {
    add("html-dropped", n, m.index, m.index + m[0].length, { tag: m[1]!.toLowerCase() });
  }
};

const droppedAttributes: LineCheck = ({ n, code }, add) => {
  for (const m of code.matchAll(DROPPED_ATTR)) {
    const attr = m[1]!.toLowerCase();
    const at = m.index + m[0].length - attr.length - 1;
    add("html-attr-dropped", n, at, at + attr.length, { attr });
  }
};

const inlineImages: LineCheck = ({ n, code }, add) => {
  for (const m of code.matchAll(INLINE_IMG)) {
    const src = /\ssrc\s*=\s*["']([^"']*)["']/i.exec(m[0])?.[1] ?? "";
    if (!isHabrImageUrl(src)) add("inline-image-external", n, m.index, m.index + m[0].length);
  }
};

const emojiShortcodes: LineCheck = ({ n, bare }, add) => {
  for (const m of bare.matchAll(EMOJI)) add("emoji-shortcode", n, m.index, m.index + m[0].length, { code: m[1]! });
};

const singleTilde: LineCheck = ({ n, bare }, add) => {
  for (const m of bare.matchAll(SINGLE_TILDE)) add("strike-single-tilde", n, m.index, m.index + m[0].length);
};

const straightQuotes: LineCheck = ({ n, bare }, add) => {
  for (const m of bare.matchAll(STRAIGHT_QUOTES)) add("typographic-quotes", n, m.index, m.index + m[0].length);
};

export const LINE_CHECKS: readonly LineCheck[] = [
  imageLinks,
  images,
  links,
  footnotes,
  taskLists,
  droppedTags,
  droppedAttributes,
  inlineImages,
  emojiShortcodes,
  singleTilde,
  straightQuotes,
];
