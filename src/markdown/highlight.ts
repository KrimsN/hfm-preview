import type { StreamParser } from "@codemirror/language";
import type { Parser } from "@lezer/common";
import type { Highlighter } from "@lezer/highlight";
import { LruCache } from "../lru";

/** Не подсвечиваем огромные блоки: разбор синхронный. */
const MAX_LENGTH = 200_000;
/** Кэш подсветки: блок кода не меняется, пока автор правит текст рядом. */
const CACHE_SIZE = 200;
/** Большие блоки в кэш не кладём, чтобы он не раздувался. */
const MAX_CACHED_LENGTH = 20_000;

// CodeMirror тянет десятки модулей. Каждый язык загружается через require при первом использовании,
// поэтому активация расширения не платит за языки, которых нет в статье.

const stream = (load: () => StreamParser<unknown>) => (): Parser => {
  const { StreamLanguage } = require("@codemirror/language") as typeof import("@codemirror/language");
  return StreamLanguage.define(load()).parser;
};

/** Имя языка Хабра → фабрика парсера. Языков без парсера (1c, elixir, vala) здесь нет. */
const PARSERS: Record<string, () => Parser> = {
  javascript: () => (require("@codemirror/lang-javascript") as typeof import("@codemirror/lang-javascript")).javascript().language.parser,
  typescript: () => (require("@codemirror/lang-javascript") as typeof import("@codemirror/lang-javascript")).javascript({ typescript: true }).language.parser,
  python: () => (require("@codemirror/lang-python") as typeof import("@codemirror/lang-python")).python().language.parser,
  cpp: () => (require("@codemirror/lang-cpp") as typeof import("@codemirror/lang-cpp")).cpp().language.parser,
  java: () => (require("@codemirror/lang-java") as typeof import("@codemirror/lang-java")).java().language.parser,
  rust: () => (require("@codemirror/lang-rust") as typeof import("@codemirror/lang-rust")).rust().language.parser,
  go: () => (require("@codemirror/lang-go") as typeof import("@codemirror/lang-go")).go().language.parser,
  css: () => (require("@codemirror/lang-css") as typeof import("@codemirror/lang-css")).css().language.parser,
  xml: () => (require("@codemirror/lang-xml") as typeof import("@codemirror/lang-xml")).xml().language.parser,
  json: () => (require("@codemirror/lang-json") as typeof import("@codemirror/lang-json")).json().language.parser,
  markdown: () => (require("@codemirror/lang-markdown") as typeof import("@codemirror/lang-markdown")).markdown().language.parser,
  sql: () => (require("@codemirror/lang-sql") as typeof import("@codemirror/lang-sql")).sql().language.parser,
  php: () => (require("@codemirror/lang-php") as typeof import("@codemirror/lang-php")).php({ plain: true }).language.parser,
  yaml: () => (require("@codemirror/lang-yaml") as typeof import("@codemirror/lang-yaml")).yaml().language.parser,
  bash: stream(() => (require("@codemirror/legacy-modes/mode/shell") as typeof import("@codemirror/legacy-modes/mode/shell")).shell),
  ruby: stream(() => (require("@codemirror/legacy-modes/mode/ruby") as typeof import("@codemirror/legacy-modes/mode/ruby")).ruby),
  perl: stream(() => (require("@codemirror/legacy-modes/mode/perl") as typeof import("@codemirror/legacy-modes/mode/perl")).perl),
  lua: stream(() => (require("@codemirror/legacy-modes/mode/lua") as typeof import("@codemirror/legacy-modes/mode/lua")).lua),
  swift: stream(() => (require("@codemirror/legacy-modes/mode/swift") as typeof import("@codemirror/legacy-modes/mode/swift")).swift),
  haskell: stream(() => (require("@codemirror/legacy-modes/mode/haskell") as typeof import("@codemirror/legacy-modes/mode/haskell")).haskell),
  erlang: stream(() => (require("@codemirror/legacy-modes/mode/erlang") as typeof import("@codemirror/legacy-modes/mode/erlang")).erlang),
  kotlin: stream(() => (require("@codemirror/legacy-modes/mode/clike") as typeof import("@codemirror/legacy-modes/mode/clike")).kotlin),
  scala: stream(() => (require("@codemirror/legacy-modes/mode/clike") as typeof import("@codemirror/legacy-modes/mode/clike")).scala),
  cs: stream(() => (require("@codemirror/legacy-modes/mode/clike") as typeof import("@codemirror/legacy-modes/mode/clike")).csharp),
  dart: stream(() => (require("@codemirror/legacy-modes/mode/clike") as typeof import("@codemirror/legacy-modes/mode/clike")).dart),
  objectivec: stream(() => (require("@codemirror/legacy-modes/mode/clike") as typeof import("@codemirror/legacy-modes/mode/clike")).objectiveC),
  diff: stream(() => (require("@codemirror/legacy-modes/mode/diff") as typeof import("@codemirror/legacy-modes/mode/diff")).diff),
  nginx: stream(() => (require("@codemirror/legacy-modes/mode/nginx") as typeof import("@codemirror/legacy-modes/mode/nginx")).nginx),
  powershell: stream(() => (require("@codemirror/legacy-modes/mode/powershell") as typeof import("@codemirror/legacy-modes/mode/powershell")).powerShell),
  r: stream(() => (require("@codemirror/legacy-modes/mode/r") as typeof import("@codemirror/legacy-modes/mode/r")).r),
  vbscript: stream(() => (require("@codemirror/legacy-modes/mode/vbscript") as typeof import("@codemirror/legacy-modes/mode/vbscript")).vbScript),
  delphi: stream(() => (require("@codemirror/legacy-modes/mode/pascal") as typeof import("@codemirror/legacy-modes/mode/pascal")).pascal),
  lisp: stream(() => (require("@codemirror/legacy-modes/mode/commonlisp") as typeof import("@codemirror/legacy-modes/mode/commonlisp")).commonLisp),
  smalltalk: stream(() => (require("@codemirror/legacy-modes/mode/smalltalk") as typeof import("@codemirror/legacy-modes/mode/smalltalk")).smalltalk),
  coffeescript: stream(() => (require("@codemirror/legacy-modes/mode/coffeescript") as typeof import("@codemirror/legacy-modes/mode/coffeescript")).coffeeScript),
  julia: stream(() => (require("@codemirror/legacy-modes/mode/julia") as typeof import("@codemirror/legacy-modes/mode/julia")).julia),
  cmake: stream(() => (require("@codemirror/legacy-modes/mode/cmake") as typeof import("@codemirror/legacy-modes/mode/cmake")).cmake),
  matlab: stream(() => (require("@codemirror/legacy-modes/mode/octave") as typeof import("@codemirror/legacy-modes/mode/octave")).octave),
  fsharp: stream(() => (require("@codemirror/legacy-modes/mode/mllike") as typeof import("@codemirror/legacy-modes/mode/mllike")).fSharp),
  vhdl: stream(() => (require("@codemirror/legacy-modes/mode/vhdl") as typeof import("@codemirror/legacy-modes/mode/vhdl")).vhdl),
  django: stream(() => (require("@codemirror/legacy-modes/mode/jinja2") as typeof import("@codemirror/legacy-modes/mode/jinja2")).jinja2),
  assembly: stream(() => (require("@codemirror/legacy-modes/mode/gas") as typeof import("@codemirror/legacy-modes/mode/gas")).gas),
};

