// Скрипт webview: подставляет свежий HTML статьи, не перезагружая страницу, переключает тему,
// сообщает меню правой кнопки текущую тему и синхронизирует прокрутку с редактором
(() => {
  const vscode = acquireVsCodeApi();
  const content = document.getElementById("content");
  const body = document.body;

  // Состояние для восстановления панели после перезапуска VS Code
  vscode.setState({ uri: body.dataset.documentUri });

  // --- тема

  /** Тема, которую видит автор: выбранная явно либо тема VS Code. */
  const effectiveTheme = () => {
    const chosen = body.getAttribute("data-theme");
    if (chosen) return chosen;
    return body.classList.contains("vscode-dark") || body.classList.contains("vscode-high-contrast")
      ? "dark"
      : "light";
  };

  // Значения для `when` в package.json (webview/context)
  const publishContext = () => {
    body.setAttribute(
      "data-vscode-context",
      JSON.stringify({
        webviewSection: "preview",
        hfmTheme: effectiveTheme(),
        hfmThemeMode: body.getAttribute("data-theme") ?? "auto",
      }),
    );
  };

  // --- синхронизация прокрутки по строкам исходника (атрибут data-line)

  const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const markers = () => [...document.querySelectorAll("[data-line]")].map((el) => ({ el, line: Number(el.dataset.line) }));

  /** Прокручивает так, чтобы строка исходника оказалась вверху; между блоками — по пропорции. */
  const scrollToLine = (line) => {
    const items = markers();
    if (items.length === 0) return;

    let prev = items[0];
    let next;
    for (const item of items) {
      if (item.line <= line) prev = item;
      else {
        next = item;
        break;
      }
    }
    const top = absTop(prev.el);
    let y = top;
    if (next && next.line > prev.line) {
      const ratio = (line - prev.line) / (next.line - prev.line);
      y = top + ratio * (absTop(next.el) - top);
    }
    window.scrollTo(0, Math.max(0, y));
  };

  /** Строка исходника, которая сейчас вверху окна. */
  const currentLine = () => {
    const items = markers();
    if (items.length === 0) return 0;

    const y = window.scrollY;
    let prev = items[0];
    let next;
    for (const item of items) {
      if (absTop(item.el) <= y + 1) prev = item;
      else {
        next = item;
        break;
      }
    }
    if (!next) return prev.line;
    const top = absTop(prev.el);
    const span = absTop(next.el) - top;
    const ratio = span > 0 ? Math.min(1, Math.max(0, (y - top) / span)) : 0;
    return prev.line + ratio * (next.line - prev.line);
  };

  // Эхо: прокрутка, которую вызвали мы сами, не должна уходить обратно в редактор
  let ignoreScrollUntil = 0;
  let scrollFrame = 0;
  window.addEventListener("scroll", () => {
    if (performance.now() < ignoreScrollUntil || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      vscode.postMessage({ type: "scroll", line: currentLine() });
    });
  });

  // --- сообщения от расширения

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type === "update" && content) {
      content.innerHTML = message.html;
    } else if (message?.type === "theme") {
      if (message.theme === "auto") body.removeAttribute("data-theme");
      else body.setAttribute("data-theme", message.theme);
      publishContext();
    } else if (message?.type === "scroll") {
      ignoreScrollUntil = performance.now() + 250;
      scrollToLine(message.line);
    }
  });

  // VS Code меняет классы body при смене темы редактора
  new MutationObserver(publishContext).observe(body, { attributes: true, attributeFilter: ["class"] });
  publishContext();
  vscode.postMessage({ type: "ready" });
})();
