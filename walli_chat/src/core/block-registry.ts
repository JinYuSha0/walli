import { marked, type Token, type TokenizerExtension } from "marked";
import type { BlockFrame, BlockLayout, PreparedBlock } from "./types";
import type {
  WalliChatActionConfig,
  WalliChatDeleteMessagesOptions,
  WalliChatCustomBlockAction,
  WalliChatInsertMessagesOptions,
  WalliChatMessage,
  WalliChatMessageRole,
  WalliChatRemoveMessages,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
} from "../types";
import type { IconNode } from "lucide";

export type WalliChatBlockMeasureContext = {
  meta?: unknown;
  role: WalliChatMessageRole;
  availableWidth: number;
};

export type WalliChatBlockMetrics = {
  height: number;
  width?: number;
};

export type WalliChatBlockMaterializeContext = {
  role: WalliChatMessageRole;
  height: number;
  width: number;
};

export type WalliChatBlockState = {
  isStreaming: boolean;
};

export type WalliChatMessageBlockState = {
  actionIcons: Map<string, IconNode>;
  values: Map<string, unknown>;
};

export function getOrCreateMessageBlockState(
  blockStates: Map<string, WalliChatMessageBlockState>,
  messageId: string,
): WalliChatMessageBlockState {
  let state = blockStates.get(messageId);
  if (state === undefined) {
    state = { actionIcons: new Map(), values: new Map() };
    blockStates.set(messageId, state);
  }
  return state;
}

export type WalliChatScrollState = {
  distanceToBottom: number;
  isAtBottom: boolean;
  scrollHeight: number;
  scrollTop: number;
  viewportHeight: number;
};

export type WalliChatBlockContext = WalliChatBlockState & {
  meta?: unknown;
  actionConfig: WalliChatActionConfig;
  blockStates: Map<string, WalliChatMessageBlockState>;
  action: (action: WalliChatCustomBlockAction) => Promise<boolean>;
  getBlockState: (messageId: string, key: string) => unknown;
  getScrollState: () => WalliChatScrollState;
  requestRender: (messageId?: string) => void;
  setBlockState: (messageId: string, key: string, value: unknown) => void;
  deleteMessages: (ids: readonly string[], options?: WalliChatDeleteMessagesOptions) => number;
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
  meta?: unknown;
  role: WalliChatMessageRole;
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
  role?: WalliChatMessageRole;
  meta?: unknown;
  marginBottom?: number;
  marginTop?: number;
  measure: (data: Prepared, context: WalliChatBlockMeasureContext) => WalliChatBlockMetrics;
  render: (context: WalliChatTokenizedBlockRenderContext<Materialized>) => unknown;
  styles?: string | readonly string[];
  tokenizer: WalliChatBlockTokenizer<Input>;
} & PrepareStage<Input, Prepared> &
  MaterializeStage<Prepared, Materialized>;

export type WalliChatRoleBlockDefinition<Prepared = string, Materialized = Prepared> = Omit<
  WalliChatTokenizedBlockDefinition<string, Prepared, Materialized>,
  "tokenizer" | "role"
> & {
  scope: "message";
  role: WalliChatMessageRole;
};

export type AnyCustomBlockDefinition = Omit<
  WalliChatTokenizedBlockDefinition<unknown, unknown, unknown>,
  "tokenizer"
>;

type ScopedDefinitions<T> = Map<string, Map<WalliChatMessageRole | undefined, { definition: T }[]>>;

function resolveDefinition<T>(
  definitions: ScopedDefinitions<T>,
  name: string,
  role?: WalliChatMessageRole,
): T | undefined {
  const scopes = definitions.get(name);
  return (scopes?.get(role)?.at(-1) ?? scopes?.get(undefined)?.at(-1))?.definition;
}

function registerDefinition<T>(
  definitions: ScopedDefinitions<T>,
  name: string,
  role: WalliChatMessageRole | undefined,
  definition: T,
): WalliChatBlockRegistration {
  let scopes = definitions.get(name);
  if (!scopes) definitions.set(name, (scopes = new Map()));
  let entries = scopes.get(role);
  if (!entries) scopes.set(role, (entries = []));
  const entry = { definition };
  entries.push(entry);
  return {
    unregister() {
      const index = entries.indexOf(entry);
      if (index < 0) return;
      entries.splice(index, 1);
      if (entries.length === 0) scopes.delete(role);
      if (scopes.size === 0) definitions.delete(name);
    },
  };
}

const definitions: ScopedDefinitions<WalliChatTokenizedBlockDefinition<unknown, unknown, unknown>> =
  new Map();
const roleDefinitions: ScopedDefinitions<AnyCustomBlockDefinition> = new Map();

export function resolveRoleBlockDefinition(
  role: WalliChatMessageRole,
): AnyCustomBlockDefinition | undefined {
  return resolveDefinition(roleDefinitions, "message", role);
}

