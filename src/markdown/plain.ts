import MarkdownIt, { type Token } from "markdown-it";

// «Чистый» парсер без плагинов HFM: нужны уровни и строки исходника, а не сдвиг уровней Хабра
const plain = new MarkdownIt({ html: true, linkify: false });

let last: { text: string; tokens: Token[] } | undefined;

/**
 * Токены текста. Диагностика, outline, оглавление и автодополнение разбирают один и тот же текст
 * подряд, поэтому последний результат запоминаем. Токены нельзя изменять.
 */
export function parseTokens(text: string): readonly Token[] {
  if (last?.text !== text) last = { text, tokens: plain.parse(text, {}) };
  return last.tokens;
}
