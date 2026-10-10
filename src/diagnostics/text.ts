/** Заменяет совпадения пробелами, сохраняя длину строки и позиции. */
export const blank = (text: string, re: RegExp): string => text.replace(re, (m) => " ".repeat(m.length));
