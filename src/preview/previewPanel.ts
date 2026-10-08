import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { HfmParser } from "../markdown/createParser";
import type { HfmEnv } from "../markdown/env";
import { buildWebviewHtml } from "./webviewHtml";

const VIEW_TYPE = "hfm.preview";
const UPDATE_DEBOUNCE_MS = 150;

/** Одна панель превью на один документ. */
export class PreviewPanel {
  private static readonly panels = new Map<string, PreviewPanel>();

  private readonly disposables: vscode.Disposable[] = [];
  private updateTimer: NodeJS.Timeout | undefined;

  static show(
    context: vscode.ExtensionContext,
    parser: HfmParser,
    document: vscode.TextDocument,
    column: vscode.ViewColumn,
  ): void {
    const key = document.uri.toString();
    const existing = PreviewPanel.panels.get(key);
    if (existing) {
      existing.panel.reveal(column, true);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      `Превью: ${vscode.workspace.asRelativePath(document.uri)}`,
      { viewColumn: column, preserveFocus: true },
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
          vscode.Uri.joinPath(document.uri, ".."),
          ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? []),
        ],
      },
    );
    PreviewPanel.panels.set(key, new PreviewPanel(context, parser, document, panel, key));
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly parser: HfmParser,
    private readonly document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel,
    private readonly key: string,
  ) {
    this.panel.webview.html = this.renderPage();

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === this.key) {
          this.scheduleUpdate();
        }
      }),
      this.panel.onDidDispose(() => this.dispose()),
    );
  }

  private scheduleUpdate(): void {
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      void this.panel.webview.postMessage({
        type: "update",
        html: this.render(),
      });
    }, UPDATE_DEBOUNCE_MS);
  }

  private render(): string {
    const env: HfmEnv = { resolveImage: (src) => this.resolveImage(src) };
    return this.parser.render(this.document.getText(), env);
  }

  /**
   * Хабр ломает относительные пути (`https://./img.png`), но автору удобнее видеть локальную
   * картинку; предупредит об этом диагностика. `/путь` считается от корня рабочей папки.
   */
  private resolveImage(src: string): string | undefined {
    const path = src.split(/[?#]/)[0] ?? "";
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return undefined;
    }

    const folder = vscode.workspace.getWorkspaceFolder(this.document.uri);
    const base = decoded.startsWith("/")
      ? (folder?.uri ?? vscode.Uri.joinPath(this.document.uri, ".."))
      : vscode.Uri.joinPath(this.document.uri, "..");
    const file = vscode.Uri.joinPath(base, decoded);
    return this.panel.webview.asWebviewUri(file).toString();
  }

  private renderPage(): string {
    const media = (file: string) =>
      this.panel.webview
        .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", file))
        .toString();

    return buildWebviewHtml({
      cspSource: this.panel.webview.cspSource,
      nonce: randomBytes(16).toString("base64"),
      styleUri: media("preview.css"),
      scriptUri: media("preview.js"),
      body: this.render(),
    });
  }

  private dispose(): void {
    clearTimeout(this.updateTimer);
    PreviewPanel.panels.delete(this.key);
    this.disposables.forEach((d) => d.dispose());
  }
}
