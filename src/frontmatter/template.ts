import data from "../data/frontmatter.json";

const f = data.fields;

/** Заготовка frontmatter со всеми полями; заполнять их необязательно. */
export function frontmatterTemplate(eol = "\n"): string {
  return [
    "---",
    `${f.title.key}:`,
    `${f.hubs.key}: []`,
    `${f.keywords.key}: []`,
    `${f.audience.key}:`,
    `${f.format.key}:`,
    `${f.difficulty.key}:`,
    `${f.language.key}:`,
    `${f.translation.key}:`,
    `${f.cover.key}:`,
    `${f.teaser.key}: |`,
    "---",
    "",
    "",
  ].join(eol);
}

/** Строка и столбец конца значения у первого поля («Заголовок:»): сюда ставим курсор после вставки. */
export const TEMPLATE_CURSOR = { line: 1, character: `${f.title.key}: `.length };
