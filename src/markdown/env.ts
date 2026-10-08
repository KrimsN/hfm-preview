/** Окружение рендера: то, что парсер не может узнать из самого текста. */
export type HfmEnv = {
  /** Превращает относительный путь картинки в адрес, доступный webview. */
  /** Добавлять блокам `data-line` для синхронизации прокрутки превью. */
  sourceLines?: boolean;
  resolveImage?: (src: string) => string | undefined;
};

const HAS_SCHEME = /^([a-z][a-z\d+.-]*:|\/\/)/i;

export function isRelativeSrc(src: string): boolean {
  return src !== "" && !HAS_SCHEME.test(src);
}

export function resolveImageSrc(env: HfmEnv | undefined, src: string): string {
  if (!isRelativeSrc(src)) return src;
  return env?.resolveImage?.(src) ?? src;
}
