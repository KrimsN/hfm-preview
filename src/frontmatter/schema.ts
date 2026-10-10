import data from "../data/frontmatter.json";
import type { RuleCode } from "../diagnostics/rules";

/**
 * Схема полей frontmatter. Всё, что знает про поле (ключ, тип, справочник, лимит), лежит в
 * `data/frontmatter.json`: валидатор, автодополнение и заготовка строятся из неё одинаково.
 */

export type FieldType = "string" | "list" | "enum" | "bool" | "path" | "text";

export interface Option {
  name: string;
  description: string;
}

export interface FieldSchema {
  id: string;
  /** Ключ в файле, по-русски */
  key: string;
  detail: string;
  type: FieldType;
  /** Допустимые значения справочника (для `enum`) и подсказки значений (для `bool`) */
  options?: Option[];
  /** Значение «не указано», которое принимается без ошибки */
  none?: string;
  /** Имя предела в `limits` для списков и правило, которое срабатывает при превышении */
  limit?: keyof typeof data.limits;
  limitRule?: RuleCode;
  /** Что писать после `Ключ: ` в заготовке; пусто — ничего */
  template?: string;
}

export const FIELDS: readonly FieldSchema[] = Object.entries(data.fields).map(
  ([id, field]) => ({ id, ...field }) as FieldSchema,
);

export const LIMITS = data.limits;
export const COVER_EXTENSIONS: readonly string[] = data.coverExtensions;

const byKey = new Map(FIELDS.map((field) => [field.key, field]));

export const fieldByKey = (key: string): FieldSchema | undefined => byKey.get(key);
export const fieldById = (id: string): FieldSchema | undefined => FIELDS.find((field) => field.id === id);
