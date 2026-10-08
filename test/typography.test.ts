import { describe, expect, it } from "vitest";
import { analyze } from "../src/diagnostics/analyze";
import { typographyFix } from "../src/diagnostics/typography";

const codes = (text: string): string[] => analyze(text).map((f) => f.code);
const fixOf = (text: string): string | undefined => {
  const [f] = analyze(text);
  return f ? typographyFix(f.code, text.slice(f.start, f.end)) : undefined;
};

describe("типографика: кавычки", () => {
  it("непарные", () => {
    expect(codes("Он сказал «привет")).toEqual(["quotes-unbalanced"]);
    expect(codes("Он сказал привет»")).toEqual(["quotes-unbalanced"]);
    expect(codes("Он сказал «привет»")).toEqual([]);
  });

  it("не тянет незакрытую кавычку в соседний абзац и пункт", () => {
    expect(codes("«раз\n\nдва» «три»")).toEqual(["quotes-unbalanced", "quotes-unbalanced"]);
    expect(codes("- «раз\n- «два»")).toEqual(["quotes-unbalanced"]);
  });

  it("вложенные ёлочки", () => {
    expect(codes("ОАО «Яндекс «Маркет»»")).toEqual(["quotes-nested"]);
    expect(codes("ОАО «Яндекс „Маркет“»")).toEqual([]);
  });

  it("латиница в кавычках только в русском тексте", () => {
    expect(codes("Установите «Docker» сейчас")).toEqual(["quotes-latin"]);
    expect(codes("Install «Docker» now")).toEqual([]);
    expect(fixOf("Установите «Docker» сейчас")).toBe("Docker");
  });
});

describe("типографика: тире", () => {
  it("дефис между словами", () => {
    expect(codes("Москва - Казань")).toEqual(["dash-hyphen"]);
    expect(fixOf("Москва - Казань")).toBe("—");
    expect(codes("Москва — Казань")).toEqual([]);
    expect(codes("- пункт списка")).toEqual([]);
    expect(codes("| а | б |\n| - | - |\n| в - г | д |")).toEqual(["dash-hyphen"]);
  });

  it("интервалы", () => {
    expect(codes("в 2005-2006 гг.")).toEqual(["dash-range"]);
    expect(fixOf("в 2005-2006 гг.")).toBe("2005–2006");
    expect(fixOf("за 1,5 - 2 месяца")).toBe("1,5–2");
    expect(codes("в 2005–2006 гг.")).toEqual([]);
  });

  it("не трогает даты, телефоны, версии и код", () => {
    expect(codes("тел 495-12-34 и 2020-01-15 и версия 1.2-3")).toEqual([]);
    expect(codes("пример `2005-2006` в коде")).toEqual([]);
    expect(codes("```\nМосква - Казань 2005-2006\n```")).toEqual([]);
    expect(codes("Ссылка https://a.b/2005-2006/x есть")).toEqual([]);
  });
});

describe("типографика: числа", () => {
  it("пробел перед единицей", () => {
    expect(codes("длина 15м и 20 км")).toEqual(["number-unit"]);
    expect(fixOf("длина 15м")).toBe("15 м");
    expect(codes("цвет 0x10mm и слово 5мкм")).toEqual([]);
  });

  it("разряды", () => {
    expect(codes("населяют 15600 человек")).toEqual(["number-thousands"]);
    expect(fixOf("населяют 15600 человек")).toBe("15 600");
    expect(fixOf("всего 1,000,000 человек")).toBe("1 000 000");
    expect(codes("в 2800 домах и 15 600 людей")).toEqual([]);
    expect(codes("номер 12345abc и 0,12345")).toEqual([]);
  });

  it("порядковые", () => {
    expect(codes("5-ый день, 7-ого числа")).toEqual(["ordinal-ending", "ordinal-ending"]);
    expect(fixOf("5-ый день")).toBe("5-й");
    expect(fixOf("7-ого числа")).toBe("7-го");
    expect(codes("5-й день, 5-го дня, в 79-м году")).toEqual([]);
  });

  it("даты", () => {
    expect(codes("родился 21.09.1975")).toEqual(["date-numeric"]);
    expect(codes("born 05/01/1993 это")).toEqual(["date-numeric"]);
    expect(codes("пришёл 01 января")).toEqual(["date-numeric"]);
    expect(codes("пришёл 1 января 1993 и IP 10.10.10.10")).toEqual([]);
  });
});

describe("типографика: имена", () => {
  it("инициалы", () => {
    expect(codes("писал А. С. Пушкин")).toEqual(["name-initials"]);
    expect(codes("писал Пушкин А. С.")).toEqual(["name-initials"]);
    expect(codes("писал Александр Пушкин")).toEqual([]);
  });
});

describe("типографика: настройка", () => {
  it("отключается опцией", () => {
    expect(analyze("Москва - Казань", { typography: false })).toEqual([]);
  });
});
