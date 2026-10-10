import rules from "../data/diagnostics.json";

export type Severity = "error" | "warning" | "information" | "hint";
export type RuleCode = keyof typeof rules;

/** Код правила из данных: диагностика приходит из VS Code строкой, и проверить её надо до использования. */
export function isRuleCode(code: string): code is RuleCode {
  return Object.hasOwn(rules, code);
}

export function severityOf(code: RuleCode): Severity {
  return rules[code].severity as Severity;
}

/** Подставляет `{name}` из args в шаблон сообщения правила. */
export function formatMessage(code: RuleCode, args: Record<string, string> = {}): string {
  return rules[code].message.replace(/\{(\w+)\}/g, (whole, key: string) => args[key] ?? whole);
}
