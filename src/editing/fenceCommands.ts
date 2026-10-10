import * as vscode from "vscode";
import { needsClosingFence, openingFence } from "./fences";

const CLOSE_FENCE_COMMAND = "hfm.finishFence";
const LANGUAGE_ID = "hfm";

/**
 * Дописывает блок кода после выбора языка: убирает лишнюю обратную кавычку, оставшуюся от автозакрытия,
 * и, если закрывающего ограждения нет, ставит его на новой строке, а курсор — в пустую строку между ними.
 */
async function finishFence(line: number): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== LANGUAGE_ID) return;

  const lines = editor.document.getText().split(/\r?\n/);
  const open = openingFence(lines[line] ?? "");
  if (!open) return;

  const info = open.info.replace(/`+$/, "");
  const opener = open.indent + open.fence + info;
  const needsClosing = needsClosingFence(lines, line);

  const applied = await editor.edit((builder) => {
    const range = new vscode.Range(line, 0, line, lines[line]!.length);
    builder.replace(range, needsClosing ? `${opener}\n${open.indent}\n${open.indent}${open.fence}` : opener);
  });
  if (!applied) return;

  const cursor = needsClosing ? new vscode.Position(line + 1, open.indent.length) : new vscode.Position(line, opener.length);
  editor.selection = new vscode.Selection(cursor, cursor);
}

/**
 * Набор ``` при включённом автозакрытии кавычек даёт четыре обратные кавычки с курсором после третьей.
 * Лишнюю убираем, чтобы блок кода получался без мусора, а одиночная `кавычка` по-прежнему закрывалась сама.
 */
function dropAutoClosedBacktick(event: vscode.TextDocumentChangeEvent): void {
  const { document } = event;
  const change = event.contentChanges[0];
  if (document.languageId !== LANGUAGE_ID || event.reason !== undefined || event.contentChanges.length !== 1) return;
  if (!change || change.rangeLength !== 0 || !/^``?$/.test(change.text)) return;

  const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
  if (!editor) return;

  // к моменту события курсор ещё не переехал, поэтому позицию берём из самой вставки:
  // после неё курсор встанет сразу за набранной кавычкой
  const { line, character } = change.range.start;
  const indent = /^[ \t]*/.exec(document.lineAt(line).text)![0].length;
  const cursor = character + 1;
  if (document.lineAt(line).text.slice(indent) !== "````" || cursor !== indent + 3) return;

  void editor.edit(
    (builder) => builder.delete(new vscode.Range(line, cursor, line, cursor + 1)),
    { undoStopBefore: false, undoStopAfter: false },
  );
}

export function registerFenceCommands(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(CLOSE_FENCE_COMMAND, finishFence),
    vscode.workspace.onDidChangeTextDocument(dropAutoClosedBacktick),
  ];
}

export { CLOSE_FENCE_COMMAND };
