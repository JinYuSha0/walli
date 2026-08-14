import { marked, type Token, type Tokens } from "marked";
import remend from "remend";
import type { ParseContext, PreparedBlock } from "./type";
import {
  buildInlineBlocks,
  buildImageBlock,
  buildCodeBlock,
  buildListBlocks,
  buildRuleBlock,
  buildPlainTextBlocks,
  buildTableBlock,
} from "./blocks/index";
import { appendBlockGroup, fallbackTextForToken, headingVariant } from "./helper";
import { getCommonStyle } from "./styles";
import { resolveCustomBlockToken } from "./custom-block";

export function parseMarkdownBlocks(markdown: string, streaming = false): PreparedBlock[] {
  const source = streaming ? remend(markdown) : markdown;
  const tokens = lexMarkdown(source);
  return parseBlockTokens(tokens, { listDepth: 0, quoteDepth: 0 });
}

export class StreamingMarkdownParser {
  private stableBlocks: PreparedBlock[] = [];
  private stableTokenKeys: string[] = [];

  parse(markdown: string): PreparedBlock[] {
    const tokens = lexMarkdown(remend(markdown));
    const stableTokenCount = Math.max(0, tokens.length - 1);
    const reusableCount = Math.min(stableTokenCount, this.stableTokenKeys.length);

    for (let index = 0; index < reusableCount; index++) {
      if (this.stableTokenKeys[index] !== tokenKey(tokens[index]!)) {
        this.stableBlocks = [];
        this.stableTokenKeys = [];
        break;
      }
    }

    let blocks = [...this.stableBlocks];
    for (let index = this.stableTokenKeys.length; index < tokens.length; index++) {
      blocks = parseBlockTokens(tokens.slice(index, index + 1), { listDepth: 0, quoteDepth: 0 }, blocks);
      if (index < stableTokenCount) {
        this.stableTokenKeys.push(tokenKey(tokens[index]!));
        this.stableBlocks = [...blocks];
      }
    }
    return blocks;
  }
}

function lexMarkdown(markdown: string): Token[] {
  return marked.lexer(markdown, { ...marked.defaults, gfm: true });
}

function tokenKey(token: Token): string {
  return `${token.type}:${token.raw}`;
}

export function parseBlockTokens(
  tokens: readonly Token[],
  ctx: ParseContext,
  blocks: PreparedBlock[] = [],
): PreparedBlock[] {

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];

    if (!token) continue;

    const customBlock = resolveCustomBlockToken(token);
    if (customBlock) {
      appendBlockGroup(
        blocks,
        [{
          contentLeft: 0,
          data: customBlock.data,
          definition: customBlock.definition,
          kind: "custom",
          marginTop: 0,
          markerClassName: null,
          markerLeft: null,
          markerText: null,
          quoteRailLefts: [],
        }],
        customBlock.definition.marginTop ?? getCommonStyle("richBlockGap"),
      );
      continue;
    }

    switch (token.type) {
      case "space":
      case "def": {
        continue;
      }

      case "paragraph": {
        const imageBlock = buildImageBlock(token.tokens, ctx);
        if (imageBlock) {
          appendBlockGroup(blocks, [imageBlock], getCommonStyle("blockGap"));
        } else {
          appendBlockGroup(
            blocks,
            buildInlineBlocks(token.tokens ?? [], "body", ctx),
            getCommonStyle("blockGap"),
          );
        }
        continue;
      }

      case "heading": {
        appendBlockGroup(
          blocks,
          buildInlineBlocks(token.tokens ?? [], headingVariant(token.depth), ctx),
          getCommonStyle("headingGap"),
        );
        continue;
      }

      case "code": {
        appendBlockGroup(
          blocks,
          [buildCodeBlock(token.text, ctx, token.lang)],
          getCommonStyle("richBlockGap"),
        );
        continue;
      }

      case "list": {
        appendBlockGroup(
          blocks,
          buildListBlocks(token as Tokens.List, ctx),
          getCommonStyle("blockGap"),
        );
        continue;
      }

      case "blockquote": {
        appendBlockGroup(
          blocks,
          parseBlockTokens(token.tokens ?? [], {
            listDepth: ctx.listDepth,
            quoteDepth: ctx.quoteDepth + 1,
          }),
          getCommonStyle("richBlockGap"),
        );
        continue;
      }

      case "hr": {
        appendBlockGroup(blocks, [buildRuleBlock(ctx)], getCommonStyle("blockGap"));
        continue;
      }

      case "table": {
        appendBlockGroup(
          blocks,
          [buildTableBlock(token as Tokens.Table, ctx)],
          getCommonStyle("richBlockGap"),
        );
        continue;
      }

      case "html": {
        const htmlText = token.text.trim().length > 0 ? token.text : token.raw;
        const isPre = "pre" in token && token.pre === true;
        if (token.block || isPre) {
          appendBlockGroup(
            blocks,
            [buildCodeBlock(htmlText, ctx, "markup")],
            getCommonStyle("richBlockGap"),
          );
        } else {
          appendBlockGroup(
            blocks,
            buildPlainTextBlocks(htmlText, "body", ctx),
            getCommonStyle("blockGap"),
          );
        }
        continue;
      }

      case "text": {
        if (Array.isArray(token.tokens) && token.tokens.length > 0) {
          appendBlockGroup(
            blocks,
            buildInlineBlocks(token.tokens, "body", ctx),
            getCommonStyle("blockGap"),
          );
        } else {
          appendBlockGroup(
            blocks,
            buildPlainTextBlocks(token.text, "body", ctx),
            getCommonStyle("blockGap"),
          );
        }
        continue;
      }

      default: {
        const fallbackText = fallbackTextForToken(token);
        if (fallbackText.length > 0) {
          appendBlockGroup(
            blocks,
            buildPlainTextBlocks(fallbackText, "body", ctx),
            getCommonStyle("blockGap"),
          );
        }
      }
    }
  }

  return blocks;
}
