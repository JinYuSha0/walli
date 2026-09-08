import { getSpace, getResponsiveValue } from "../styles/config";
import { prepareMarkdownContent } from "../index";
import type { WalliChatRoleBlockDefinition } from "../block-registry";
import type { AssistantBlockMeta, WalliChatMessageRole } from "../../types";
import { html } from "lit";

export type { AssistantBlockMeta } from "../../types";

type PreparedAssistantText = ReturnType<typeof prepareMarkdownContent>;
const font = '400 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
function getContentLeft(): number {
  return getSpace(getResponsiveValue({ base: 11, sm: 12.5 }));
}
function getPadding(showBubble: boolean) {
  return { x: showBubble ? getSpace(3) : 0, y: showBubble ? getSpace(2) : 0 };
}

export function createAssistantBlockDefinition(role: WalliChatMessageRole = "assistant") {
  const hasBubble = (meta: unknown) =>
    (meta as AssistantBlockMeta | undefined)?.showBubble ?? role !== "assistant";
  const hasIdentity = (meta: unknown) => {
    const identity = meta as AssistantBlockMeta | undefined;
    return (
      role !== "assistant" ||
      identity?.nickname !== undefined ||
      identity?.avatarUrl !== undefined ||
      hasBubble(meta)
    );
  };
  return {
    name: role,
    role,
    scope: "message",
    meta:
      role === "assistant"
        ? undefined
        : ({ avatarUrl: "", nickname: "" } satisfies AssistantBlockMeta),
    getContentInsetX(meta) {
      return hasIdentity(meta) ? getContentLeft() + getPadding(hasBubble(meta)).x : 0;
    },
    prepare(markdown) {
      return prepareMarkdownContent(markdown, { role });
    },
    measure(data, { availableWidth, meta }) {
      if (!hasIdentity(meta))
        return { width: availableWidth, height: data.layout(availableWidth).height };
      const padding = getPadding(hasBubble(meta));
      const content = data.layout(availableWidth - getContentLeft() - padding.x * 2);
      return {
        width: availableWidth,
        height: 22 + content.height + padding.y * 2,
      };
    },
    render({ data, meta, width, ctx, messageId }) {
      if (!hasIdentity(meta)) return html`${data.layout(width).render(ctx, messageId)}`;
      const padding = getPadding(hasBubble(meta));
      const identity = (meta ?? {}) as Partial<AssistantBlockMeta>;
      const showBubble = hasBubble(meta);
      const nickname = identity.nickname?.trim() ?? "";
      const initial = Array.from(nickname)[0] ?? "";
      const contentLeft = getContentLeft();
      const content = data.layout(width - contentLeft - padding.x * 2);
      const bubbleWidth = content.width + padding.x * 2;
      return html`<div class="relative h-full w-full" style=${`font:${font}`}>
        ${
          identity.avatarUrl?.trim()
            ? html`<img
                class="absolute left-0 top-0 h-9 w-9 rounded-md object-cover [background:var(--walli-people-avatar-background,var(--walli-secondary,#ececed))]"
                src=${identity.avatarUrl}
                alt=""
              />`
            : html`<span
                data-people-avatar-fallback
                class="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-md [background:var(--walli-people-avatar-background,var(--walli-secondary,#ececed))] text-sm [color:var(--walli-people-avatar-color,var(--walli-secondary-foreground,#52525b))]"
                aria-hidden="true"
                >${initial}</span
              >`
        }
        <div
          data-people-nickname
          style=${`left:${contentLeft}px`}
          class="absolute right-0 top-0 h-[18px] truncate font-sans text-xs leading-[18px] [color:var(--walli-people-nickname-color,var(--walli-muted-foreground,#71717a))]"
        >
          ${nickname}
        </div>
        <div
          data-people-bubble
          class=${
            showBubble
              ? "absolute top-[22px] rounded-md [background:var(--walli-people-background,var(--walli-secondary,#eeeef0))] [color:var(--walli-people-color,var(--walli-secondary-foreground,#161618))]"
              : "absolute top-[22px] bg-transparent [color:var(--walli-foreground)]"
          }
          style=${`left:${contentLeft}px;width:${bubbleWidth}px;height:${content.height + padding.y * 2}px`}
        >
          ${
            showBubble
              ? html`<span
                  aria-hidden="true"
                  class="absolute -left-[5px] top-3 h-2.5 w-2.5 [transform:rotate(45deg)] bg-inherit"
                ></span>`
              : null
          }
          <div
            data-people-markdown
            class="absolute"
            style=${`left:${padding.x}px;top:${padding.y}px;width:${content.width}px;height:${content.height}px`}
          >
            ${content.render(ctx, messageId)}
          </div>
        </div>
      </div>`;
    },
  } satisfies WalliChatRoleBlockDefinition<PreparedAssistantText>;
}

export const assistantBlockDefinition = createAssistantBlockDefinition();
