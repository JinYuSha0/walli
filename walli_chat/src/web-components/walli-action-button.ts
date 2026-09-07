import { Copy, Pencil, Share2, ThumbsDown, ThumbsUp, createElement } from "lucide";
import type { IconNode } from "lucide";
import { html, render } from "lit";
import { customElement } from "lit/decorators.js";
import type {
  WalliChatActionConfig,
  WalliChatActionComponent,
  WalliChatActionItemConfig,
  WalliChatCustomActionConfig,
  WalliChatMessageType,
  WalliChatSetActionIcon,
} from "../types";
import type { WalliChatMessageBlockState } from "../core/block-registry";

export type WalliActionKind = "copy" | "dislike" | "edit" | "like" | "share";
export type WalliActionButtonConfig = {
  icon?: IconNode;
  kind?: WalliActionKind;
  label?: string;
  onAction?: () => void;
  text?: string;
};

export type MessageActionItem = {
  component?: WalliChatActionComponent;
  icon?: IconNode;
  kind?: WalliActionKind;
  label?: string;
  sort: number;
  type: string;
};

export type MessageActionIconSetter = (type: string, icon?: IconNode) => void;
export type MessageActionsContext<Config> = {
  actionConfig: Config;
  blockStates: Map<string, WalliChatMessageBlockState>;
  id: string;
  markdown: string;
  getBlockState: (key: string) => unknown;
  setBlockState: (key: string, value: unknown) => void;
};

export function isActionVisible(config: WalliChatActionItemConfig | undefined, fallback: boolean) {
  if (config === undefined) return fallback;
  if (typeof config === "boolean") return config;
  return config.visible;
}

export function getActionSort(config: WalliChatActionItemConfig | undefined, fallback: number) {
  return typeof config === "object" ? (config.sort ?? fallback) : fallback;
}

export function sortActionItems(items: MessageActionItem[]): MessageActionItem[] {
  return items.sort((left, right) => left.sort - right.sort);
}

export type MessageActionRole = "assistant" | "user";
type BuiltInActionConfig = {
  defaultSort: number;
  defaultVisible: boolean;
  items: readonly { kind: WalliActionKind; label: string }[];
  name: "copy" | "edit" | "feedback" | "share";
};

const builtInActions: Record<MessageActionRole, readonly BuiltInActionConfig[]> = {
  assistant: [
    {
      defaultSort: 1,
      defaultVisible: true,
      items: [{ kind: "copy", label: "Copy" }],
      name: "copy",
    },
    {
      defaultSort: 2,
      defaultVisible: false,
      items: [
        { kind: "like", label: "Good response" },
        { kind: "dislike", label: "Bad response" },
      ],
      name: "feedback",
    },
    {
      defaultSort: 3,
      defaultVisible: false,
      items: [{ kind: "share", label: "Share" }],
      name: "share",
    },
  ],
  user: [
    {
      defaultSort: 1,
      defaultVisible: true,
      items: [{ kind: "copy", label: "Copy" }],
      name: "copy",
    },
    {
      defaultSort: 2,
      defaultVisible: false,
      items: [{ kind: "edit", label: "Edit" }],
      name: "edit",
    },
  ],
};

export function createMessageActionItems<Role extends MessageActionRole>(
  role: Role,
  config: NonNullable<WalliChatActionConfig[Role]>,
): MessageActionItem[] {
  const actionConfig = config as Record<string, WalliChatActionItemConfig | undefined>;
  const builtIns = builtInActions[role];
  const customConfigs = Object.entries(config).filter(
    (entry): entry is [string, WalliChatCustomActionConfig] => {
      const [, value] = entry;
      return typeof value === "object" && "type" in value;
    },
  );
  const customTypes = new Set(customConfigs.map(([, value]) => value.type));
  const items: MessageActionItem[] = customConfigs
    .filter(([, value]) => value.visible)
    .map<MessageActionItem>(([, value], index) => ({
      component: value.component,
      icon: value.icon,
      label: value.label,
      sort: value.sort ?? index + 1,
      type: value.type,
    }));

  for (const builtIn of builtIns) {
    if (customTypes.has(builtIn.name)) continue;
    const value = actionConfig[builtIn.name];
    if (!isActionVisible(value, builtIn.defaultVisible)) continue;
    const sort = getActionSort(value, builtIn.defaultSort);
    items.push(
      ...builtIn.items.map((item, index) => ({
        kind: item.kind,
        label: item.label,
        sort: sort + index / 10,
        type: item.kind,
      })),
    );
  }
  return sortActionItems(items);
}

export function createMessageActionDetail(
  item: MessageActionItem,
  messageId: string,
  messageType: WalliChatMessageType,
  markdown: string,
  setIcon: MessageActionIconSetter,
  getBlockState: (key: string) => unknown,
  setBlockState: (key: string, value: unknown) => void,
) {
  const actionSetIcon: WalliChatSetActionIcon = (icon, type) => setIcon(type ?? item.type, icon);
  const base = {
    messageId,
    messageType,
    markdown,
    getBlockState,
    setBlockState,
    setIcon: actionSetIcon,
  };
  if (item.type === "like" || item.type === "dislike") {
    return { ...base, feedback: item.type, type: "feedback" as const };
  }
  return { ...base, type: item.type };
}

const actionIcons: Record<WalliActionKind, () => SVGElement> = {
  copy: () => createActionIcon(Copy),
  dislike: () => createActionIcon(ThumbsDown),
  like: () => createActionIcon(ThumbsUp),
  edit: () => createActionIcon(Pencil),
  share: () => createActionIcon(Share2),
};

type LucideIconNode = Parameters<typeof createElement>[0];

function createActionIcon(icon: LucideIconNode): SVGElement {
  return createElement(icon, {
    "aria-hidden": "true",
    height: 18,
    width: 18,
  });
}

@customElement("walli-action-button")
export class WalliActionButtonElement extends HTMLElement {
  private config: WalliActionButtonConfig = { kind: "copy" };

  connectedCallback(): void {
    this.renderButton();
  }

  set action(value: WalliActionButtonConfig) {
    this.config = value;
    if (this.isConnected) this.renderButton();
  }

  private performAction(): void {
    if (this.config.kind === "copy") {
      void navigator.clipboard.writeText(this.config.text ?? "");
    }
    this.config.onAction?.();
  }

  private renderButton(): void {
    const label = this.config.label;
    render(
      html`<button
        class="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-visible rounded-lg border-0 bg-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        type="button"
        title=${label}
        aria-label=${label}
        @click=${() => this.performAction()}
      >
        ${this.config.icon
          ? createActionIcon(this.config.icon)
          : this.config.kind
            ? actionIcons[this.config.kind]()
            : null}
      </button>`,
      this,
    );
  }
}
