import type { Token } from "marked";
import type { InlineVariant, ParseContext, PreparedBlock, PreparedBlockBase } from "./type";
import { getCommonStyle } from "./styles";

export function parseMarkdownHref(href: string | null | undefined): string | undefined {
  if (href === undefined || href === null) return;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return;
  }
}

export function fallbackTextForToken(token: Token): string {
  if ("text" in token && typeof token.text === "string") return token.text;
  return token.raw ?? "";
}

export function headingVariant(depth: number): InlineVariant {
  if (depth <= 1) return "h1";
  if (depth === 2) return "h2";
  return "body";
}

export function createBlockBase(ctx: ParseContext): PreparedBlockBase {
  const listIndent = Math.max(0, ctx.listDepth - 1) * getCommonStyle("listNestingIndent");
  const contentLeft = listIndent + ctx.quoteDepth * getCommonStyle("blockQuoteIndent");
  const quoteRailLefts: number[] = [];

  for (let depth = 0; depth < ctx.quoteDepth; depth++) {
    quoteRailLefts.push(
      listIndent + depth * getCommonStyle("blockQuoteIndent") + getCommonStyle("railOffset"),
    );
  }

  return {
    contentLeft,
    marginTop: 0,
    markerClassName: null,
    markerLeft: null,
    markerText: null,
    quoteRailLefts,
  };
}

export function appendBlockGroup(
  target: PreparedBlock[],
  group: PreparedBlock[],
  space: number,
): void {
  if (group.length === 0) return;

  for (let index = 0; index < group.length; index++) {
    const block = group[index]!;
    target.push({
      ...block,
      marginTop: index === 0 ? (target.length === 0 ? 0 : space) : block.marginTop,
    } satisfies PreparedBlock);
  }
}
