import * as vscode from "vscode";
import { findFrontmatter } from "./block";
import { resolveCover } from "./cover";
import { exists } from "./coverCheck";
import { parseFrontmatter } from "./parse";
import { frontmatterTemplate, TEMPLATE_CURSOR } from "./template";

function coverUri(document: vscode.TextDocument): vscode.Uri | undefined {
  const cover = parseFrontmatter(document.getText()).meta.cover;
  if (!cover || document.uri.scheme !== "file") return undefined;
  return vscode.Uri.file(resolveCover(document.uri.fsPath, cover));
}

/** Вставляет заготовку frontmatter в начало документа; если блок уже есть, переходит к нему. */
async function insertFrontmatter(editor: vscode.TextEditor): Promise<void> {
  const { document } = editor;
  if (findFrontmatter(document.getText().split(/\r?\n/))) {
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    editor.revealRange(new vscode.Range(0, 0, 0, 0));
    void vscode.window.showInformationMessage("Frontmatter в этом файле уже есть.");
    return;
  }

  const eol = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
  const inserted = await editor.edit((edit) => edit.insert(new vscode.Position(0, 0), frontmatterTemplate(eol)));
  if (!inserted) return;

  const cursor = new vscode.Position(TEMPLATE_CURSOR.line, TEMPLATE_CURSOR.character);
  editor.selection = new vscode.Selection(cursor, cursor);
  editor.revealRange(new vscode.Range(0, 0, TEMPLATE_CURSOR.line + 12, 0));
}

async function goToCover(editor: vscode.TextEditor): Promise<void> {
  const uri = coverUri(editor.document);
  if (!uri) {
    void vscode.window.showInformationMessage("Путь к КДПВ не указан: добавьте поле «КДПВ» во frontmatter.");
    return;
  }
  if (!(await exists(uri))) {
    void vscode.window.showWarningMessage(`Файл КДПВ не найден: ${uri.fsPath}`);
    return;
  }
  await vscode.commands.executeCommand("vscode.open", uri, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });
}

/** Путь в поле «КДПВ» становится ссылкой: Ctrl+клик открывает файл. */
class CoverLinks implements vscode.DocumentLinkProvider {
  provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
    const { coverLocation } = parseFrontmatter(document.getText());
    const uri = coverUri(document);
    if (!coverLocation || !uri) return [];
    const range = new vscode.Range(coverLocation.line, coverLocation.start, coverLocation.line, coverLocation.end);
    const link = new vscode.DocumentLink(range, uri);
    link.tooltip = "Открыть КДПВ";
    return [link];
  }
}

export function registerFrontmatterCommands(languageId: string): vscode.Disposable[] {
  const withEditor = (action: (editor: vscode.TextEditor) => Promise<void>) => () => {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId === languageId) void action(editor);
  };
  return [
    vscode.commands.registerCommand("hfm.insertFrontmatter", withEditor(insertFrontmatter)),
    vscode.commands.registerCommand("hfm.goToCover", withEditor(goToCover)),
    vscode.languages.registerDocumentLinkProvider({ language: languageId }, new CoverLinks()),
  ];
}
