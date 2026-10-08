import * as vscode from "vscode";
import { buildTocEdits, type LineEdit } from "./toc";

function toTextEdit(document: vscode.TextDocument, edit: LineEdit): vscode.TextEdit {
  const eol = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
  const body = edit.lines.join(eol);
  const last = document.lineCount - 1;

  if (edit.start > last) {
    // вставка за последней строкой: у неё нет завершающего перевода строки
    return vscode.TextEdit.insert(document.lineAt(last).range.end, eol + body);
  }
  if (edit.end > last) {
    return vscode.TextEdit.replace(
      new vscode.Range(edit.start, 0, last, document.lineAt(last).range.end.character),
      body,
    );
  }
  const range = new vscode.Range(edit.start, 0, edit.end, 0);
  return vscode.TextEdit.replace(range, edit.lines.length > 0 ? body + eol : "");
}

/** «Собрать оглавление»: якоря перед заголовками и блок со ссылками на них. */
export async function generateToc(editor: vscode.TextEditor): Promise<void> {
  const { document } = editor;
  const transliterate = vscode.workspace.getConfiguration("hfm.toc").get<boolean>("transliterate", true);
  const edits = buildTocEdits(document.getText(), { insertLine: editor.selection.start.line, transliterate });

  if (edits.length === 0) {
    void vscode.window.showInformationMessage("В документе нет заголовков, оглавление собирать не из чего.");
    return;
  }

  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.set(document.uri, edits.map((edit) => toTextEdit(document, edit)));
  await vscode.workspace.applyEdit(workspaceEdit);
}
