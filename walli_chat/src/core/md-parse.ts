import { marked, type Token, type Tokens } from "marked";
import remend from "remend";
import type { ParseContext, PreparedBlock } from "./types";
import "./blocks/index";
import {
  appendBlockGroup,
  createBlockBase,
  fallbackTextForToken,
  headingVariant,
  parseMarkdownImageSrc,
} from "./helper";
import { getCommonStyle, inlinePiece } from "./styles";
import { resolveBuiltInBlockDefinition, resolveCustomBlockToken } from "./block-registry";
import { getSpace } from "./styles/config";
import type { InlineVariant } from "./blocks/inline-block";

export function parseInlineMarkdownBlocks(
  markdown: string,
  variant: InlineVariant = "body",
): PreparedBlock[] {
  return resolveBuiltInBlockDefinition("inline").prepare(
    marked.Lexer.lexInline(markdown),
    variant,
    { listDepth: 0, quoteDepth: 0 },
  );
}

export function parseMarkdownBlocks(markdown: string, streaming = false): PreparedBlock[] {
  const source = streaming ? remend(markdown) : markdown;
  const tokens = lexMarkdown(source);
  return mergeAssetsGroups(parseBlockTokens(tokens, { listDepth: 0, quoteDepth: 0 }));
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
      blocks = parseBlockTokens(
        tokens.slice(index, index + 1),
        { listDepth: 0, quoteDepth: 0 },
        blocks,
      );
      if (index < stableTokenCount) {
        this.stableTokenKeys.push(tokenKey(tokens[index]!));
        this.stableBlocks = [...blocks];
      }
    }
    return mergeAssetsGroups(blocks);
  }
}

