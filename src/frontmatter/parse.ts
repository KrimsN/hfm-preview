import { isMap, isScalar, isSeq, parseDocument, type Node, type Scalar } from "yaml";
import type { Finding } from "../diagnostics/analyze";
import type { RuleCode } from "../diagnostics/rules";
import data from "../data/frontmatter.json";
import { findFrontmatter, type FrontmatterBlock } from "./block";

export interface ArticleMeta {
  title?: string;
  hubs?: string[];
  keywords?: string[];
  audience?: string;
  format?: string;
  difficulty?: string;
  language?: string;
  translation?: boolean;
  /** Путь к КДПВ как записан в файле (относительно статьи) */
  cover?: string;
  teaser?: string;
}

type FieldId = keyof typeof data.fields;

export interface Location {
  line: number;
  start: number;
  end: number;
}

export interface FrontmatterResult {
  block?: FrontmatterBlock;
  /** Только заполненные и корректные по типу поля; остальные `undefined` */
  meta: ArticleMeta;
  findings: Finding[];
  /** Где в файле записан путь к КДПВ (для перехода к файлу) */
  coverLocation?: Location;
}

export interface FrontmatterOptions {
  /** Проверка существования файла КДПВ; без неё существование не проверяется */
  coverExists?: (path: string) => boolean;
}

const FIELD_BY_KEY = new Map<string, FieldId>(
  (Object.keys(data.fields) as FieldId[]).map((id) => [data.fields[id].key, id]),
);
const KNOWN_KEYS = [...FIELD_BY_KEY.keys()].join(", ");
const URL_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;

const norm = (s: string): string => s.trim().toLocaleLowerCase("ru");

