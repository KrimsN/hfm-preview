export interface FrontmatterBlock {
  /** Строка открывающего `---`, с нуля (всегда 0) */
  startLine: number;
  /** Строка закрывающего `---` или `...` */
  endLine: number;
  /** YAML между ограждениями; строка `yaml` начинается со строки `startLine + 1` */
  yaml: string;
}

const FENCE_OPEN = /^\uFEFF?---[ \t]*$/;
const FENCE_CLOSE = /^(?:---|\.\.\.)[ \t]*$/;

/** Блок YAML в самом начале документа. Без закрывающего ограждения блока нет: это обычная линия `---`. */
export function findFrontmatter(lines: readonly string[]): FrontmatterBlock | undefined {
  if (!FENCE_OPEN.test(lines[0] ?? "")) return undefined;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE_CLOSE.test(lines[i]!)) return { startLine: 0, endLine: i, yaml: lines.slice(1, i).join("\n") };
  }
  return undefined;
}

/**
 * Текст без frontmatter: строки блока очищаются, но остаются на месте,
 * поэтому номера строк остальных конструкций (диагностики, outline, синхронизация прокрутки) не сдвигаются.
 */
export function maskFrontmatter(text: string): string {
  const parts = text.split(/(\r?\n)/);
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i += 2) lines.push(parts[i]!);

  const block = findFrontmatter(lines);
  if (!block) return text;
  for (let line = block.startLine; line <= block.endLine; line++) parts[line * 2] = "";
  return parts.join("");
}
