import rules from "../data/diagnostics.json";

export type Severity = "error" | "warning" | "information" | "hint";
export type RuleCode = keyof typeof rules;

export function severityOf(code: RuleCode): Severity {
  return rules[code].severity as Severity;
}

/** Подставляет `{name}` из args в шаблон сообщения правила. */
export function formatMessage(code: RuleCode, args: Record<string, string> = {}): string {
  return rules[code].message.replace(/\{(\w+)\}/g, (whole, key: string) => args[key] ?? whole);
}
