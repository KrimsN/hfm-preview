export interface WebviewHtmlOptions {
  cspSource: string;
  nonce: string;
  styleUri: string;
  scriptUri: string;
  /** Уже отрендеренное тело статьи */
  body: string;
}

export function buildWebviewHtml(o: WebviewHtmlOptions): string {
  const csp = [
    "default-src 'none'",
    `style-src ${o.cspSource} 'unsafe-inline'`,
    `img-src ${o.cspSource} https: data:`,
    `font-src ${o.cspSource}`,
    `script-src 'nonce-${o.nonce}'`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${o.styleUri}">
</head>
<body>
  <article id="content" class="habr-article">${o.body}</article>
  <script nonce="${o.nonce}" src="${o.scriptUri}"></script>
</body>
</html>`;
}
