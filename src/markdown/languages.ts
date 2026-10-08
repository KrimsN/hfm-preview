import data from "../data/languages.json";

const supported = new Set(data.supported);

/** Имя языка, которое Хабр подсветит, либо `undefined` (синонимы не работают). */
export function resolveLanguage(info: string): string | undefined {
  const name = info.trim().split(/\s+/)[0]?.toLowerCase();
  return name && supported.has(name) ? name : undefined;
}

/** Подсказка для диагностики: во что заменить синоним. */
export function suggestLanguage(info: string): string | undefined {
  const name = info.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return (data.synonyms as Record<string, string>)[name];
}
