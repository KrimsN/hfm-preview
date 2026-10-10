/** Окружение рендера: то, что парсер не может узнать из самого текста. */
export type HfmEnv = {
  /** Добавлять блокам `data-line` для синхронизации прокрутки превью. */
  sourceLines?: boolean;
  /** Превращает относительный путь картинки в адрес, доступный webview. */
  resolveImage?: (src: string) => string | undefined;
};

export const HAS_SCHEME = /^([a-z][a-z\d+.-]*:|\/\/)/i;

export function isRelativeSrc(src: string): boolean {
  return src !== "" && !HAS_SCHEME.test(src);
}

export function resolveImageSrc(env: HfmEnv | undefined, src: string): string {
  if (!isRelativeSrc(src)) return src;
  return env?.resolveImage?.(src) ?? src;
}
