// Скрипт webview: подставляет свежий HTML статьи, не перезагружая страницу,
// переключает тему и сообщает меню правой кнопки, какая тема сейчас показана
(() => {
  const content = document.getElementById("content");
  const body = document.body;

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

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type === "update" && content) {
      content.innerHTML = message.html;
    } else if (message?.type === "theme") {
      if (message.theme === "auto") body.removeAttribute("data-theme");
      else body.setAttribute("data-theme", message.theme);
      publishContext();
    }
  });

  // VS Code меняет классы body при смене темы редактора
  new MutationObserver(publishContext).observe(body, { attributes: true, attributeFilter: ["class"] });
  publishContext();
})();
