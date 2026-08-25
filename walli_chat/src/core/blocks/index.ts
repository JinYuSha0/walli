import { html } from "lit";
import type { BlockLayout } from "../type";
import {
  registerTokenizedBlock,
  type WalliChatTokenizedBlockDefinition,
} from "./custom-block";

export { buildInlineBlocks, WalliInlineBlockElement } from "./inline-block";
export { buildCodeBlock, WalliCodeBlockElement } from "./code-block";
export { buildRuleBlock, WalliRuleBlockElement } from "./rule-block";
export { buildImageBlock, WalliImageBlockElement } from "./image-block";
export { buildFileBlock } from "./file-block";
export { WalliAssetsGroupBlockElement } from "./assets-group-block";
export { buildPlainTextBlocks } from "./plain-text-block";
export { buildListBlocks } from "./list-block";
export { buildTableBlock, WalliTableBlockElement } from "./table-block";
export { WalliCustomBlockElement } from "./custom-block";
export { loadingBlockDefinition } from "./loading-block";

export const builtInBlocks = {
  assetsGroup: "assetsGroup",
  code: "code",
  custom: "custom",
  image: "image",
  inline: "inline",
  rule: "rule",
  table: "table",
} as const;

export type WalliChatBuiltInBlockName = keyof typeof builtInBlocks;
export type WalliChatBlockName = WalliChatBuiltInBlockName | (string & {});

type BuiltInBlockLayoutMap = {
  [Name in WalliChatBuiltInBlockName]: Extract<BlockLayout, { kind: Name }>;
};

type BlockLayoutForName<Name extends WalliChatBlockName> =
  Name extends WalliChatBuiltInBlockName
    ? BuiltInBlockLayoutMap[Name]
    : Extract<BlockLayout, { kind: "custom" }>;

export type WalliChatBlockRenderContext<Name extends WalliChatBlockName = WalliChatBlockName> = {
  block: BlockLayoutForName<Name>;
  contentInsetX: number;
};

export type WalliChatBlockDefinition<Name extends WalliChatBlockName = WalliChatBlockName> = {
  name: Name;
  render: (context: WalliChatBlockRenderContext<Name>) => unknown;
};

export type WalliChatBlockRegistration = {
  unregister: () => void;
};

type AnyBlockDefinition = WalliChatBlockDefinition<WalliChatBlockName>;

const blockDefinitions = new Map<string, AnyBlockDefinition>();

export function registerBlock<Name extends WalliChatBlockName>(
  definition: WalliChatBlockDefinition<Name>,
): WalliChatBlockRegistration;
export function registerBlock<T>(
  definition: WalliChatTokenizedBlockDefinition<T>,
): WalliChatBlockRegistration;
export function registerBlock(
  definition: WalliChatBlockDefinition | WalliChatTokenizedBlockDefinition,
): WalliChatBlockRegistration {
  if ("tokenizer" in definition) return registerTokenizedBlock(definition);

  const name = definition.name.trim();
  if (name.length === 0) throw new Error("Block name cannot be empty");

  const previous = blockDefinitions.get(name);
  const stored = definition as unknown as AnyBlockDefinition;
  blockDefinitions.set(name, stored);

  return {
    unregister() {
      if (blockDefinitions.get(name) !== stored) return;
      if (previous) blockDefinitions.set(name, previous);
      else blockDefinitions.delete(name);
    },
  };
}

const builtInBlockDefinitions = {
  assetsGroup: {
    name: builtInBlocks.assetsGroup,
    render: ({ block, contentInsetX }) =>
      html`<walli-assets-group-block
        .layout=${{ block, contentInsetX }}
      ></walli-assets-group-block>`,
  },
  code: {
    name: builtInBlocks.code,
    render: ({ block, contentInsetX }) =>
      html`<walli-code-block .layout=${{ block, contentInsetX }}></walli-code-block>`,
  },
  custom: {
    name: builtInBlocks.custom,
    render: ({ block, contentInsetX }) =>
      html`<walli-custom-block .layout=${{ block, contentInsetX }}></walli-custom-block>`,
  },
  image: {
    name: builtInBlocks.image,
    render: ({ block, contentInsetX }) =>
      html`<walli-image-block .layout=${{ block, contentInsetX }}></walli-image-block>`,
  },
  inline: {
    name: builtInBlocks.inline,
    render: ({ block, contentInsetX }) =>
      html`<walli-inline-block .layout=${{ block, contentInsetX }}></walli-inline-block>`,
  },
  rule: {
    name: builtInBlocks.rule,
    render: ({ block, contentInsetX }) =>
      html`<walli-rule-block .layout=${{ block, contentInsetX }}></walli-rule-block>`,
  },
  table: {
    name: builtInBlocks.table,
    render: ({ block, contentInsetX }) =>
      html`<walli-table-block .layout=${{ block, contentInsetX }}></walli-table-block>`,
  },
} satisfies { [Name in WalliChatBuiltInBlockName]: WalliChatBlockDefinition<Name> };

export function renderMessageBlockTemplate(
  block: BlockLayout,
  contentInsetX: number,
): unknown {
  const name = block.kind === "custom" ? block.definition.name : block.kind;
  const definition = blockDefinitions.get(name) ?? builtInBlockDefinitions[block.kind];
  return definition.render({ block, contentInsetX } as never);
}
