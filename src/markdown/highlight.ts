import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import { cmake } from "@codemirror/legacy-modes/mode/cmake";
import { coffeeScript } from "@codemirror/legacy-modes/mode/coffeescript";
import { commonLisp } from "@codemirror/legacy-modes/mode/commonlisp";
import { csharp, dart, kotlin, objectiveC, scala } from "@codemirror/legacy-modes/mode/clike";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { gas } from "@codemirror/legacy-modes/mode/gas";
import { haskell } from "@codemirror/legacy-modes/mode/haskell";
import { jinja2 } from "@codemirror/legacy-modes/mode/jinja2";
import { julia } from "@codemirror/legacy-modes/mode/julia";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { fSharp } from "@codemirror/legacy-modes/mode/mllike";
import { nginx } from "@codemirror/legacy-modes/mode/nginx";
import { octave } from "@codemirror/legacy-modes/mode/octave";
import { pascal } from "@codemirror/legacy-modes/mode/pascal";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { r } from "@codemirror/legacy-modes/mode/r";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { smalltalk } from "@codemirror/legacy-modes/mode/smalltalk";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { vbScript } from "@codemirror/legacy-modes/mode/vbscript";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
import type { Parser } from "@lezer/common";
import { highlightTree, tagHighlighter, tags as t } from "@lezer/highlight";

/** Не подсвечиваем огромные блоки: разбор синхронный. */
const MAX_LENGTH = 200_000;

const stream = (mode: StreamParser<unknown>) => (): Parser => StreamLanguage.define(mode).parser;

/** Имя языка Хабра → фабрика парсера. Языков без парсера (1c, elixir, vala) здесь нет. */
const PARSERS: Record<string, () => Parser> = {
  javascript: () => javascript().language.parser,
  typescript: () => javascript({ typescript: true }).language.parser,
  python: () => python().language.parser,
  cpp: () => cpp().language.parser,
  java: () => java().language.parser,
  rust: () => rust().language.parser,
  go: () => go().language.parser,
  css: () => css().language.parser,
  xml: () => xml().language.parser,
  json: () => json().language.parser,
  markdown: () => markdown().language.parser,
  sql: () => sql().language.parser,
  php: () => php({ plain: true }).language.parser,
  yaml: () => yaml().language.parser,
  bash: stream(shell),
  ruby: stream(ruby),
  perl: stream(perl),
  lua: stream(lua),
  swift: stream(swift),
  haskell: stream(haskell),
  erlang: stream(erlang),
  kotlin: stream(kotlin),
  scala: stream(scala),
  cs: stream(csharp),
  dart: stream(dart),
  objectivec: stream(objectiveC),
  diff: stream(diff),
  nginx: stream(nginx),
  powershell: stream(powerShell),
  r: stream(r),
  vbscript: stream(vbScript),
  delphi: stream(pascal),
  lisp: stream(commonLisp),
  smalltalk: stream(smalltalk),
  coffeescript: stream(coffeeScript),
  julia: stream(julia),
  cmake: stream(cmake),
  matlab: stream(octave),
  fsharp: stream(fSharp),
  vhdl: stream(vhdl),
  django: stream(jinja2),
  assembly: stream(gas),
};

const parserCache = new Map<string, Parser>();

function parserFor(language: string): Parser | undefined {
  const cached = parserCache.get(language);
  if (cached) return cached;
  const factory = PARSERS[language];
  if (!factory) return undefined;
  const parser = factory();
  parserCache.set(language, parser);
  return parser;
}

/**
 * Классы по ролям токенов Хабра (HFM_SPEC.md, «Подсветка кода»): ключевые слова, имена,
 * строки, макросы, литералы. Привязка к тегам Lezer, а не к именам классов Хабра.
 * Более специфичные теги идут раньше общих.
 */
const highlighter = tagHighlighter([
  { tag: t.macroName, class: "hl-macro" },
  { tag: [t.tagName, t.attributeName], class: "hl-name" },
  { tag: [t.comment], class: "hl-comment" },
  { tag: [t.string, t.regexp, t.escape, t.special(t.string)], class: "hl-str" },
  { tag: [t.number, t.bool, t.atom, t.null, t.meta, t.annotation, t.literal], class: "hl-lit" },
  { tag: [t.keyword, t.modifier, t.self, t.operatorKeyword], class: "hl-kw" },
  { tag: [t.variableName, t.propertyName, t.typeName, t.className, t.namespace, t.labelName, t.name], class: "hl-name" },
]);

/** Есть ли у языка разбор для подсветки. */
export function canHighlight(language: string): boolean {
  return language in PARSERS;
}

/**
 * Подсвечивает код и возвращает HTML для содержимого `<code>` либо `undefined`,
 * если языка нет в таблице или код слишком большой.
 */
export function highlightCode(code: string, language: string, escape: (s: string) => string): string | undefined {
  if (code.length > MAX_LENGTH) return undefined;
  const parser = parserFor(language);
  if (!parser) return undefined;

  try {
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
    highlightTree(tree, highlighter, (from, to, classes) => {
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
