import type { StateCore, Token } from "markdown-it";

export type { StateCore as CoreState, Token };
export type TokenConstructor = new (type: string, tag: string, nesting: 1 | 0 | -1) => Token;
