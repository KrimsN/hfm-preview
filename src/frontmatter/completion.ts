import data from "../data/frontmatter.json";

export interface FrontmatterCompletion {
  label: string;
  detail?: string;
  /** Что вставить вместо набранного */
  insert: string;
  kind: "key" | "value";
}

const KEY_LINE = /^([^\s#:-][^:]*)$/;
const VALUE_LINE = /^([^\s#:-][^:]*):[ \t]*([^\s\]\[,]*)$/;
const KEY_AT_START = /^([^\s#:-][^:]*):/;

const fieldKeys = Object.values(data.fields);
const BOOLEANS = [
  { label: "true", detail: "Публикация является переводом" },
  { label: "false", detail: "Оригинальная публикация" },
];

function valuesFor(key: string): { label: string; detail?: string }[] {
  const id = fieldKeys.find((field) => field.key === key.trim());
  switch (id?.key) {
    case data.fields.format.key:
      return data.formats.map((v) => ({ label: v.name, detail: v.description }));
    case data.fields.difficulty.key:
      return data.difficulties.map((v) => ({ label: v.name, detail: v.description }));
    case data.fields.language.key:
      return data.languages.map((label) => ({ label, detail: label === "ru" ? "Русский" : "Английский" }));
    case data.fields.translation.key:
      return BOOLEANS;
    default:
      return [];
  }
}

/** Ключи, уже записанные в блоке (строки вида `Ключ: …` без отступа). */
export function presentKeys(blockLines: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const line of blockLines) {
    const key = KEY_AT_START.exec(line)?.[1];
    if (key) keys.add(key.trim());
  }
  return keys;
}

/**
 * Варианты для строки внутри frontmatter по тексту слева от курсора:
 * в начале строки — ещё не записанные поля, после двоеточия — значения справочников.
 * `typed` — сколько символов слева от курсора уже набрано и будет заменено.
 */
export function frontmatterCompletions(
  linePrefix: string,
  present: ReadonlySet<string>,
): { typed: number; items: FrontmatterCompletion[] } {
  if (linePrefix === "" || KEY_LINE.test(linePrefix)) {
    const typed = linePrefix.toLocaleLowerCase("ru");
    const items = fieldKeys
      .filter((field) => !present.has(field.key) && field.key.toLocaleLowerCase("ru").startsWith(typed))
      .map((field) => ({ label: field.key, detail: field.detail, insert: `${field.key}: `, kind: "key" as const }));
    return { typed: linePrefix.length, items };
  }

  const value = VALUE_LINE.exec(linePrefix);
  if (!value) return { typed: 0, items: [] };
  const typed = value[2]!;
  const items = valuesFor(value[1]!)
    .filter((v) => v.label.toLocaleLowerCase("ru").startsWith(typed.toLocaleLowerCase("ru")))
    .map((v) => ({ label: v.label, ...(v.detail ? { detail: v.detail } : {}), insert: v.label, kind: "value" as const }));
  return { typed: typed.length, items };
}
