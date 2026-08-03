import { marked, type Token, type Tokens } from "marked";
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

export function parseMarkdownBlocks(markdown: string): PreparedBlock[] {
  const tokens = marked.lexer(markdown, { gfm: true });
  return parseBlockTokens(tokens, { listDepth: 0, quoteDepth: 0 });
}

export function parseBlockTokens(tokens: readonly Token[], ctx: ParseContext): PreparedBlock[] {
  const blocks: PreparedBlock[] = [];

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];

    if (!token) continue;

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
        appendBlockGroup(blocks, [buildCodeBlock(token.text, ctx)], getCommonStyle("richBlockGap"));
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
          appendBlockGroup(blocks, [buildCodeBlock(htmlText, ctx)], getCommonStyle("richBlockGap"));
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
