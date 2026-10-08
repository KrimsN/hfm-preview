import type { HfmParser } from "../createParser";

/**
 * Разметка таблицы как в опубликованной статье: `div.table > table > tbody`,
 * первая строка — `th`, содержимое ячеек в `<p align="left">`, выравнивание колонок игнорируется.
 */
export function tablesPlugin(md: HfmParser): void {
  const rules = md.renderer.rules;
  const emit = (html: string) => () => html;

  rules.table_open = emit('<div class="table"><table><tbody>\n');
  rules.table_close = emit("</tbody></table></div>\n");
  for (const name of ["thead_open", "thead_close", "tbody_open", "tbody_close"]) {
    rules[name] = emit("");
  }
  rules.th_open = emit('<th><p align="left">');
  rules.th_close = emit("</p></th>");
  rules.td_open = emit('<td><p align="left">');
  rules.td_close = emit("</p></td>");
}
