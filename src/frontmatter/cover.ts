import { dirname, isAbsolute, resolve } from "node:path";

/** Абсолютный путь к КДПВ: относительные пути считаются от папки статьи. */
export function resolveCover(documentPath: string, cover: string): string {
  return isAbsolute(cover) ? cover : resolve(dirname(documentPath), cover);
}
