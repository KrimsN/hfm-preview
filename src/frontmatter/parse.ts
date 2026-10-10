import { isMap, isScalar, isSeq, parseDocument, type Node, type Scalar } from "yaml";
import type { Finding } from "../diagnostics/types";
import type { RuleCode } from "../diagnostics/rules";
import { findFrontmatter, type FrontmatterBlock } from "./block";
import { COVER_EXTENSIONS, FIELDS, fieldByKey, LIMITS } from "./schema";

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

const KNOWN_KEYS = FIELDS.map((field) => field.key).join(", ");
const URL_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;

function setMeta(meta: ArticleMeta, id: keyof ArticleMeta, value: string | boolean | string[]): void {
  (meta as Record<string, string | boolean | string[]>)[id] = value;
}

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
    const field = fieldByKey(keyName);
    if (!field) {
      add("fm-unknown-key", keyAt, { key: keyName, known: KNOWN_KEYS });
      continue;
    }
    const id = field.id as keyof ArticleMeta;

    const value = pair.value as Node | null;
    const where = spanOf(value, keyAt);

    if (isSeq(value)) {
      const items = value.items;
      if (field.type === "list") {
        if (items.some((item) => !isScalar(item))) add("fm-type-string", where, { key: keyName });
        const names = items.filter(isScalar).map((item) => String(item.value ?? "").trim()).filter(Boolean);
        if (names.length === 0) continue;
        setMeta(meta, id, names);
        const max = field.limit ? LIMITS[field.limit] : Infinity;
        if (field.limitRule && names.length > max) {
          add(field.limitRule, keyAt, { max: String(max), count: String(names.length) });
        }
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

    if (field.type === "list") {
      add("fm-type-list", where, { key: keyName });
      continue;
    }
    if (field.type === "bool") {
      if (typeof scalar === "boolean") setMeta(meta, id, scalar);
      else add("fm-type-bool", where, { key: keyName });
      continue;
    }

    const str = String(scalar).trim();
    switch (field.type) {
      case "string":
        setMeta(meta, id, str);
        break;
      case "enum": {
        if (field.none !== undefined && norm(str) === norm(field.none)) break;
        const options = field.options ?? [];
        const option = options.find((o) => norm(o.name) === norm(str));
        if (option) setMeta(meta, id, option.name);
        else add("fm-enum", where, { key: keyName, value: str, allowed: options.map((o) => o.name).join(", ") });
        break;
      }
      case "path":
        setMeta(meta, id, str);
        coverLocation = where;
        checkCover(str, where, add, options);
        break;
      case "text":
        setMeta(meta, id, str);
        checkTeaser(str, keyAt, add);
        break;
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
  if (!COVER_EXTENSIONS.includes(ext)) {
    add("fm-cover-ext", where, { ext: ext || "—", allowed: COVER_EXTENSIONS.join(", ") });
    return;
  }
  if (options.coverExists && !options.coverExists(path)) add("fm-cover-missing", where, { path });
}

function checkTeaser(text: string, where: Location, add: (code: RuleCode, at: Location, args?: Record<string, string>) => void): void {
  const { teaserMin, teaserRecommendedMax, teaserMax } = LIMITS;
  const count = charLength(text);
  const args = { count: String(count), min: String(teaserMin), rec: String(teaserRecommendedMax), max: String(teaserMax) };
  if (count > teaserMax) add("fm-teaser-max", where, args);
  else if (count > teaserRecommendedMax) add("fm-teaser-long", where, args);
  else if (count < teaserMin) add("fm-teaser-short", where, args);

  const markup = teaserMarkup(text);
  if (markup) add("fm-teaser-markup", where, { what: markup });
}