/** Длина в символах Unicode (code points), как её видит автор. */
export function charLength(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

/** Разметка, которой нет в ленте: там допустимы только текст и ссылки. */
export function teaserMarkup(text: string): string | undefined {
  const plain = text.replace(/(?<!!)\[[^\]\n]*\]\([^)\n]*\)/g, "x");
  const checks: [RegExp, string][] = [
    [/^\s{0,3}#{1,6}\s/m, "заголовок"],
    [/^\s{0,3}(?:[-*+]|\d+[.)])\s/m, "список"],
    [/^\s{0,3}>/m, "цитата"],
    [/!\[/, "картинка"],
    [/`/, "код"],
    [/(?:\*\*|__)\S/, "выделение"],
    [/<\/?[a-z][^>]*>/i, "HTML-тег"],
  ];
  return checks.find(([re]) => re.test(plain))?.[1];
}

export function parseFrontmatter(text: string, options: FrontmatterOptions = {}): FrontmatterResult {
  const block = findFrontmatter(text.split(/\r?\n/));
  const meta: ArticleMeta = {};
  const findings: Finding[] = [];
  if (!block) return { meta, findings };

  const yamlLines = block.yaml.split("\n");
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of yamlLines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  const at = (pos: number): { line: number; col: number } => {
    let i = lineStarts.length - 1;
    while (i > 0 && lineStarts[i]! > pos) i--;
    return { line: block.startLine + 1 + i, col: pos - lineStarts[i]! };
  };
  const span = (start: number, end: number): Location => {
    const from = at(start);
    const to = at(Math.max(start, end));
    return { line: from.line, start: from.col, end: to.line === from.line ? to.col : (yamlLines[from.line - block.startLine - 1]?.length ?? from.col) };
  };
  const spanOf = (node: Node | null | undefined, fallback: Location): Location => {
    if (!node?.range) return fallback;
    const [start, end] = node.range;
    const from = at(start);
    const to = at(end);
    // на несколько строк (блочный скаляр, список) показываем ключ
    return from.line === to.line ? span(start, end) : fallback;
  };
  const add = (code: RuleCode, at: Location, args?: Record<string, string>): void => {
    findings.push({ code, line: at.line, start: at.start, end: Math.max(at.end, at.start + 1), ...(args ? { args } : {}) });
  };

  // «Поле: -» — привычная запись «не указано»; для YAML это начало списка, поэтому гасим её, не сдвигая позиции
  const yamlText = block.yaml.replace(/^([^\s#][^:\n]*:[ \t]+)-[ \t]*$/gm, (whole, head: string) => head + " ".repeat(whole.length - head.length));
  const doc = parseDocument(yamlText, { uniqueKeys: true });
  for (const error of doc.errors) {
    const where = span(error.pos[0], error.pos[1]);
    add("fm-yaml", where, { message: error.message.split("\n")[0]! });
  }
  if (doc.errors.length > 0) return { block, meta, findings };

  const root = doc.contents;
  if (root === null) return { block, meta, findings };
  if (!isMap(root)) {
    add("fm-not-map", { line: block.startLine + 1, start: 0, end: yamlLines[0]?.length ?? 1 });
    return { block, meta, findings };
  }

  let coverLocation: Location | undefined;

  for (const pair of root.items) {
    const keyNode = pair.key as Scalar;
    const keyName = String(keyNode.value);
    const keyAt = spanOf(keyNode, { line: block.startLine + 1, start: 0, end: 1 });
    const id = FIELD_BY_KEY.get(keyName);
    if (!id) {
      add("fm-unknown-key", keyAt, { key: keyName, known: KNOWN_KEYS });
      continue;
    }

    const value = pair.value as Node | null;
    const where = spanOf(value, keyAt);

    if (isSeq(value)) {
      const items = value.items;
      if (id === "hubs" || id === "keywords") {
        if (items.some((item) => !isScalar(item))) add("fm-type-string", where, { key: keyName });
        const names = items.filter(isScalar).map((item) => String(item.value ?? "").trim()).filter(Boolean);
        if (names.length === 0) continue;
        meta[id === "hubs" ? "hubs" : "keywords"] = names;
        const max = id === "hubs" ? data.limits.maxHubs : data.limits.maxKeywords;
        if (names.length > max) add(id === "hubs" ? "fm-hubs-max" : "fm-keywords-max", keyAt, { max: String(max), count: String(names.length) });
      } else if (items.length > 0) {
        add("fm-type-string", where, { key: keyName });
      }
      continue;
    }
    if (isMap(value)) {
      add("fm-type-string", where, { key: keyName });
      continue;
    }

    const scalar = isScalar(value) ? value.value : null;
    const empty = scalar === null || scalar === undefined || (typeof scalar === "string" && scalar.trim() === "");
    if (empty) continue;

    if (id === "hubs" || id === "keywords") {
      add("fm-type-list", where, { key: keyName });
      continue;
    }
    if (id === "translation") {
      if (typeof scalar === "boolean") meta.translation = scalar;
      else add("fm-type-bool", where, { key: keyName });
      continue;
    }

    const str = String(scalar).trim();
    switch (id) {
      case "title":
      case "audience":
        meta[id] = str;
        break;
      case "language": {
        const lang = data.languages.find((l) => l === norm(str));
        if (lang) meta.language = lang;
        else add("fm-enum", where, { key: keyName, value: str, allowed: data.languages.join(", ") });
        break;
      }
      case "format": {
        if (norm(str) === "не указан") break;
        const format = data.formats.find((f) => norm(f.name) === norm(str));
        if (format) meta.format = format.name;
        else add("fm-enum", where, { key: keyName, value: str, allowed: data.formats.map((f) => f.name).join(", ") });
        break;
      }
      case "difficulty": {
        if (str === "-") break;
        const level = data.difficulties.find((d) => norm(d.name) === norm(str));
        if (level) meta.difficulty = level.name;
        else add("fm-enum", where, { key: keyName, value: str, allowed: data.difficulties.map((d) => d.name).join(", ") });
        break;
      }
      case "cover": {
        meta.cover = str;
        coverLocation = where;
        checkCover(str, where, add, options);
        break;
      }
      case "teaser": {
        meta.teaser = str;
        checkTeaser(str, keyAt, add);
        break;
      }
    }
  }

  return { block, meta, findings, ...(coverLocation ? { coverLocation } : {}) };
}

function checkCover(path: string, where: Location, add: (code: RuleCode, at: Location, args?: Record<string, string>) => void, options: FrontmatterOptions): void {
  if (URL_SCHEME.test(path)) {
    add("fm-cover-url", where);
    return;
  }
  const dot = path.lastIndexOf(".");
  const ext = dot > path.lastIndexOf("/") && dot > path.lastIndexOf("\\") ? path.slice(dot + 1).toLowerCase() : "";
  if (!data.coverExtensions.includes(ext)) {
    add("fm-cover-ext", where, { ext: ext || "—", allowed: data.coverExtensions.join(", ") });
    return;
  }
  if (options.coverExists && !options.coverExists(path)) add("fm-cover-missing", where, { path });
}

function checkTeaser(text: string, where: Location, add: (code: RuleCode, at: Location, args?: Record<string, string>) => void): void {
  const { teaserMin, teaserRecommendedMax, teaserMax } = data.limits;
  const count = charLength(text);
  const args = { count: String(count), min: String(teaserMin), rec: String(teaserRecommendedMax), max: String(teaserMax) };
  if (count > teaserMax) add("fm-teaser-max", where, args);
  else if (count > teaserRecommendedMax) add("fm-teaser-long", where, args);
  else if (count < teaserMin) add("fm-teaser-short", where, args);

  const markup = teaserMarkup(text);
  if (markup) add("fm-teaser-markup", where, { what: markup });
}