const installedTokenizerNames = new Set<string>();
const tokenTypePrefix = "walli-custom-block-";

export function resolveCustomBlockToken(
  token: Token,
  role?: WalliChatMessageRole,
): { data: unknown; definition: AnyCustomBlockDefinition } | null {
  if (!token.type.startsWith(tokenTypePrefix)) return null;
  const definition = resolveDefinition(definitions, token.type.slice(tokenTypePrefix.length), role);
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
  role: WalliChatMessageRole;
  block: BuiltInBlockLayoutMap[Name];
  contentInsetX: number;
} & (Name extends "custom" ? { ctx: WalliChatBlockContext; messageId: string } : object);

export type WalliChatBlockDefinition<Name extends WalliChatBlockName = WalliChatBlockName> =
  BuiltInBlockDefinitionMap[Name] & { role?: WalliChatMessageRole };

export type WalliChatBlockRegistration = {
  unregister: () => void;
};

type AnyBuiltInBlockDefinition = BuiltInBlockDefinitionMap[WalliChatBuiltInBlockName];

const builtInBlockDefinitions: ScopedDefinitions<AnyBuiltInBlockDefinition> = new Map();

export function resolveBuiltInBlockDefinition<Name extends WalliChatBuiltInBlockName>(
  name: Name,
  role?: WalliChatMessageRole,
): BuiltInBlockDefinitionMap[Name] {
  const definition = resolveDefinition(builtInBlockDefinitions, name, role);
  if (definition === undefined) throw new Error(`Built-in block "${name}" is not registered`);
  return definition as BuiltInBlockDefinitionMap[Name];
}

export function registerBlock<Name extends WalliChatBlockName>(
  definition: WalliChatBlockDefinition<Name>,
): WalliChatBlockRegistration;
export function registerBlock<Input, Prepared = Input, Materialized = Prepared>(
  definition: WalliChatTokenizedBlockDefinition<Input, Prepared, Materialized>,
): WalliChatBlockRegistration;
export function registerBlock<Prepared = string, Materialized = Prepared>(
  definition: WalliChatRoleBlockDefinition<Prepared, Materialized>,
): WalliChatBlockRegistration;
export function registerBlock(
  definition:
    WalliChatBlockDefinition | WalliChatTokenizedBlockDefinition | WalliChatRoleBlockDefinition,
): WalliChatBlockRegistration {
  const name = definition.name.trim();
  if (name.length === 0) throw new Error("Block name cannot be empty");
  const role = definition.role?.trim();
  if (role === "") throw new Error("Block role cannot be empty");

  if ("scope" in definition && definition.scope === "message") {
    if (!role) throw new Error("Message blocks require a role");
    return registerDefinition(
      roleDefinitions,
      "message",
      role,
      definition as AnyCustomBlockDefinition,
    );
  }

  if ("tokenizer" in definition) {
    const registration = registerDefinition(
      definitions,
      name,
      role,
      definition as WalliChatTokenizedBlockDefinition<unknown, unknown, unknown>,
    );

    if (!installedTokenizerNames.has(name)) {
      installedTokenizerNames.add(name);
      const extension: TokenizerExtension = {
        level: definition.tokenizer.level ?? "block",
        name: `${tokenTypePrefix}${name}`,
        tokenizer(source, tokens) {
          const role = (
            this.lexer.options as typeof this.lexer.options & { walliRole?: WalliChatMessageRole }
          ).walliRole;
          const current = resolveDefinition(definitions, name, role);
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

    return registration;
  }

  if (!Object.prototype.hasOwnProperty.call(builtInBlocks, name)) {
    throw new Error(`Unknown built-in block "${name}"`);
  }

  return registerDefinition(
    builtInBlockDefinitions,
    name,
    role,
    definition as AnyBuiltInBlockDefinition,
  );
}

export function measureMessageBlockFrame(
  block: PreparedBlock,
  contentWidth: number,
  top: number,
  meta?: unknown,
): BlockFrame {
  const definition = resolveBuiltInBlockDefinition(block.kind, block.role);
  return definition.measure(block as never, {
    meta,
    role: block.role ?? "assistant",
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
  const definition = resolveBuiltInBlockDefinition(block.kind, block.role);
  return definition.materialize(block as never, frame as never, {
    contentWidth,
    role: block.role ?? "assistant",
  }) as BlockLayout;
}

export function renderMessageBlockTemplate(
  block: BlockLayout,
  contentInsetX: number,
  ctx?: WalliChatBlockContext,
  messageId?: string,
  role: WalliChatMessageRole = "assistant",
): unknown {
  const definition = resolveBuiltInBlockDefinition(block.kind, role);
  if (block.kind !== "custom") return definition.render({ block, contentInsetX, role } as never);
  if (ctx === undefined) throw new Error("Custom blocks require a Walli Chat block context");
  if (messageId === undefined) throw new Error("Custom blocks require a message id");
  return definition.render({ block, contentInsetX, ctx, messageId, role } as never);
}
