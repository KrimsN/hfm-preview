import * as vscode from "vscode";
import { continueList, indentItem, outdentItem, type ListAction } from "./lists";

type Compute = (lines: string[], line: number, col: number) => ListAction | undefined;

/**
 * Клавиша работает как обычно, если курсор не в пункте списка: действие списка применяется
 * только при одном пустом выделении, иначе вызывается стандартная команда `fallback`.
 */
function listKey(compute: Compute, fallback: () => Thenable<unknown>): () => Promise<void> {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    const selection = editor?.selection;
    if (!editor || editor.selections.length !== 1 || !selection?.isEmpty) {
      await fallback();
      return;
    }

    const lines = editor.document.getText().split(/\r?\n/);
    const action = compute(lines, selection.active.line, selection.active.character);
    if (!action) {
      await fallback();
      return;
    }

    const applied = await editor.edit((builder) => {
      for (const c of action.changes) builder.replace(new vscode.Range(c.line, c.start, c.line, c.end), c.text);
    });
    if (!applied) return;
    const cursor = new vscode.Position(action.cursor.line, action.cursor.col);
    editor.selection = new vscode.Selection(cursor, cursor);
    editor.revealRange(new vscode.Range(cursor, cursor));
  };
}

export function registerListCommands(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("hfm.onEnterKey", listKey(continueList, () => vscode.commands.executeCommand("type", { text: "\n" }))),
    vscode.commands.registerCommand("hfm.onTabKey", listKey(indentItem, () => vscode.commands.executeCommand("tab"))),
    vscode.commands.registerCommand("hfm.onShiftTabKey", listKey(outdentItem, () => vscode.commands.executeCommand("outdent"))),
  ];
}