const parserCache = new Map<string, Parser>();

function parserFor(language: string): Parser | undefined {
  const cached = parserCache.get(language);
  if (cached) return cached;
  const factory = Object.hasOwn(PARSERS, language) ? PARSERS[language] : undefined;
  if (!factory) return undefined;
  const parser = factory();
  parserCache.set(language, parser);
  return parser;
}

type Lezer = typeof import("@lezer/highlight");
let lezer: { api: Lezer; highlighter: Highlighter } | undefined;

/**
 * Классы по ролям токенов Хабра (HFM_SPEC.md, «Подсветка кода»): ключевые слова, имена,
 * строки, макросы, литералы. Привязка к тегам Lezer, а не к именам классов Хабра.
 * Более специфичные теги идут раньше общих.
 */
function loadHighlighter(): { api: Lezer; highlighter: Highlighter } {
  if (lezer) return lezer;
  const api = require("@lezer/highlight") as Lezer;
  const { tags: t, tagHighlighter } = api;
  lezer = {
    api,
    highlighter: tagHighlighter([
      { tag: t.macroName, class: "hl-macro" },
      { tag: [t.tagName, t.attributeName], class: "hl-name" },
      { tag: [t.comment], class: "hl-comment" },
      { tag: [t.string, t.regexp, t.escape, t.special(t.string)], class: "hl-str" },
      { tag: [t.number, t.bool, t.atom, t.null, t.meta, t.annotation, t.literal], class: "hl-lit" },
      { tag: [t.keyword, t.modifier, t.self, t.operatorKeyword], class: "hl-kw" },
      { tag: [t.variableName, t.propertyName, t.typeName, t.className, t.namespace, t.labelName, t.name], class: "hl-name" },
    ]),
  };
  return lezer;
}

/** Есть ли у языка разбор для подсветки. */
export function canHighlight(language: string): boolean {
  return Object.hasOwn(PARSERS, language);
}

const cache = new LruCache<string, string | undefined>(CACHE_SIZE);

/**
 * Подсвечивает код и возвращает HTML для содержимого `<code>` либо `undefined`,
 * если языка нет в таблице или код слишком большой.
 * `escape` должен быть чистой функцией: результат кэшируется по языку и коду.
 */
export function highlightCode(code: string, language: string, escape: (s: string) => string): string | undefined {
  if (code.length > MAX_LENGTH || !canHighlight(language)) return undefined;

  const key = `${language}\0${code}`;
  const cacheable = code.length <= MAX_CACHED_LENGTH;
  if (cacheable && cache.has(key)) return cache.get(key);

  const html = render(code, language, escape);
  if (cacheable) cache.set(key, html);
  return html;
}

function render(code: string, language: string, escape: (s: string) => string): string | undefined {
  try {
    const parser = parserFor(language);
    if (!parser) return undefined;
    const { api, highlighter } = loadHighlighter();

    const tree = parser.parse(code);
    let html = "";
    let pos = 0;
    // соседние куски с одним классом (`println` и `!`) Хабр склеивает в один span
    let run: { from: number; to: number; classes: string } | undefined;
    const flush = (): void => {
      if (!run) return;
      if (run.from > pos) html += escape(code.slice(pos, run.from));
      html += `<span class="${run.classes}">${escape(code.slice(run.from, run.to))}</span>`;
      pos = run.to;
      run = undefined;
    };
    api.highlightTree(tree, highlighter, (from, to, classes) => {
      if (run && run.to === from && run.classes === classes) {
        run.to = to;
        return;
      }
      flush();
      run = { from, to, classes };
    });
    flush();
    return html + escape(code.slice(pos));
  } catch {
    return undefined;
  }
}
