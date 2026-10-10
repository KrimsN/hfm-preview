/**
 * Приведение HTML предпросмотра Хабра и нашего вывода к одному виду.
 * Убирает то, что зависит от редактора или внешнего мира: подсветку, обёртки таблиц,
 * хэши формул, подписи embed, id iframe.
 *
 * Подсветку сравниваем только по тексту кода. Хабр называет классы хэшами CodeMirror (ͼ5, ͼ7),
 * номера зависят от страницы, а границы токенов у XML и Python расходятся с нашей сборкой Lezer
 * (проверено при ужесточении: T16 — отдельные токены `&lt;`/`div`, стрелка `->`). Классы и цвета
 * подсветки проверяются глазами по HFM_SPEC.md.
 */
export function normalizeHtml(html: string): string {
  return html
    .replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (_, attrs: string, body: string) => {
      const text = body.replace(/<br>/g, "\n").replace(/<\/?span[^>]*>/g, "");
      return `<pre><code${attrs}>${text.replace(/\s+$/, "")}</code></pre>`;
    })
    .replace(/&quot;/g, '"')
    // пустой alt: Хабр пишет его у картинок без подписи, мы нет; для читателя разницы нет
    .replace(/ alt=""/g, "")
    // embed: содержимое приходит с сервера Хабра, сравниваем только вид и адрес
    .replace(/<iframe[^>]*class="embed_video[^>]*><\/iframe>|<a class="embed_video[^>]*>[\s\S]*?<\/a>/g, "<embed-video>")
    .replace(
      /<div class="embed_link">[\s\S]*?<a href="([^"]*)"[^>]*class="embed__caption-host">[^<]*<\/a><\/div><\/div>/g,
      '<embed-link href="$1">',
    )
    .replace(/<img class="formula( inline)?"[^>]*? source="([^"]*)"[^>]*>/g, '<formula$1 source="$2">')
    .replace(/<div><div class="table"><div class="table table_wrapped">([\s\S]*?)<\/div><\/div><\/div>/g, '<div class="table">$1</div>')
    // предпросмотр рисует abbr своими data-атрибутами, опубликованная статья — через title
    .replace(/<abbr class="habraabbr" data-title="[^"]*" data-abbr="[^"]*" data-text-title="([^"]*)">/g, '<abbr class="habraabbr" title="$1">')
    // предпросмотр обёртывает figcaption в div и оставляет title у img
    .replace(/<div>(<figcaption>[\s\S]*?<\/figcaption>)<\/div>/g, "$1")
    // title у img предпросмотр дублирует из alt, в опубликованной статье его нет
    .replace(/(<img [^>]*?) title="[^"]*"/g, "$1")
    .replace(/<figure class="[^"]*">/g, "<figure>")
    // Хабр дописывает схему ссылкам без неё; превью показывает ссылку как написана, диагностика предупреждает
    .replace(/(href|src)="https:\/\/\.\//g, '$1="./')
    // target=_blank ставит клиентский скрипт Хабра, в разметке статьи его нет
    .replace(/ target="_blank"/g, "")
    .replace(/ rel="noopener noreferrer nofollow"/g, ' rel="noopener nofollow"')
    // одиночный перенос строки в тексте — пробел
    .replace(/([^>\s])[ \t]*\n[ \t]*([^<\s])/g, "$1 $2")
    .replace(/\s*\n\s*/g, "")
    .replace(/<br>\s+/g, "<br>")
    .replace(/>\s+</g, "><")
    .replace(/ +</g, "<")
    .trim();
}
