import type { HfmParser } from "../createParser";
import type { HfmEnv } from "../env";

/**
 * Помечает блоки атрибутом `data-line` (строка исходника, с нуля): по нему превью
 * синхронизирует прокрутку с редактором. Включается только флагом `env.sourceLines`,
 * чтобы эталонный HTML и тесты остались без служебных атрибутов. Должен идти последним.
 */
export function sourceLinesPlugin(md: HfmParser): void {
  md.core.ruler.push("hfm_source_lines", (state) => {
    if (!(state.env as HfmEnv | undefined)?.sourceLines) return;

    for (const token of state.tokens) {
      if (!token.map || token.nesting === -1) continue;
      const line = String(token.map[0]);

      if (token.type === "html_block") {
        // метка на первый тег блока; закрывающие теги и комментарии остаются как есть
        token.content = token.content.replace(/^(\s*<[a-zA-Z][\w-]*)/, `$1 data-line="${line}"`);
      } else {
        token.attrSet("data-line", line);
      }
    }
  });
}
