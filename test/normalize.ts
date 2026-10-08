/**
 * Приведение HTML предпросмотра Хабра и нашего вывода к одному виду.
 * Убирает то, что зависит от редактора или внешнего мира: подсветку, обёртки таблиц,
 * хэши формул, подписи embed, id iframe.
 */
export function normalizeHtml(html: string): string {
  return html
    .replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (_, attrs: string, body: string) => {
      const text = body.replace(/<br>/g, "\n").replace(/<\/?span[^>]*>/g, "");
      return `<pre><code${attrs}>${text.replace(/\s+$/, "")}</code></pre>`;
    })
    .replace(/&quot;/g, '"')
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
    .replace(/(<img [^>]*?) title="[^"]*"/g, "$1")
    .replace(/<figure class="[^"]*">/g, "<figure>")
    // Хабр дописывает схему ссылкам без неё; превью показывает ссылку как написана, диагностика предупреждает
    .replace(/(href|src)="https:\/\/\.\//g, '$1="./')
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
