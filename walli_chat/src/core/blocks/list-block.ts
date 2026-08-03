import type { Tokens } from "marked";
import type { ParseContext, PreparedBlock } from "../type";
import { parseBlockTokens } from "../md-parse";
import { buildPlainTextBlocks } from "./plain-text-block";
import { inlinePiece } from "../styles";
import { getSpace } from "../styles/config";
import { appendBlockGroup } from "../helper";
import { computed } from "@preact/signals-core";

const ListBlockStyle = computed(() => ({
  listItemGap: getSpace(1),
  listMarkerArea: getSpace(4),
  taskMarkerArea: getSpace(6),
}));

export function getListBlockStyle(key: keyof (typeof ListBlockStyle)["value"]) {
  return ListBlockStyle.value[key];
}

const markStyle = inlinePiece.mark();

export function buildListBlocks(token: Tokens.List, ctx: ParseContext): PreparedBlock[] {
  const blocks: PreparedBlock[] = [];
  const itemCtx: ParseContext = {
    listDepth: ctx.listDepth,
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
      markStyle.className,
      item.task,
    );
    appendBlockGroup(blocks, itemBlocks, getListBlockStyle("listItemGap"));
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

  const markerArea = isTask
    ? getListBlockStyle("taskMarkerArea")
    : getListBlockStyle("listMarkerArea");
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
  if (block.markerText !== null) {
    return block;
  }

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
