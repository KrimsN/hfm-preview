import * as vscode from "vscode";
import { extractHeadings } from "./headings";

/** Outline по заголовкам: встроенный провайдер `markdown` на языке HFM не действует. */
export class HfmSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const headings = extractHeadings(document.getText());
    const roots: vscode.DocumentSymbol[] = [];
    const stack: { level: number; symbol: vscode.DocumentSymbol }[] = [];

    headings.forEach((heading, index) => {
      const next = headings.slice(index + 1).find((h) => h.level <= heading.level);
      const endLine = next ? next.line - 1 : document.lineCount - 1;
      const headingLine = document.lineAt(heading.line);

      const symbol = new vscode.DocumentSymbol(
        heading.title,
        "",
        vscode.SymbolKind.String,
        new vscode.Range(heading.line, 0, endLine, document.lineAt(endLine).text.length),
        headingLine.range,
      );

      while (stack.length > 0 && stack[stack.length - 1]!.level >= heading.level) stack.pop();
      const parent = stack[stack.length - 1];
      (parent ? parent.symbol.children : roots).push(symbol);
      stack.push({ level: heading.level, symbol });
    });

    return roots;
  }
}
