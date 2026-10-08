import { watch, type FSWatcher } from "node:fs";
import * as vscode from "vscode";

const RELOAD_DEBOUNCE_MS = 400;

/**
 * Только для окна разработки (F5): следит за пересобранным бандлом и стилями превью
 * и перезагружает окно, чтобы не перезапускать его вручную после каждой сборки.
 * Открытые превью вернутся сами — их восстанавливает PreviewSerializer.
 */
export function watchForRebuild(context: vscode.ExtensionContext): void {
  if (context.extensionMode !== vscode.ExtensionMode.Development) return;

  const watchers: FSWatcher[] = [];
  let timer: NodeJS.Timeout | undefined;

  const scheduleReload = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void vscode.commands.executeCommand("workbench.action.reloadWindow");
    }, RELOAD_DEBOUNCE_MS);
  };

  for (const [dir, filter] of [
    [vscode.Uri.joinPath(context.extensionUri, "dist").fsPath, /^extension\.js$/],
    [vscode.Uri.joinPath(context.extensionUri, "media").fsPath, /\.(css|js)$/],
  ] as const) {
    try {
      watchers.push(
        watch(dir, (_event, filename) => {
          if (filename && filter.test(filename.toString())) scheduleReload();
        }),
      );
    } catch {
      // каталога может не быть до первой сборки — живая перезагрузка просто не включится
    }
  }

  context.subscriptions.push({
    dispose: () => {
      clearTimeout(timer);
      watchers.forEach((w) => w.close());
    },
  });
}
