import * as vscode from "vscode";
import languages from "../data/languages.json";
import { CLOSE_FENCE_COMMAND } from "./fenceCommands";
import { fencedLines } from "./fences";
import { findFrontmatter } from "../frontmatter/block";
import { frontmatterCompletions, presentKeys } from "../frontmatter/completion";
import { anchorLinkPrefix, collectAnchors, fenceLanguagePrefix } from "./context";

const TAG_PREFIX = /<([a-z]*)$/;

interface TagSnippet {
  tag: string;
  detail: string;
  /** Блочный тег должен стоять в начале строки */
  block: boolean;
  body: string;
}

const TAG_SNIPPETS: TagSnippet[] = [
  { tag: "anchor", detail: "Якорь для ссылки внутри статьи", block: true, body: "<anchor>${1:имя}</anchor>" },
  {
    tag: "spoiler",
    detail: "Спойлер",
    block: true,
    body: '<spoiler title="${1:Заголовок}">\n\n${0}\n\n</spoiler>',
  },
  {
    tag: "persona",
    detail: "Блок «персона»",
    block: true,
    body: "<persona>\n\n  ![](${1})\n\n  ##### ${2:Имя}\n  ${3:Специальность}\n\n</persona>",
  },
  { tag: "oembed", detail: "Вставка видео или соцсети по ссылке", block: true, body: "<oembed>${1:https://}</oembed>" },
  { tag: "abbr", detail: "Аббревиатура с расшифровкой", block: false, body: '<abbr title="${1:расшифровка}">${2:ABC}</abbr>' },
];

/** Frontmatter длиннее этого не бывает; дальше закрывающую `---` не ищем, чтобы не сканировать весь документ. */
const MAX_FRONTMATTER_LINES = 100;

/** Строки YAML, если курсор стоит внутри frontmatter; иначе `undefined`. */
function frontmatterAround(document: vscode.TextDocument, position: vscode.Position): string[] | undefined {
  if (position.line === 0 || !/^\uFEFF?---[ \t]*$/.test(document.lineAt(0).text)) return undefined;
  const head = Array.from(
    { length: Math.min(document.lineCount, Math.max(position.line + 1, MAX_FRONTMATTER_LINES)) },
    (_, i) => document.lineAt(i).text,
  );
  const block = findFrontmatter(head);
  if (!block || position.line <= block.startLine || position.line >= block.endLine) return undefined;
  return head.slice(block.startLine + 1, block.endLine);
}

export class HfmCompletion implements vscode.CompletionItemProvider {
  static readonly triggerCharacters = ["#", "<", "`", "~", " "];

  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const prefix = document.lineAt(position.line).text.slice(0, position.character);

    const block = frontmatterAround(document, position);
    if (block) return this.frontmatter(position, prefix, block);

    // подсказки срабатывают на каждый пробел: сначала дешёвые проверки по строке, и только потом скан документа
    const typedAnchor = anchorLinkPrefix(prefix);
    const typedLanguage = fenceLanguagePrefix(prefix);
    if (typedAnchor === undefined && typedLanguage === undefined && !TAG_PREFIX.test(prefix)) return [];

    const upToCursor = Array.from({ length: position.line + 1 }, (_, i) => document.lineAt(i).text);
    const inCode = fencedLines(upToCursor);

    if (typedAnchor !== undefined && !inCode[position.line]) {
      return this.anchors(document, position, typedAnchor);
    }
    if (typedLanguage !== undefined && (position.line === 0 || !inCode[position.line - 1])) {
      return this.languages(position, typedLanguage);
    }
    if (!inCode[position.line]) return this.tags(position, prefix);
    return [];
  }

  private frontmatter(position: vscode.Position, prefix: string, blockLines: string[]): vscode.CompletionItem[] {
    const others = blockLines.filter((_, i) => i !== position.line - 1);
    const { typed, items } = frontmatterCompletions(prefix, presentKeys(others));
    const range = new vscode.Range(position.translate(0, -typed), position);
    return items.map((entry, i) => {
      const item = new vscode.CompletionItem(
        entry.label,
        entry.kind === "key" ? vscode.CompletionItemKind.Property : vscode.CompletionItemKind.EnumMember,
      );
      if (entry.detail) item.detail = entry.detail;
      item.insertText = entry.insert;
      item.range = range;
      item.sortText = String(i).padStart(4, "0");
      if (entry.kind === "key") item.command = { command: "editor.action.triggerSuggest", title: "Значения поля" };
      return item;
    });
  }

  private anchors(document: vscode.TextDocument, position: vscode.Position, typed: string): vscode.CompletionItem[] {
    const range = new vscode.Range(position.translate(0, -typed.length), position);
    return collectAnchors(document.getText()).map((anchor, i) => {
      const item = new vscode.CompletionItem(anchor.name, vscode.CompletionItemKind.Reference);
      item.detail = anchor.heading ? `Якорь перед заголовком «${anchor.heading}»` : "Якорь";
      item.range = range;
      item.sortText = String(i).padStart(4, "0");
      return item;
    });
  }

  private languages(position: vscode.Position, typed: string): vscode.CompletionItem[] {
    const range = new vscode.Range(position.translate(0, -typed.length), position);
    return languages.supported.map((name) => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.EnumMember);
      item.detail = "Язык подсветки на Хабре";
      item.range = range;
      item.command = { command: CLOSE_FENCE_COMMAND, title: "Закрыть блок кода", arguments: [position.line] };
      return item;
    });
  }

  private tags(position: vscode.Position, prefix: string): vscode.CompletionItem[] {
    const match = TAG_PREFIX.exec(prefix);
    if (!match) return [];
    const range = new vscode.Range(position.translate(0, -match[0].length), position);
    const atLineStart = prefix.slice(0, prefix.length - match[0].length).trim() === "";

    return TAG_SNIPPETS.filter((t) => atLineStart || !t.block).map((t) => {
      const item = new vscode.CompletionItem(`<${t.tag}>`, vscode.CompletionItemKind.Snippet);
      item.detail = t.detail;
      item.filterText = `<${t.tag}`;
      item.insertText = new vscode.SnippetString(t.body);
      item.range = range;
      return item;
    });
  }
}
