import type { RuleCode } from "./rules";

export type Add = (code: RuleCode, line: number, start: number, end: number, args?: Record<string, string>) => void;

/** Что нужно проверке, чтобы сообщить о находке. */
export interface Reporter {
  add: Add;
  /** Отмечает строку целиком, без начальных и конечных пробелов */
  wholeLine: (code: RuleCode, line: number) => void;
}
