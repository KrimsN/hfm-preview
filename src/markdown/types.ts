import type { HfmParser } from "./createParser";

export type Token = ReturnType<HfmParser["parse"]>[number];
export type TokenConstructor = new (type: string, tag: string, nesting: 1 | 0 | -1) => Token;
export type CoreState = Parameters<Parameters<HfmParser["core"]["ruler"]["push"]>[1]>[0];
