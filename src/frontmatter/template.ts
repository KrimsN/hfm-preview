import { fieldById, FIELDS } from "./schema";

const title = fieldById("title")!;

/** Заготовка frontmatter со всеми полями; заполнять их необязательно. */
export function frontmatterTemplate(eol = "\n"): string {
  const fields = FIELDS.map((field) => (field.template ? `${field.key}: ${field.template}` : `${field.key}:`));
  return ["---", ...fields, "---", "", ""].join(eol);
}

/** Строка и столбец конца значения у первого поля («Заголовок:»): сюда ставим курсор после вставки. */
export const TEMPLATE_CURSOR = { line: 1, character: `${title.key}: `.length };
