import type { LayoutLine, PreparedTextWithSegments } from "@chenglou/pretext";
import type { PreparedRichInline } from "@chenglou/pretext/rich-inline";
import type { AnyCustomBlockDefinition } from "./custom-block";

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

export type PreparedInlineBlock = PreparedBlockBase & {
  kind: "inline";
  classNames: string[];
  flow: PreparedRichInline;
  hrefs: Array<string | null>;
  imageAlts: Array<string | null>;
  imageSrcs: Array<string | null>;
  lineHeight: number;
};

export type PreparedCodeBlock = PreparedBlockBase & {
  kind: "code";
  language: string | null;
  lineHeight: number;
  prepared: PreparedTextWithSegments;
  text: string;
};

export type PreparedImageBlock = PreparedBlockBase & {
  alt: string;
  kind: "image";
  src: string;
  targetHeight: number | null;
  targetWidth: number | null;
};

export type PreparedRuleBlock = PreparedBlockBase & {
  kind: "rule";
  height: number;
};

export type PreparedTableBlock = PreparedBlockBase & {
  kind: "table";
  lineHeight: number;
  header: PreparedTableCell[];
  rows: PreparedTableCell[][];
};

export type PreparedCustomBlock = PreparedBlockBase & {
  data: unknown;
  definition: AnyCustomBlockDefinition;
  kind: "custom";
};

export type PreparedTableCell = {
  align: "left" | "center" | "right" | null;
  classNames: string[];
  flow: PreparedRichInline;
  hrefs: Array<string | null>;
  imageAlts: Array<string | null>;
  imageSrcs: Array<string | null>;
};

export type PreparedBlock =
  | PreparedInlineBlock
  | PreparedCodeBlock
  | PreparedImageBlock
  | PreparedRuleBlock
  | PreparedTableBlock
  | PreparedCustomBlock;

export type PreparedChatMessage = {
  blocks: PreparedBlock[];
  markdown: string;
  id: string;
  role: "assistant" | "user";
  streaming?: boolean;
};

export type InlineVariant = "body" | "h1" | "h2";

export type InlinePiece = {
  breakMode: "normal" | "never";
  className: string;
  font: string;
  text: string;
  extraWidth?: number;
  href?: string;
  imageAlt?: string;
  imageSrc?: string;
};

export type MarkState = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  href?: string;
};

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
  chatWidth: number;
  messages: ChatMessageInstance[];
  totalHeight: number;
};

export type InlineFragmentLayout = {
  alt: string | null;
  className: string;
  href: string | null;
  kind: "image" | "text";
  leadingGap: number;
  src: string | null;
  text: string;
};

export type InlineBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "inline";
  lineHeight: number;
  lines: Array<{
    fragments: InlineFragmentLayout[];
    width: number;
  }>;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  usedWidth: number;
};

export type CodeBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "code";
  language: string | null;
  lines: LayoutLine[];
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  text: string;
  usedWidth: number;
  width: number;
};

export type ImageBlockLayout = {
  alt: string;
  contentLeft: number;
  height: number;
  kind: "image";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  src: string;
  top: number;
  width: number;
};

export type RuleBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "rule";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  width: number;
};

export type TableCellLayout = {
  align: "left" | "center" | "right" | null;
  height: number;
  lines: Array<{
    fragments: InlineFragmentLayout[];
    width: number;
  }>;
  paddingInlineEnd: number;
  paddingInlineStart: number;
  width: number;
  x: number;
  y: number;
};

export type TableBlockLayout = {
  cells: TableCellLayout[];
  columnWidths: number[];
  contentLeft: number;
  height: number;
  kind: "table";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  viewportWidth: number;
  width: number;
};

export type CustomBlockLayout = {
  contentLeft: number;
  data: unknown;
  definition: AnyCustomBlockDefinition;
  height: number;
  kind: "custom";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  width: number;
};

export type BlockLayout =
  | InlineBlockLayout
  | CodeBlockLayout
  | ImageBlockLayout
  | RuleBlockLayout
  | TableBlockLayout
  | CustomBlockLayout;

export type BlockFrameBase = {
  contentLeft: number;
  height: number;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
};

export type InlineBlockFrame = BlockFrameBase & {
  kind: "inline";
  lineHeight: number;
  usedWidth: number;
};

export type CodeBlockFrame = BlockFrameBase & {
  kind: "code";
  lineHeight: number;
  width: number;
};

export type ImageBlockFrame = BlockFrameBase & {
  kind: "image";
  width: number;
};

export type RuleBlockFrame = BlockFrameBase & {
  kind: "rule";
  width: number;
};

export type TableBlockFrame = BlockFrameBase & {
  kind: "table";
  lineHeight: number;
  tableWidth: number;
  width: number;
};

export type CustomBlockFrame = BlockFrameBase & {
  kind: "custom";
  width: number;
};

export type BlockFrame =
  | InlineBlockFrame
  | CodeBlockFrame
  | ImageBlockFrame
  | RuleBlockFrame
  | TableBlockFrame
  | CustomBlockFrame;
