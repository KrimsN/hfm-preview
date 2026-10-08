import * as vscode from "vscode";
import { createParser } from "./markdown/createParser";
import { PreviewPanel } from "./preview/previewPanel";

const HFM_LANGUAGE_ID = "hfm";

export function activate(context: vscode.ExtensionContext): void {
  const parser = createParser();

  const open = (column: vscode.ViewColumn) => () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== HFM_LANGUAGE_ID) {
      void vscode.window.showWarningMessage("Откройте файл *.habr.md, чтобы увидеть превью.");
      return;
    }
    PreviewPanel.show(context, parser, editor.document, column);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("hfm.openPreview", open(vscode.ViewColumn.Active)),
    vscode.commands.registerCommand("hfm.openPreviewToSide", open(vscode.ViewColumn.Beside)),
  );
}

export function deactivate(): void {}
