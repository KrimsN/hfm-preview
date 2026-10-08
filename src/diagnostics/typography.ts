import type { Finding } from "./analyze";
import type { RuleCode } from "./rules";

/** Типографика по https://habr.com/ru/docs/authors/typographics/ — только то, что можно проверить по тексту. */

const CYRILLIC = /[А-Яа-яЁё]/;

const QUOTE_OPEN = "«";
const QUOTE_CLOSE = "»";
const LATIN_IN_QUOTES = /«([A-Za-z][\w .+#-]*)»/g;
const SPACED_DASH = /(?<=\S)( [-–] )(?=\S)/g;
const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
// в интервалах десятичная часть только через запятую: «1.2-3» — скорее версия
const RANGE_NUMBER = String.raw`\d+(?:,\d+)?`;
const RANGE = new RegExp(
  String.raw`(?<![\w.,:/+-])(${RANGE_NUMBER})(\s?[-–—]\s?)(${RANGE_NUMBER})(?![\w:/-]|[.,]\d)`,
  "g",
);
const UNITS = [
  "км", "кг", "мг", "см", "мм", "мл", "мс", "мин", "ГБ", "МБ", "КБ", "ТБ", "Гб", "Мб", "Кб", "Тб",
  "ГГц", "МГц", "кГц", "Гц", "кВт", "Вт", "м", "г", "т", "л", "ч",
  "MB", "GB", "KB", "TB", "GHz", "MHz", "kHz", "Hz", "kg", "km", "cm", "mm", "ms",
].join("|");
const NUMBER_UNIT = new RegExp(String.raw`(?<![\w.,-])(${NUMBER})(${UNITS})(?![\wА-Яа-яЁё])`, "g");
const PLAIN_THOUSANDS = /(?<![\w.,:/=#-])\d{5,}(?![\w.,]?\d|[A-Za-zА-Яа-яЁё_])/g;
const COMMA_THOUSANDS = /(?<![\w.,])\d{1,3}(?:,\d{3}){2,}(?![\w]|,\d)/g;
const ORDINAL_ENDINGS: Record<string, string> = {
  ый: "й", ий: "й", ой: "й", ого: "го", ому: "му", ым: "м", ом: "м",
  ая: "я", ое: "е", ые: "е", ую: "ю", ых: "х", ыми: "ми",
};
const ORDINAL = new RegExp(
  String.raw`(?<![\w.,-])(\d+)-(${Object.keys(ORDINAL_ENDINGS).join("|")})(?![\wА-Яа-яЁё])`,
  "g",
);
const MONTHS =
  "января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря";
const DATE_DOTTED = /(?<![\w.\/-])(?:0?[1-9]|[12]\d|3[01])\.(?:0?[1-9]|1[0-2])\.(?:\d{4}|\d{2})(?![\w.\/-])/g;
const DATE_SLASHED = /(?<![\w.\/-])(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/\d{4}(?![\w.\/-])/g;
const DATE_LEADING_ZERO = new RegExp(String.raw`(?<![\w.,-])0[1-9]\s(?:${MONTHS})(?![А-Яа-яЁё])`, "g");
const INITIALS_FIRST = /(?<![А-ЯЁа-яё])[А-ЯЁ]\.\s?[А-ЯЁ]\.\s?[А-ЯЁ][а-яё]+/g;
const INITIALS_LAST = /(?<![А-ЯЁа-яё])[А-ЯЁ][а-яё]+\s[А-ЯЁ]\.\s?[А-ЯЁ]\.(?![А-ЯЁа-яё])/g;
const BLOCK_START = /^\s*(?:[-+*]|\d+[.)])\s|^\s*#{1,6}\s|^\s*\|/;

const blank = (text: string, re: RegExp): string => text.replace(re, (m) => " ".repeat(m.length));

/** Оставляет только прозу: без адресов и формул. Код, теги и адреса ссылок уже закрыты вызывающим. */
function prose(masked: string): string {
  return blank(blank(masked, /(?:https?:\/\/|www\.)[^\s)>\]]+/g), /\$\$?[^$\n]+\$\$?/g);
}

type Report = (code: RuleCode, line: number, start: number, length: number) => void;

function checkQuotes(lines: string[], report: Report): void {
  let open: Array<[number, number]> = [];
  const flush = (): void => {
    for (const [line, col] of open) report("quotes-unbalanced", line, col, 1);
    open = [];
  };

  lines.forEach((text, n) => {
    if (text.trim() === "" || BLOCK_START.test(text)) flush();
    for (let col = 0; col < text.length; col++) {
      const ch = text[col];
      if (ch === QUOTE_OPEN) {
        if (open.length > 0) report("quotes-nested", n, col, 1);
        open.push([n, col]);
      } else if (ch === QUOTE_CLOSE) {
        if (open.length === 0) report("quotes-unbalanced", n, col, 1);
        else open.pop();
      }
    }
  });
  flush();
}

function checkLine(text: string, n: number, report: Report): void {
  if (!CYRILLIC.test(text)) return;

  for (const m of text.matchAll(LATIN_IN_QUOTES)) report("quotes-latin", n, m.index, m[0].length);

  for (const m of text.matchAll(SPACED_DASH)) {
    const before = text[m.index - 1] ?? "";
    const after = text[m.index + m[0].length] ?? "";
    if (/\d/.test(before) && /\d/.test(after)) continue; // интервал или арифметика — другое правило
    if ("|-*–—".includes(before) || "|-*–—".includes(after)) continue;
    report("dash-hyphen", n, m.index + 1, 1);
  }

  for (const m of text.matchAll(RANGE)) {
    if (m[2] !== "–") report("dash-range", n, m.index, m[0].length);
  }
  for (const m of text.matchAll(NUMBER_UNIT)) report("number-unit", n, m.index, m[0].length);
  for (const m of text.matchAll(PLAIN_THOUSANDS)) report("number-thousands", n, m.index, m[0].length);
  for (const m of text.matchAll(COMMA_THOUSANDS)) report("number-thousands", n, m.index, m[0].length);
  for (const m of text.matchAll(ORDINAL)) report("ordinal-ending", n, m.index, m[0].length);
  for (const re of [DATE_DOTTED, DATE_SLASHED, DATE_LEADING_ZERO]) {
    for (const m of text.matchAll(re)) report("date-numeric", n, m.index, m[0].length);
  }
  for (const re of [INITIALS_FIRST, INITIALS_LAST]) {
    for (const m of text.matchAll(re)) report("name-initials", n, m.index, m[0].length);
  }
}

/**
 * Типографические подсказки. `masked` — строки без кода, тегов и адресов ссылок
 * (пустые для строк, которые нужно пропустить).
 */
export function typographyFindings(masked: string[]): Finding[] {
  const findings: Finding[] = [];
  const report: Report = (code, line, start, length) => {
    findings.push({ code, line, start, end: start + length });
  };

  const text = masked.map(prose);
  checkQuotes(text, report);
  text.forEach((line, n) => checkLine(line, n, report));
  return findings;
}

/** Текст, на который можно заменить фрагмент, помеченный правилом; undefined — автоисправления нет. */
export function typographyFix(code: string, text: string): string | undefined {
  switch (code) {
    case "dash-hyphen":
      return "—";
    case "dash-range": {
      const m = new RegExp(`^(${RANGE_NUMBER})\\s?[-–—]\\s?(${RANGE_NUMBER})$`).exec(text);
      return m ? `${m[1]}–${m[2]}` : undefined;
    }
    case "number-unit": {
      const m = new RegExp(`^(${NUMBER})(.+)$`).exec(text);
      return m ? `${m[1]} ${m[2]}` : undefined;
    }
    case "number-thousands":
      return text.includes(",") ? text.replaceAll(",", " ") : text.replace(/\B(?=(\d{3})+$)/g, " ");
    case "ordinal-ending": {
      const m = /^(\d+)-(.+)$/.exec(text);
      const ending = m ? ORDINAL_ENDINGS[m[2]!] : undefined;
      return m && ending ? `${m[1]}-${ending}` : undefined;
    }
    case "quotes-latin":
      return text.slice(1, -1);
    default:
      return undefined;
  }
}

