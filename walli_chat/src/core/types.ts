import type {
  AssetsGroupBlockFrame,
  AssetsGroupBlockLayout,
  PreparedAssetsGroupBlock,
} from "./blocks/assets-group-block";
import type { CodeBlockFrame, CodeBlockLayout, PreparedCodeBlock } from "./blocks/code-block";
import type {
  CustomBlockFrame,
  CustomBlockLayout,
  PreparedCustomBlock,
} from "./blocks/custom-block";
import type { ImageBlockFrame, ImageBlockLayout, PreparedImageBlock } from "./blocks/image-block";
import type {
  InlineBlockFrame,
  InlineBlockLayout,
  PreparedInlineBlock,
} from "./blocks/inline-block";
import type { PreparedRuleBlock, RuleBlockFrame, RuleBlockLayout } from "./blocks/rule-block";
import type { PreparedTableBlock, TableBlockFrame, TableBlockLayout } from "./blocks/table-block";

export type CoreBlockMeasureContext = {
  availableWidth: number;
  contentWidth: number;
  top: number;
};

export type CoreBlockMaterializeContext = {
  contentWidth: number;
};

type CoreBlockPrepare<Kind extends PreparedBlock["kind"]> = (
  ...args: any[]
) => Extract<PreparedBlock, { kind: Kind }> | PreparedBlock[] | null;

export type CoreBlockDefinition<
  Kind extends PreparedBlock["kind"],
  Prepare extends CoreBlockPrepare<Kind> = CoreBlockPrepare<Kind>,
> = {
  name: Kind;
  prepare: Prepare;
  measure: (
    block: Extract<PreparedBlock, { kind: Kind }>,
    context: CoreBlockMeasureContext,
  ) => Extract<BlockFrame, { kind: Kind }>;
  materialize: (
    block: Extract<PreparedBlock, { kind: Kind }>,
    frame: Extract<BlockFrame, { kind: Kind }>,
    context: CoreBlockMaterializeContext,
  ) => Extract<BlockLayout, { kind: Kind }>;
  render: (context: {
    block: Extract<BlockLayout, { kind: Kind }>;
    contentInsetX: number;
  }) => unknown;
};

export type ParseContext = {
  listDepth: number;
  quoteDepth: number;
};

export type PreparedBlockBase = {
  contentLeft: number;
  marginTop: number;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
};

export type PreparedBlock =
  | PreparedInlineBlock
  | PreparedCodeBlock
  | PreparedImageBlock
  | PreparedAssetsGroupBlock
  | PreparedRuleBlock
  | PreparedTableBlock
  | PreparedCustomBlock;

export type PreparedChatMessage = {
  blocks: PreparedBlock[];
  markdown: string;
  id: string;
  role: "assistant" | "user";
  showActions: boolean;
  streaming?: boolean;
};

export type BlockFrameBase = {
  contentLeft: number;
  height: number;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
};

export type BlockFrame =
  | InlineBlockFrame
  | CodeBlockFrame
  | ImageBlockFrame
  | AssetsGroupBlockFrame
  | RuleBlockFrame
  | TableBlockFrame
  | CustomBlockFrame;

export type BlockLayout =
  | InlineBlockLayout
  | CodeBlockLayout
  | ImageBlockLayout
  | AssetsGroupBlockLayout
  | RuleBlockLayout
  | TableBlockLayout
  | CustomBlockLayout;

export type MessageFrame = {
  actionHeight: number;
  blocks: BlockFrame[];
  bubbleHeight: number;
  contentInsetX: number;
  frameWidth: number;
  layoutContentWidth: number;
  role: "assistant" | "user";
  totalHeight: number;
  paddingTop?: number;
};

export type ChatMessageInstance = {
  bottom: number;
  prepared: PreparedChatMessage;
  frame: MessageFrame;
  top: number;
};

export type ConversationFrame = {
  topOcclusionHeight: number;
  bottomOcclusionHeight: number;
  composerBottomInsetHeight: number;
  chatWidth: number;
  messages: ChatMessageInstance[];
  totalHeight: number;
};
