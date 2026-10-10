import MarkdownIt from "markdown-it";
import emoji from "../data/emoji.json";
import { suggestLanguage } from "../markdown/languages";
import type { RuleCode } from "./rules";
import { MONTHS_GENITIVE, TYPOGRAPHY_FIX_CODES, typographyFix } from "./typography";

/** Правка одной строки: заменить `[start, end)` на `text`. */
export interface LineFix {
  start: number;
  end: number;
  text: string;
  title: string;
}

const inline = new MarkdownIt({ html: true });

/** Заголовок без ссылок, кода и выделения: ровно то, что оставит Хабр. */
function plainHeading(line: string): string | undefined {
  const m = /^(\s*#{1,6}\s+)(.*?)(\s+#+)?\s*$/.exec(line);
  if (!m) return undefined;
  const children = inline.parseInline(m[2]!, {})[0]?.children ?? [];
  const text = children
    .filter((c) => ["text", "code_inline", "image"].includes(c.type))
    .map((c) => c.content)
    .join("");
  return m[1]! + text;
}

function replace(start: number, end: number, text: string, title?: string): LineFix {
  return { start, end, text, title: title ?? (text === "" ? "Удалить" : `Заменить на «${text}»`) };
}

/**
 * Быстрое исправление для диагностики или `undefined`, если автоисправления нет.
 * Чистая функция над строкой, где найдена проблема.
 */
export function fixFor(code: RuleCode, line: string, start: number, end: number): LineFix | undefined {
  const text = line.slice(start, end);

  if (TYPOGRAPHY_FIX_CODES.has(code)) {
    const fixed = typographyFix(code, text);
    return fixed === undefined ? undefined : replace(start, end, fixed);
  }

  switch (code) {
    case "code-language-synonym": {
      const suggestion = suggestLanguage(text);
      return suggestion ? replace(start, end, suggestion) : undefined;
    }
    case "link-title":
      return replace(start, end, "", "Удалить подсказку ссылки");
    case "task-list": {
      const gap = line[end] === " " ? 1 : 0; // вместе с пробелом после маркера
      return replace(start, end + gap, "", "Убрать маркер задачи");
    }
    case "image-link": {
      const m = /^\[(!\[[^\]]*\]\([^)]*\))\]\([^)]*\)$/.exec(text);
      return m ? replace(start, end, m[1]!, "Убрать ссылку вокруг картинки") : undefined;
    }
    case "heading-level":
      return replace(start, end, text.replace(/^#{4,6}/, "###"), "Сделать заголовком третьего уровня");
    case "heading-formatting": {
      const plain = plainHeading(text);
      return plain === undefined ? undefined : replace(start, end, plain, "Оставить в заголовке только текст");
    }
    case "table-align":
      return replace(start, end, text.replaceAll(":", ""), "Убрать выравнивание колонок");
    case "quote-nested":
      return replace(start, end, text.replace(/^(?:>\s?)+/, "> "), "Убрать вложенность цитаты");
    case "quote-heading":
      return replace(start, end, text.replace(/^((?:>\s?)*)#{1,6}\s+/, "$1"), "Убрать заголовок в цитате");
    case "strike-single-tilde":
      return replace(start, end, `~${text}~`, "Заменить на ~~…~~");
    case "typographic-quotes":
      return replace(start, end, `«${text.slice(1, -1)}»`);
    case "emoji-shortcode": {
      const symbol = (emoji as Record<string, string>)[text.slice(1, -1)];
      return symbol ? replace(start, end, symbol) : undefined;
    }
    case "date-numeric": {
      const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
      if (dotted) {
        const month = MONTHS_GENITIVE[Number(dotted[2]) - 1];
        return month ? replace(start, end, `${Number(dotted[1])} ${month} ${dotted[3]}`) : undefined;
      }
      const zero = /^0(\d)(\s.+)$/.exec(text);
      return zero ? replace(start, end, zero[1]! + zero[2]!) : undefined;
    }
    default:
      return undefined;
  }
}
