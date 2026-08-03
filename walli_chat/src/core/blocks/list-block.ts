import type { Tokens } from "marked";
import type { ParseContext, PreparedBlock } from "../type";
import { parseBlockTokens } from "../md-parse";
import { buildPlainTextBlocks } from "./plain-text-block";
import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import { inlinePiece } from "../styles";
import { getSpace } from "../styles/config";
import { appendBlockGroup } from "../helper";
import { computed } from "@preact/signals-core";

const ListBlockStyle = computed(() => ({
  listItemGap: getSpace(1),
  listMarkerGap: getSpace(2.5),
}));

export function getListBlockStyle(key: keyof (typeof ListBlockStyle)["value"]) {
  return ListBlockStyle.value[key];
}

const markerWidthCache = new Map<string, number>();
const markStyle = inlinePiece.mark();

export function buildListBlocks(token: Tokens.List, ctx: ParseContext): PreparedBlock[] {
  const blocks: PreparedBlock[] = [];
  const itemCtx: ParseContext = {
    listDepth: ctx.listDepth + 1,
    quoteDepth: ctx.quoteDepth,
  };

  for (let index = 0; index < token.items.length; index++) {
    const item = token.items[index]!;
    let itemBlocks = parseBlockTokens(item.tokens, itemCtx);
    if (itemBlocks.length === 0) {
      itemBlocks = buildPlainTextBlocks(item.text, "body", itemCtx);
    }

    decorateListItemBlocks(
      itemBlocks,
      resolveListMarkerText(token, item, index),
      markStyle.className,
    );
    appendBlockGroup(blocks, itemBlocks, getListBlockStyle("listItemGap"));
  }

  return blocks;
}

function decorateListItemBlocks(
  blocks: PreparedBlock[],
  markerText: string,
  markerClassName: string,
): void {
  if (blocks.length === 0) return;

  const markerArea = measureMarkerWidth(markerText) + getListBlockStyle("listMarkerGap");
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

function measureMarkerWidth(text: string): number {
  const cached = markerWidthCache.get(text);
  if (cached !== undefined) return cached;

  const width = measureNaturalWidth(prepareWithSegments(text, markStyle.font));
  markerWidthCache.set(text, width);
  return width;
}

function shiftBlock(block: PreparedBlock, delta: number): PreparedBlock {
  return {
    ...block,
    contentLeft: block.contentLeft + delta,
  } satisfies PreparedBlock;
}

function resolveListMarkerText(list: Tokens.List, item: Tokens.ListItem, index: number): string {
  if (item.task) return item.checked ? "☑" : "☐";
  if (list.ordered) {
    const start = typeof list.start === "number" ? list.start : 1;
    return `${start + index}.`;
  }
  return "•";
}
