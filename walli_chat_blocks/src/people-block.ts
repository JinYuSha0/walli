import { prepareMarkdownContent, type WalliChatRoleBlockDefinition } from "@wallilabs/chat";
import { html } from "lit";
import { blockBaseStyles } from "./block-theme.js";
import walliChatBlocksUnoCss from "virtual:walli-chat-blocks-uno-styles";

export type PeopleBlockMeta = {
  avatarUrl: string;
  nickname: string;
  showBubble?: boolean;
};

type PreparedPeopleText = ReturnType<typeof prepareMarkdownContent>;
const font = '400 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const contentLeft = 50;
const padding = 12;

export const peopleBlockDefinition = {
  name: "people",
  role: "people",
  scope: "message",
  meta: { avatarUrl: "", nickname: "" } satisfies PeopleBlockMeta,
  styles: [walliChatBlocksUnoCss, blockBaseStyles],
  prepare(markdown) {
    return prepareMarkdownContent(markdown, { role: "people" });
  },
  measure(data, { availableWidth }) {
    const content = data.layout(availableWidth - contentLeft - padding * 2);
    return { width: availableWidth, height: 22 + content.height + 16 };
  },
  render({ data, meta, width, ctx, messageId }) {
    const identity = (meta ?? {}) as Partial<PeopleBlockMeta>;
    const showBubble = identity.showBubble !== false;
    const nickname = identity.nickname?.trim() ?? "";
    const initial = Array.from(nickname)[0] ?? "";
    const content = data.layout(width - contentLeft - padding * 2);
    const bubbleWidth = content.width + padding * 2;
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
        class="absolute left-[50px] right-0 top-0 h-[18px] truncate font-sans text-xs leading-[18px] [color:var(--walli-people-nickname-color,var(--walli-muted-foreground,#71717a))]"
      >
        ${nickname}
      </div>
      <div
        data-people-bubble
        class=${
          showBubble
            ? "absolute left-[50px] top-[22px] rounded-md [background:var(--walli-people-background,var(--walli-secondary,#eeeef0))] [color:var(--walli-people-color,var(--walli-secondary-foreground,#161618))]"
            : "absolute left-[50px] top-[22px] bg-transparent [color:var(--walli-foreground)]"
        }
        style=${`width:${bubbleWidth}px;height:${content.height + 16}px`}
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
          class="absolute left-3 top-2"
          style=${`width:${content.width}px;height:${content.height}px`}
        >
          ${content.render(ctx, messageId)}
        </div>
      </div>
    </div>`;
  },
} satisfies WalliChatRoleBlockDefinition<PreparedPeopleText>;