function mergeAssetsGroups(blocks: readonly PreparedBlock[]): PreparedBlock[] {
  const grouped: PreparedBlock[] = [];
  for (const block of blocks) {
    const previous = grouped[grouped.length - 1];
    if (block.kind === "assetsGroup" && previous?.kind === "assetsGroup") {
      grouped[grouped.length - 1] = { ...previous, assets: [...previous.assets, ...block.assets] };
    } else {
      grouped.push(block);
    }
  }
  return grouped;
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
  const code = resolveBuiltInBlockDefinition("code");
  const custom = resolveBuiltInBlockDefinition("custom");
  const image = resolveBuiltInBlockDefinition("image");
  const inline = resolveBuiltInBlockDefinition("inline");
  const rule = resolveBuiltInBlockDefinition("rule");
  const table = resolveBuiltInBlockDefinition("table");

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];

    if (!token) continue;

    const customBlock = resolveCustomBlockToken(token);
    if (customBlock) {
      appendBlockGroup(
        blocks,
        [
          custom.prepare(customBlock.data, customBlock.definition, {
            contentLeft: 0,
            marginTop: 0,
            markerClassName: null,
            markerLeft: null,
            markerText: null,
            quoteRailLefts: [],
          }),
        ],
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
        const imageBlock = image.prepare(token.tokens, ctx);
        const fileBlock = buildFileBlock(token.tokens, ctx);
        if (imageBlock) {
          appendBlockGroup(blocks, [imageBlock], getCommonStyle("blockGap"));
        } else if (fileBlock) {
          appendBlockGroup(blocks, [fileBlock], getCommonStyle("blockGap"));
        } else {
          appendBlockGroup(
            blocks,
            inline.prepare(token.tokens ?? [], "body", ctx),
            getCommonStyle("blockGap"),
          );
        }
        continue;
      }

      case "heading": {
        appendBlockGroup(
          blocks,
          inline.prepare(token.tokens ?? [], headingVariant(token.depth), ctx),
          getCommonStyle("headingGap"),
        );
        continue;
      }

      case "code": {
        appendBlockGroup(
          blocks,
          [code.prepare(token.text, ctx, token.lang)],
          getCommonStyle("blockGap"),
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
        appendBlockGroup(blocks, [rule.prepare(ctx)], getCommonStyle("blockGap"));
        continue;
      }

      case "table": {
        appendBlockGroup(
          blocks,
          [table.prepare(token as Tokens.Table, ctx)],
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
            [code.prepare(htmlText, ctx, "markup")],
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
            inline.prepare(token.tokens, "body", ctx),
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

const listMarkerClassName = inlinePiece.mark().className;

function buildPlainTextBlocks(
  text: string,
  variant: "body" | "h1" | "h2",
  ctx: ParseContext,
): PreparedBlock[] {
  if (text.length === 0) return [];
  const token = { raw: text, text, type: "text" } as Token;
  return resolveBuiltInBlockDefinition("inline").prepare([token], variant, ctx);
}

function buildFileBlock(
  tokens: readonly Token[] | undefined,
  ctx: ParseContext,
): PreparedBlock | null {
  if (tokens?.length !== 1) return null;
  const token = tokens[0]!;
  if (token.type !== "link") return null;

  const src = parseMarkdownImageSrc(token.href);
  const name = token.text.trim();
  if (src === undefined || !isFileName(name)) return null;

  return resolveBuiltInBlockDefinition("assetsGroup").prepare(
    [{ name, src, type: "file" }],
    createBlockBase(ctx),
  );
}

const fileExtensions = new Set([
  "7z",
  "aac",
  "avi",
  "css",
  "csv",
  "doc",
  "docx",
  "gz",
  "html",
  "java",
  "js",
  "json",
  "key",
  "m4a",
  "mkv",
  "mov",
  "mp3",
  "mp4",
  "odf",
  "odp",
  "ods",
  "odt",
  "ogg",
  "pdf",
  "ppt",
  "pptx",
  "py",
  "rar",
  "rs",
  "rtf",
  "tar",
  "ts",
  "tsx",
  "txt",
  "wav",
  "webm",
  "xls",
  "xlsx",
  "zip",
]);

function isFileName(name: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase();
  return extension !== undefined && fileExtensions.has(extension);
}

function buildListBlocks(token: Tokens.List, ctx: ParseContext): PreparedBlock[] {
  const blocks: PreparedBlock[] = [];
  const itemCtx: ParseContext = {
    listDepth: ctx.listDepth + 1,
    quoteDepth: ctx.quoteDepth,
  };

  for (let index = 0; index < token.items.length; index++) {
    const item = token.items[index]!;
    let itemBlocks = parseBlockTokens(getListItemContentTokens(item), itemCtx);
    if (itemBlocks.length === 0) {
      itemBlocks = buildPlainTextBlocks(item.text, "body", itemCtx);
    }

    decorateListItemBlocks(
      itemBlocks,
      resolveListMarkerText(token, item, index),
      listMarkerClassName,
      item.task,
    );
    appendBlockGroup(blocks, itemBlocks, getSpace(1));
  }

  return blocks;
}

function getListItemContentTokens(item: Tokens.ListItem): Tokens.ListItem["tokens"] {
  if (!item.task) return item.tokens;
  return item.tokens.filter((token) => token.type !== "checkbox");
}

function decorateListItemBlocks(
  blocks: PreparedBlock[],
  markerText: string,
  markerClassName: string,
  isTask: boolean,
): void {
  if (blocks.length === 0) return;

  const markerArea = isTask ? getSpace(6) : getSpace(4);
  for (let index = 0; index < blocks.length; index++) {
    blocks[index] = shiftBlock(blocks[index]!, markerArea);
  }

  const firstBlock = blocks[0]!;
  blocks[0] = {
    ...firstBlock,
    markerClassName,
    markerLeft: firstBlock.contentLeft - markerArea,
    markerText,
  } satisfies PreparedBlock;
}

function shiftBlock(block: PreparedBlock, delta: number): PreparedBlock {
  if (block.markerText !== null) return block;
  return {
    ...block,
    contentLeft: block.contentLeft + delta,
  } satisfies PreparedBlock;
}

function resolveListMarkerText(list: Tokens.List, item: Tokens.ListItem, index: number): string {
  if (item.task) return item.checked ? "✅" : "⬜";
  if (list.ordered) {
    const start = typeof list.start === "number" ? list.start : 1;
    return `${start + index}.`;
  }
  return "•";
}
