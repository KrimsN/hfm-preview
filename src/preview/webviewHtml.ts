export type PreviewTheme = "auto" | "light" | "dark";

export interface WebviewHtmlOptions {
  cspSource: string;
  nonce: string;
  styleUri: string;
  scriptUri: string;
  /** `light` или `dark`; `auto` — тема VS Code */
  theme: PreviewTheme;
  /** Адрес документа: по нему панель восстанавливается после перезапуска VS Code */
  documentUri: string;
  /** Уже отрендеренное тело статьи */
  body: string;
}

const escapeAttr = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function buildWebviewHtml(o: WebviewHtmlOptions): string {
  const csp = [
    "default-src 'none'",
    `style-src ${o.cspSource} 'unsafe-inline'`,
    `img-src ${o.cspSource} https: data:`,
    `font-src ${o.cspSource}`,
    `script-src 'nonce-${o.nonce}'`,
  ].join("; ");
  const theme = o.theme === "auto" ? "" : ` data-theme="${o.theme}"`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${o.styleUri}">
</head>
<body${theme} data-document-uri="${escapeAttr(o.documentUri)}">
  <article id="content" class="habr-article">${o.body}</article>
  <script nonce="${o.nonce}" src="${o.scriptUri}"></script>
</body>
</html>`;
}
