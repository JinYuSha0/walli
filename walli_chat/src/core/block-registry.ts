import { marked, type Token, type TokenizerExtension } from "marked";
import type { BlockFrame, BlockLayout, PreparedBlock } from "./types";
import type {
  WalliChatBlockAction,
  WalliChatInsertMessagesOptions,
  WalliChatMessage,
  WalliChatRemoveMessages,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
} from "../types";

export type WalliChatBlockMeasureContext = {
  availableWidth: number;
};

export type WalliChatBlockMetrics = {
  height: number;
  width?: number;
};

export type WalliChatBlockMaterializeContext = {
  height: number;
  width: number;
};

export type WalliChatBlockState = {
  isStreaming: boolean;
};

export type WalliChatScrollState = {
  distanceToBottom: number;
  isAtBottom: boolean;
  scrollHeight: number;
  scrollTop: number;
  viewportHeight: number;
};

export type WalliChatBlockContext = WalliChatBlockState & {
  action: (action: WalliChatBlockAction) => Promise<boolean>;
  getScrollState: () => WalliChatScrollState;
  insertMessagesAtBottom: (
    messages: readonly WalliChatMessage[],
    options?: WalliChatInsertMessagesOptions,
  ) => WalliChatRemoveMessages;
  insertMessagesAtTop: (
    messages: readonly WalliChatMessage[],
    options?: WalliChatInsertMessagesOptions,
  ) => WalliChatRemoveMessages;
  scrollTo: (options: WalliChatScrollToOptions) => void;
  scrollToIndex: (options: WalliChatScrollToIndexOptions) => void;
  submit: (text: string) => Promise<boolean>;
};

export type WalliChatTokenizedBlockRenderContext<T> = {
  contentInsetX: number;
  ctx: WalliChatBlockContext;
  data: T;
  height: number;
  left: number;
  messageId: string;
  top: number;
  width: number;
};

export type WalliChatBlockTokenizer<T> = {
  level?: "block";
  tokenize: (source: string, tokens: readonly Token[]) => { data: T; raw: string } | undefined;
};

type IsSameType<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type PrepareStage<Input, Prepared> =
  IsSameType<Input, Prepared> extends true
    ? { prepare?: (data: Input) => Prepared }
    : { prepare: (data: Input) => Prepared };

type MaterializeStage<Prepared, Materialized> =
  IsSameType<Prepared, Materialized> extends true
    ? {
        materialize?: (data: Prepared, context: WalliChatBlockMaterializeContext) => Materialized;
      }
    : {
        materialize: (data: Prepared, context: WalliChatBlockMaterializeContext) => Materialized;
      };

export type WalliChatTokenizedBlockDefinition<
  Input = unknown,
  Prepared = Input,
  Materialized = Prepared,
> = {
  name: string;
  marginTop?: number;
  measure: (data: Prepared, context: WalliChatBlockMeasureContext) => WalliChatBlockMetrics;
  render: (context: WalliChatTokenizedBlockRenderContext<Materialized>) => unknown;
  styles?: string | readonly string[];
  tokenizer: WalliChatBlockTokenizer<Input>;
} & PrepareStage<Input, Prepared> &
  MaterializeStage<Prepared, Materialized>;

export type AnyCustomBlockDefinition = WalliChatTokenizedBlockDefinition<unknown, unknown, unknown>;

const definitions = new Map<string, AnyCustomBlockDefinition>();
const installedTokenizerNames = new Set<string>();
const tokenTypePrefix = "walli-custom-block-";

export function resolveCustomBlockToken(
  token: Token,
): { data: unknown; definition: AnyCustomBlockDefinition } | null {
  if (!token.type.startsWith(tokenTypePrefix)) return null;
  const definition = definitions.get(token.type.slice(tokenTypePrefix.length));
  if (!definition) return null;
  const data = (token as Token & { walliCustomBlockData?: unknown }).walliCustomBlockData;
  return { data, definition };
}

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
export type WalliChatBlockName = WalliChatBuiltInBlockName;

type BuiltInBlockDefinitionMap = {
  assetsGroup: typeof import("./blocks/assets-group-block").assetsGroupBlockDefinition;
  code: typeof import("./blocks/code-block").codeBlockDefinition;
  custom: typeof import("./blocks/custom-block").customBlockDefinition;
  image: typeof import("./blocks/image-block").imageBlockDefinition;
  inline: typeof import("./blocks/inline-block").inlineBlockDefinition;
  rule: typeof import("./blocks/rule-block").ruleBlockDefinition;
  table: typeof import("./blocks/table-block").tableBlockDefinition;
};

type BuiltInBlockLayoutMap = {
  [Name in WalliChatBuiltInBlockName]: Extract<BlockLayout, { kind: Name }>;
};

