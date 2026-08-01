import { CODE_BLOCK_PADDING_Y, type BlockLayout } from "../../markdown-chat.model";

export const BLOCK_CLASS = "absolute left-0 w-full box-border";

const QUOTE_RAIL_CLASS =
  "absolute top-0 bottom-0 w-[3px] rounded-full bg-muted-foreground opacity-20";

export function createBlockShell(block: BlockLayout, contentInsetX: number): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = BLOCK_CLASS;
  wrapper.style.top = `${block.top}px`;
  wrapper.style.height = `${block.height}px`;

  appendRails(wrapper, block, contentInsetX);
  appendMarker(wrapper, block, contentInsetX);
  return wrapper;
}

function appendRails(wrapper: HTMLDivElement, block: BlockLayout, contentInsetX: number): void {
  for (let index = 0; index < block.quoteRailLefts.length; index++) {
    const rail = document.createElement("div");
    rail.className = QUOTE_RAIL_CLASS;
    rail.style.left = `${contentInsetX + block.quoteRailLefts[index]!}px`;
    wrapper.append(rail);
  }
}

function appendMarker(wrapper: HTMLDivElement, block: BlockLayout, contentInsetX: number): void {
  if (block.markerText === null || block.markerLeft === null || block.markerClassName === null) {
    return;
  }

  const marker = document.createElement("span");
  marker.className = block.markerClassName;
  marker.style.left = `${contentInsetX + block.markerLeft}px`;
  marker.style.top = `${markerTop(block)}px`;
  marker.textContent = block.markerText;
  wrapper.append(marker);
}

function markerTop(block: BlockLayout): number {
  switch (block.kind) {
    case "code":
      return CODE_BLOCK_PADDING_Y;
    case "image":
      return 0;
    case "inline":
      return Math.max(0, Math.round((block.lineHeight - 12) / 2));
    case "rule":
      return 0;
  }
}
