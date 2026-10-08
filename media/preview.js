// Скрипт webview: подставляет свежий HTML статьи, не перезагружая страницу
(() => {
  const content = document.getElementById("content");
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type === "update" && content) {
      content.innerHTML = message.html;
    } else if (message?.type === "theme") {
      if (message.theme === "auto") document.body.removeAttribute("data-theme");
      else document.body.setAttribute("data-theme", message.theme);
    }
  });
})();