export type WalliChatBlockRenderContext<Name extends WalliChatBlockName = WalliChatBlockName> = {
  block: BuiltInBlockLayoutMap[Name];
  contentInsetX: number;
} & (Name extends "custom" ? { ctx: WalliChatBlockContext; messageId: string } : object);

export type WalliChatBlockDefinition<Name extends WalliChatBlockName = WalliChatBlockName> =
  BuiltInBlockDefinitionMap[Name];

export type WalliChatBlockRegistration = {
  unregister: () => void;
};

type AnyBuiltInBlockDefinition = BuiltInBlockDefinitionMap[WalliChatBuiltInBlockName];

const builtInBlockDefinitions = new Map<WalliChatBuiltInBlockName, AnyBuiltInBlockDefinition>();

export function resolveBuiltInBlockDefinition<Name extends WalliChatBuiltInBlockName>(
  name: Name,
): BuiltInBlockDefinitionMap[Name] {
  const definition = builtInBlockDefinitions.get(name);
  if (definition === undefined) throw new Error(`Built-in block "${name}" is not registered`);
  return definition as BuiltInBlockDefinitionMap[Name];
}

export function registerBlock<Name extends WalliChatBlockName>(
  definition: WalliChatBlockDefinition<Name>,
): WalliChatBlockRegistration;
export function registerBlock<Input, Prepared = Input, Materialized = Prepared>(
  definition: WalliChatTokenizedBlockDefinition<Input, Prepared, Materialized>,
): WalliChatBlockRegistration;
export function registerBlock(
  definition: WalliChatBlockDefinition | WalliChatTokenizedBlockDefinition,
): WalliChatBlockRegistration {
  const name = definition.name.trim();
  if (name.length === 0) throw new Error("Block name cannot be empty");

  if ("tokenizer" in definition) {
    const previous = definitions.get(name);
    const stored = definition as AnyCustomBlockDefinition;
    definitions.set(name, stored);

    if (!installedTokenizerNames.has(name)) {
      installedTokenizerNames.add(name);
      const extension: TokenizerExtension = {
        level: definition.tokenizer.level ?? "block",
        name: `${tokenTypePrefix}${name}`,
        tokenizer(source, tokens) {
          const current = definitions.get(name);
          if (current === undefined) return undefined;
          const result = current.tokenizer.tokenize(source, tokens);
          if (!result) return undefined;
          if (result.raw.length === 0) {
            throw new Error(`Custom block "${name}" tokenizer returned an empty raw value`);
          }
          return {
            type: `${tokenTypePrefix}${name}`,
            raw: result.raw,
            walliCustomBlockData: result.data,
          };
        },
      };
      marked.use({ extensions: [extension] });
    }

    return {
      unregister() {
        if (definitions.get(name) !== stored) return;
        if (previous) definitions.set(name, previous);
        else definitions.delete(name);
      },
    };
  }

  if (!Object.prototype.hasOwnProperty.call(builtInBlocks, name)) {
    throw new Error(`Unknown built-in block "${name}"`);
  }

  const builtInName = name as WalliChatBuiltInBlockName;
  const previous = builtInBlockDefinitions.get(builtInName);
  const stored = definition as unknown as AnyBuiltInBlockDefinition;
  builtInBlockDefinitions.set(builtInName, stored);

  return {
    unregister() {
      if (builtInBlockDefinitions.get(builtInName) !== stored) return;
      if (previous) builtInBlockDefinitions.set(builtInName, previous);
      else builtInBlockDefinitions.delete(builtInName);
    },
  };
}

export function measureMessageBlockFrame(
  block: PreparedBlock,
  contentWidth: number,
  top: number,
): BlockFrame {
  const definition = resolveBuiltInBlockDefinition(block.kind);
  return definition.measure(block as never, {
    availableWidth: Math.max(1, contentWidth - block.contentLeft),
    contentWidth,
    top,
  }) as BlockFrame;
}

export function materializeMessageBlockLayout(
  block: PreparedBlock,
  frame: BlockFrame,
  contentWidth: number,
): BlockLayout {
  const definition = resolveBuiltInBlockDefinition(block.kind);
  return definition.materialize(block as never, frame as never, { contentWidth }) as BlockLayout;
}

export function renderMessageBlockTemplate(
  block: BlockLayout,
  contentInsetX: number,
  ctx?: WalliChatBlockContext,
  messageId?: string,
): unknown {
  const definition = resolveBuiltInBlockDefinition(block.kind);
  if (block.kind !== "custom") return definition.render({ block, contentInsetX } as never);
  if (ctx === undefined) throw new Error("Custom blocks require a Walli Chat block context");
  if (messageId === undefined) throw new Error("Custom blocks require a message id");
  return definition.render({ block, contentInsetX, ctx, messageId } as never);
}
