import * as vscode from "vscode";
import { analyze } from "./analyze";
import { formatMessage, severityOf, type Severity } from "./rules";
import { fixFor } from "./fixes";

const UPDATE_DEBOUNCE_MS = 300;
export const SOURCE = "hfm";

const SEVERITY: Record<Severity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
  hint: vscode.DiagnosticSeverity.Hint,
};

/** Следит за открытыми HFM-документами и публикует диагностику. */
export class HfmDiagnostics implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection(SOURCE);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly disposables: vscode.Disposable[] = [this.collection];

  constructor(private readonly languageId: string) {
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((d) => this.refresh(d)),
      vscode.workspace.onDidChangeTextDocument((e) => this.schedule(e.document)),
      vscode.workspace.onDidCloseTextDocument((d) => this.clear(d)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("hfm.diagnostics")) vscode.workspace.textDocuments.forEach((d) => this.refresh(d));
      }),
    );
    vscode.workspace.textDocuments.forEach((d) => this.refresh(d));
  }

  private enabled(): boolean {
    return vscode.workspace.getConfiguration("hfm.diagnostics").get<boolean>("enabled", true);
  }

  private schedule(document: vscode.TextDocument): void {
    if (document.languageId !== this.languageId) return;
    const key = document.uri.toString();
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => this.refresh(document), UPDATE_DEBOUNCE_MS));
  }

  private clear(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
    this.collection.delete(document.uri);
  }

  private refresh(document: vscode.TextDocument): void {
    if (document.languageId !== this.languageId) return;
    if (!this.enabled()) {
      this.collection.delete(document.uri);
      return;
    }

    const typography = vscode.workspace.getConfiguration("hfm.diagnostics").get<boolean>("typography", true);
    const diagnostics = analyze(document.getText(), { typography }).map((finding) => {
      const range = new vscode.Range(finding.line, finding.start, finding.line, finding.end);
      const diagnostic = new vscode.Diagnostic(
        range,
        formatMessage(finding.code, finding.args),
        SEVERITY[severityOf(finding.code)],
      );
      diagnostic.source = SOURCE;
      diagnostic.code = finding.code;
      return diagnostic;
    });
    this.collection.set(document.uri, diagnostics);
  }

  dispose(): void {
    this.timers.forEach(clearTimeout);
    this.disposables.forEach((d) => d.dispose());
  }
}

/** Быстрые исправления для диагностик, у которых есть однозначная правка (см. fixes.ts). */
export class HfmCodeActions implements vscode.CodeActionProvider {
  static readonly metadata = { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] };

  provideCodeActions(document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== SOURCE || !diagnostic.range.isSingleLine) continue;

      const line = diagnostic.range.start.line;
      const fix = fixFor(String(diagnostic.code), document.lineAt(line).text, diagnostic.range.start.character, diagnostic.range.end.character);
      if (!fix) continue;

      const action = new vscode.CodeAction(fix.title, vscode.CodeActionKind.QuickFix);
      action.diagnostics = [diagnostic];
      action.isPreferred = true;
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(document.uri, new vscode.Range(line, fix.start, line, fix.end), fix.text);
      actions.push(action);
    }
    return actions;
  }
}
