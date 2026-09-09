import { html, type TemplateResult } from "lit";
import type {
  BlockFrame,
  BlockFrameBase,
  BlockLayout,
  CoreBlockDefinition,
  PreparedBlock,
  PreparedBlockBase,
} from "../types";
import { createBlockBase, createBlockFrameBase } from "../helper";
import { getCommonStyle } from "../styles";
import { getBlockUsedWidth } from "../index";
import {
  measureMessageBlockFrame,
  materializeMessageBlockLayout,
  renderMessageBlockTemplate,
} from "../block-registry";

export type PreparedBubbleBlock = PreparedBlockBase & {
  kind: "bubble";
  blocks: PreparedBlock[];
};
export type BubbleBlockFrame = BlockFrameBase & {
  kind: "bubble";
  width: number;
  blocks: BlockFrame[];
};
export type BubbleBlockLayout = Omit<BubbleBlockFrame, "blocks"> & {
  blocks: BlockLayout[];
};

export const bubbleBlockDefinition = {
  name: "bubble",
  prepare(blocks: PreparedBlock[], base: PreparedBlockBase): PreparedBubbleBlock {
    return {
      ...createBlockBase({ role: base.role, listDepth: 0, quoteDepth: 0 }),
      marginTop: base.marginTop,
      kind: "bubble",
      blocks,
    };
  },
  measure(block, { contentWidth, top, meta }) {
    const paddingX = getCommonStyle("bubblePaddingX");
    const paddingY = getCommonStyle("bubblePaddingY");
    let height = paddingY;
    let width = 0;
    const blocks = block.blocks.map((child, index) => {
      if (index > 0) height += child.marginTop;
      const frame = measureMessageBlockFrame(child, contentWidth, height, meta);
      height += frame.height;
      width = Math.max(width, getBlockUsedWidth(frame));
      return frame;
    });
    return {
      ...createBlockFrameBase(block, top),
      kind: "bubble",
      blocks,
      width: Math.min(contentWidth, width) + paddingX * 2,
      height: height + paddingY,
    };
  },
  materialize(block, frame, { contentWidth }) {
    return {
      ...frame,
      blocks: block.blocks.map((child, index) =>
        materializeMessageBlockLayout(child, frame.blocks[index]!, contentWidth),
      ),
    };
  },
  render({ block, role, locales }): TemplateResult {
    return html`<div
      class="absolute right-0 rounded-2xl text-secondary-foreground shadow-lg bg-[var(--user-message-background,var(--walli-user-message-background))]"
      style=${`top:${block.top}px;width:${block.width}px;height:${block.height}px;`}
    >
      ${block.blocks.map((child) =>
        renderMessageBlockTemplate(
          child,
          getCommonStyle("bubblePaddingX"),
          undefined,
          undefined,
          role,
          locales,
        ),
      )}
    </div>`;
  },
} satisfies CoreBlockDefinition<"bubble">;
