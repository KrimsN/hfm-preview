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

const LEVELS = new Set<string>(["off", "error", "warning", "information", "hint"]);

/**
 * Уровень правила с учётом настройки `hfm.diagnostics.rules`; `undefined` — правило отключено.
 * Неизвестные значения в настройке игнорируются, действует уровень по умолчанию.
 */
export function effectiveSeverity(code: RuleCode, overrides: Readonly<Record<string, unknown>> = {}): Severity | undefined {
  const override = Object.hasOwn(overrides, code) ? overrides[code] : undefined;
  if (typeof override === "string" && LEVELS.has(override)) return override === "off" ? undefined : (override as Severity);
  return severityOf(code);
}
