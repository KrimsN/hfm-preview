import { extractHeadings } from "../outline/headings";
import { fencedLines } from "./fences";

export interface AnchorInfo {
  name: string;
  /** Заголовок, который идёт сразу за якорем */
  heading?: string;
}

const ANCHOR_LINE = /^<anchor>([^<\n]+)<\/anchor>[ \t]*$/;
const ANCHOR_LINK_PREFIX = /\]\(#([^)\s]*)$/;
const FENCE_LANGUAGE_PREFIX = /^[ \t]*(?:`{3,}|~{3,})([^\s`]*)$/;

/** Якоря документа в порядке появления; якоря в блоках кода не считаются. */
export function collectAnchors(text: string): AnchorInfo[] {
  const lines = text.split(/\r?\n/);
  const fenced = fencedLines(lines);
  const headingTitles = new Map(extractHeadings(text).map((h) => [h.line, h.title]));
  const anchors: AnchorInfo[] = [];
  const seen = new Set<string>();

  lines.forEach((line, i) => {
    const name = fenced[i] ? undefined : ANCHOR_LINE.exec(line.trim())?.[1]?.trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    let next = i + 1;
    while (next < lines.length && lines[next]!.trim() === "") next++;
    anchors.push({ name, heading: headingTitles.get(next) });
  });
  return anchors;
}

/** Что набрано после `](#`, если курсор стоит в адресе ссылки на якорь. */
export function anchorLinkPrefix(linePrefix: string): string | undefined {
  return ANCHOR_LINK_PREFIX.exec(linePrefix)?.[1];
}

/** Что набрано после открывающего ограждения кода, если курсор стоит в строке с языком. */
export function fenceLanguagePrefix(linePrefix: string): string | undefined {
  return FENCE_LANGUAGE_PREFIX.exec(linePrefix)?.[1];
}
