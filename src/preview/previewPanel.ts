import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { HfmParser } from "../markdown/createParser";
import type { HfmEnv } from "../markdown/env";
import { previewTitle, uniqueLabels } from "./titles";
import { buildWebviewHtml, type PreviewTheme } from "./webviewHtml";

export const VIEW_TYPE = "hfm.preview";
const UPDATE_DEBOUNCE_MS = 150;
/** Окно, в течение которого игнорируем «эхо» прокрутки, вызванной нами же. */
const SCROLL_ECHO_MS = 250;

function webviewOptions(context: vscode.ExtensionContext, document: vscode.TextDocument): vscode.WebviewOptions {
  return {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.joinPath(context.extensionUri, "media"),
      vscode.Uri.joinPath(document.uri, ".."),
      ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? []),
    ],
  };
}

/** Одна панель превью на один документ. */
export class PreviewPanel {
  private static readonly panels = new Map<string, PreviewPanel>();
  private static current: PreviewPanel | undefined;

  /** Тема, выбранная из меню превью; сбрасывается при изменении настройки. */
  private themeOverride: PreviewTheme | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private updateTimer: NodeJS.Timeout | undefined;
  private ignoreEditorScrollUntil = 0;

  /** Панель, к которой относятся команды меню: активная либо единственная открытая. */
  static target(): PreviewPanel | undefined {
    if (PreviewPanel.current?.panel.visible) return PreviewPanel.current;
    return PreviewPanel.panels.size === 1 ? [...PreviewPanel.panels.values()][0] : undefined;
  }

  static show(
    context: vscode.ExtensionContext,
    parser: HfmParser,
    document: vscode.TextDocument,
    column: vscode.ViewColumn,
  ): void {
    const existing = PreviewPanel.panels.get(document.uri.toString());
    if (existing) {
      existing.panel.reveal(column, true);
      PreviewPanel.current = existing;
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      previewTitle(document.uri.path.split("/").pop() ?? ""),
      { viewColumn: column, preserveFocus: true },
      webviewOptions(context, document),
    );
    PreviewPanel.register(context, parser, document, panel);
  }

  /** Восстанавливает панель, оставшуюся от прошлого запуска VS Code. */
  static restore(
    context: vscode.ExtensionContext,
    parser: HfmParser,
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
  ): void {
    if (PreviewPanel.panels.has(document.uri.toString())) {
      panel.dispose();
      return;
    }
    panel.webview.options = webviewOptions(context, document);
    PreviewPanel.register(context, parser, document, panel);
  }

  private static register(
    context: vscode.ExtensionContext,
    parser: HfmParser,
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
  ): void {
    const created = new PreviewPanel(context, parser, document, panel, document.uri.toString());
    PreviewPanel.panels.set(created.key, created);
    PreviewPanel.current = created;
    PreviewPanel.refreshTitles();
  }

  /** Заголовки как у вкладок VS Code: имя файла, а при совпадении — с родительскими папками. */
  private static refreshTitles(): void {
    const panels = [...PreviewPanel.panels.values()];
    const labels = uniqueLabels(panels.map((p) => p.document.uri.fsPath));
    panels.forEach((p, i) => {
      p.panel.title = previewTitle(labels[i]!);
    });
  }

  setTheme(theme: PreviewTheme): void {
    this.themeOverride = theme;
    void this.panel.webview.postMessage({ type: "theme", theme });
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
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("hfm.preview.theme")) {
          this.themeOverride = undefined;
          void this.panel.webview.postMessage({ type: "theme", theme: this.theme() });
        }
      }),
      vscode.window.onDidChangeTextEditorVisibleRanges((e) => this.onEditorScrolled(e)),
      this.panel.webview.onDidReceiveMessage((message: { type?: string; line?: number }) => {
        if (message.type === "ready") this.syncFromEditor();
        else if (message.type === "scroll" && typeof message.line === "number") this.revealInEditor(message.line);
      }),
      this.panel.onDidChangeViewState((e) => {
        if (e.webviewPanel.active) PreviewPanel.current = this;
      }),
      this.panel.onDidDispose(() => this.dispose()),
    );
  }

  // --- синхронизация прокрутки

  private syncEnabled(): boolean {
    return vscode.workspace.getConfiguration("hfm.preview").get<boolean>("scrollSync", true);
  }

  private editor(): vscode.TextEditor | undefined {
    return vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === this.key);
  }

  /** Редактор прокрутили — подтягиваем превью. */
  private onEditorScrolled(e: vscode.TextEditorVisibleRangesChangeEvent): void {
    if (e.textEditor.document.uri.toString() !== this.key || !this.syncEnabled()) return;
    if (Date.now() < this.ignoreEditorScrollUntil) return;

    const top = e.visibleRanges[0]?.start.line;
    if (top !== undefined) void this.panel.webview.postMessage({ type: "scroll", line: top });
  }

  /** Превью открылось — выравниваем по тому, что видно в редакторе. */
  private syncFromEditor(): void {
    if (!this.syncEnabled()) return;
    const top = this.editor()?.visibleRanges[0]?.start.line;
    if (top !== undefined) void this.panel.webview.postMessage({ type: "scroll", line: top });
  }

  /** Превью прокрутили — подтягиваем редактор. */
  private revealInEditor(line: number): void {
    if (!this.syncEnabled()) return;
    const editor = this.editor();
    if (!editor) return;

    this.ignoreEditorScrollUntil = Date.now() + SCROLL_ECHO_MS;
    const target = Math.min(Math.max(0, Math.floor(line)), editor.document.lineCount - 1);
    editor.revealRange(new vscode.Range(target, 0, target, 0), vscode.TextEditorRevealType.AtTop);
  }

  // --- рендер

  private scheduleUpdate(): void {
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      void this.panel.webview.postMessage({
        type: "update",
        html: this.render(),
      });
    }, UPDATE_DEBOUNCE_MS);
  }

  private theme(): PreviewTheme {
    return this.themeOverride ?? vscode.workspace.getConfiguration("hfm.preview").get<PreviewTheme>("theme", "auto");
  }

  private render(): string {
    const env: HfmEnv = { sourceLines: true, resolveImage: (src) => this.resolveImage(src) };
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
      theme: this.theme(),
      documentUri: this.key,
      body: this.render(),
    });
  }

  private dispose(): void {
    clearTimeout(this.updateTimer);
    PreviewPanel.panels.delete(this.key);
    if (PreviewPanel.current === this) PreviewPanel.current = undefined;
    this.disposables.forEach((d) => d.dispose());
    PreviewPanel.refreshTitles();
  }
}

/** Возвращает панели превью после перезапуска VS Code вместо пустой вкладки. */
export class PreviewSerializer implements vscode.WebviewPanelSerializer {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly parser: HfmParser,
  ) {}

  async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: { uri?: string } | undefined): Promise<void> {
    if (!state?.uri) {
      panel.dispose();
      return;
    }
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(state.uri));
      PreviewPanel.restore(this.context, this.parser, document, panel);
    } catch {
      // файл удалён или недоступен — закрываем вкладку, а не оставляем пустую
      panel.dispose();
    }
  }
}
