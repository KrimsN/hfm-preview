import type { RuleCode } from "./rules";

export interface Finding {
  code: RuleCode;
  /** Строка, с нуля */
  line: number;
  /** Столбцы, с нуля; end не включается */
  start: number;
  end: number;
  args?: Record<string, string>;
}
