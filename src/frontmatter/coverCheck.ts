import * as vscode from "vscode";
import { resolveCover } from "./cover";

/** Как долго доверяем результату проверки файла, прежде чем проверить заново. */
const TTL_MS = 3000;

interface Entry {
  exists: boolean;
  checkedAt: number;
}

/**
 * Проверка существования КДПВ без блокировки extension host: диагностика получает последний
 * известный ответ сразу, а файл проверяется асинхронно через `workspace.fs` (работает и на сетевых дисках).
 * Пока ответа нет, считаем, что файл есть, чтобы не мигать ложной ошибкой.
 */
export class CoverChecker {
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Set<string>();

  /** @param onChanged вызывается, когда проверка изменила прежний ответ: диагностику пора пересчитать */
  constructor(private readonly onChanged: (document: vscode.TextDocument) => void) {}

  /** Функция для `analyze`; для не файловых документов проверку не делаем. */
  existsFor(document: vscode.TextDocument): ((path: string) => boolean) | undefined {
    if (document.uri.scheme !== "file") return undefined;
    return (path) => {
      const file = resolveCover(document.uri.fsPath, path);
      const entry = this.entries.get(file);
      if (!entry || Date.now() - entry.checkedAt > TTL_MS) this.probe(file, document, entry?.exists);
      return entry?.exists ?? true;
    };
  }

  private probe(file: string, document: vscode.TextDocument, previous: boolean | undefined): void {
    if (this.pending.has(file)) return;
    this.pending.add(file);
    void exists(vscode.Uri.file(file))
      .then((found) => {
        this.entries.set(file, { exists: found, checkedAt: Date.now() });
        // впервые узнали, что файла нет, либо ответ изменился
        if (found !== (previous ?? true)) this.onChanged(document);
      })
      .finally(() => this.pending.delete(file));
  }
}

export async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
