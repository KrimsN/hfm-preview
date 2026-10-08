import * as vscode from "vscode";
import { createParser } from "./markdown/createParser";
import { watchForRebuild } from "./devReload";
import { HfmCodeActions, HfmDiagnostics } from "./diagnostics/provider";
import { HfmSymbolProvider } from "./outline/symbolProvider";
import { generateToc } from "./outline/tocCommand";
import { PreviewPanel, PreviewSerializer, VIEW_TYPE } from "./preview/previewPanel";

const HFM_LANGUAGE_ID = "hfm";

export function activate(context: vscode.ExtensionContext): void {
  const parser = createParser();
  const log = vscode.window.createOutputChannel("HFM", { log: true });
  context.subscriptions.push(log);
  log.info(`активация, режим ${vscode.ExtensionMode[context.extensionMode]}`);
  watchForRebuild(context);

  const open = (column: vscode.ViewColumn) => () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== HFM_LANGUAGE_ID) {
      void vscode.window.showWarningMessage("Откройте файл *.habr.md или выберите для файла язык «Habr Flavored Markdown», чтобы увидеть превью.");
      return;
    }
    PreviewPanel.show(context, parser, editor.document, column);
  };

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(VIEW_TYPE, new PreviewSerializer(context, parser, log)),
    new HfmDiagnostics(HFM_LANGUAGE_ID),
    vscode.languages.registerCodeActionsProvider({ language: HFM_LANGUAGE_ID }, new HfmCodeActions(), HfmCodeActions.metadata),
    vscode.languages.registerDocumentSymbolProvider(
      { language: HFM_LANGUAGE_ID },
      new HfmSymbolProvider(),
      { label: "Habr Flavored Markdown" },
    ),
    ...(["Light", "Dark", "Auto"] as const).map((name) =>
      vscode.commands.registerCommand(`hfm.previewTheme${name}`, () => {
        PreviewPanel.target()?.setTheme(name.toLowerCase() as "light" | "dark" | "auto");
      }),
    ),
    vscode.commands.registerCommand("hfm.generateToc", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor?.document.languageId === HFM_LANGUAGE_ID) void generateToc(editor);
    }),
    vscode.commands.registerCommand("hfm.openPreview", open(vscode.ViewColumn.Active)),
    vscode.commands.registerCommand("hfm.openPreviewToSide", open(vscode.ViewColumn.Beside)),
  );
}

export function deactivate(): void {}
