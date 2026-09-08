import type { Meta, StoryObj } from "@storybook/web-components-vite";
import type {
  ConfirmationCardData,
  ConfirmationCardField,
  ConfirmationCardSubmission,
} from "@wallilabs/chat-blocks";
import {
  confirmationCardBlockDefinition,
  createConfirmationCardMarkdown,
  createNoticeMarkdown,
  createRecommendedRepliesMarkdown,
  noticeBlockDefinition,
  peopleBlockDefinition,
  recommendedRepliesBlockDefinition,
} from "@wallilabs/chat-blocks";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";
import { expect, waitFor } from "storybook/test";
import type { WalliChatAction, WalliChatMessage } from "../src/types";
import { registerBlock } from "../src/core/block-registry";
import { assistantBlockDefinition } from "../src/core/blocks/assistant-block";
import { parseMarkdownBlocks, StreamingMarkdownParser } from "../src/core/md-parse";
import { createPreparedChatMessages } from "../src/core";
import type { WalliChatElement } from "../src/web-components/walli-chat";
import "../src/web-components/walli-chat";
import "../src/web-components/walli-chat-composer";

registerBlock(recommendedRepliesBlockDefinition);
registerBlock(confirmationCardBlockDefinition);
registerBlock(noticeBlockDefinition);

export const confirmationCardData: ConfirmationCardData = {
  title: "Confirm appointment",
  fields: [
    {
      id: "contact",
      label: "Contact",
      type: "text",
      required: true,
      minLength: 2,
      maxLength: 30,
      value: "Walli user",
      errorMessages: {
        required: "Enter a contact name",
        minLength: "Contact name must contain at least 2 characters",
        maxLength: "Contact name cannot exceed 30 characters",
      },
    },
    {
      id: "quantity",
      label: "Quantity",
      type: "number",
      required: true,
      min: 1,
      max: 100,
      decimals: 0,
      value: 2,
      errorMessages: {
        min: "Quantity must be at least 1",
        max: "Quantity cannot exceed 100",
        decimals: "Quantity must be a whole number",
      },
    },
    {
      id: "appointmentAt",
      label: "Appointment time",
      type: "time",
      format: "YYYY-MM-DD HH:mm",
      required: true,
      min: "now",
      errorMessages: {
        required: "Choose an appointment time",
        min: "Appointment time cannot be in the past",
      },
    },
    {
      id: "createdDate",
      label: "Created date",
      type: "time",
      format: "YYYY-MM-DD",
      editable: false,
      value: "2026-08-27",
    },
  ],
  action: { id: "confirm-appointment", label: "Confirm" },
};

export const recommendedRepliesMessage: WalliChatMessage = {
  id: "storybook-recommended-replies",
  role: "assistant",
  markdown: [
    "What would you like to explore next?",
    "",
    createRecommendedRepliesMarkdown([
      "Tell me more about custom blocks",
      "Show me a complete recommended replies example",
      "How do I disable interaction while streaming?",
    ]),
  ].join("\n"),
  showActions: false,
};

export const confirmationCardMessage: WalliChatMessage = {
  id: "storybook-confirmation-card",
  role: "assistant",
  markdown: createConfirmationCardMarkdown(confirmationCardData),
  meta: confirmationCardData,
  showActions: false,
};

export const noticeMessages: WalliChatMessage[] = [
  {
    id: "storybook-notice-info",
    role: "assistant",
    markdown: createNoticeMarkdown({ text: "Here is some helpful information.", variant: "info" }),
    showActions: false,
  },
  {
    id: "storybook-notice-success",
    role: "assistant",
    markdown: createNoticeMarkdown({
      text: "The operation completed successfully.",
      variant: "success",
    }),
    showActions: false,
  },
  {
    id: "storybook-notice-error",
    role: "assistant",
    markdown: createNoticeMarkdown({
      text: "Submission failed. Check your input and try again.",
      variant: "error",
    }),
    showActions: false,
  },
];

type Args = {
  messages: WalliChatMessage[];
};

const webComponentsSource = `import { registerBlock } from "@wallilabs/chat";
import {
  confirmationCardBlockDefinition,
  createConfirmationCardMarkdown,
  createNoticeMarkdown,
  createRecommendedRepliesMarkdown,
  noticeBlockDefinition,
  recommendedRepliesBlockDefinition,
} from "@wallilabs/chat-blocks";
import "@wallilabs/chat/theme.css";
import "@wallilabs/chat-blocks/theme.css";

registerBlock(recommendedRepliesBlockDefinition);
registerBlock(confirmationCardBlockDefinition);
registerBlock(noticeBlockDefinition);

const confirmation = {
  title: "Confirm appointment",
  fields: [
    { id: "contact", label: "Contact", type: "text", required: true },
    { id: "quantity", label: "Quantity", type: "number", min: 1, decimals: 0 },
    {
      id: "appointmentAt",
      label: "Appointment time",
      type: "time",
      format: "YYYY-MM-DD HH:mm",
      min: "now",
    },
  ],
  action: { id: "confirm-appointment", label: "Confirm" },
};

const chat = document.querySelector("walli-chat");
chat.messages = [
  {
    id: "recommended",
    role: "assistant",
    markdown: createRecommendedRepliesMarkdown(["Tell me more", "Show me an example"]),
  },
  {
    id: "confirmation",
    role: "assistant",
    markdown: createConfirmationCardMarkdown(confirmation),
    meta: confirmation,
  },
  {
    id: "notice-info",
    role: "assistant",
    markdown: createNoticeMarkdown({ text: "Here is some helpful information.", variant: "info" }),
  },
  {
    id: "notice-success",
    role: "assistant",
    markdown: createNoticeMarkdown({ text: "The operation completed successfully.", variant: "success" }),
  },
  {
    id: "notice-error",
    role: "assistant",
    markdown: createNoticeMarkdown({ text: "The operation failed.", variant: "error" }),
  },
];

chat.onAction = async ({ name, data, messageId }) => {
  if (name !== "confirmation-card") return;
  await submitConfirmation(data);
  chat.insertMessagesAtBottom([{
    id: crypto.randomUUID(),
    role: "assistant",
    markdown: createNoticeMarkdown({ text: "Appointment submitted successfully.", variant: "success" }),
  }]);
};`;

const recommendedRepliesSource = `import { registerBlock } from "@wallilabs/chat";
import {
  createRecommendedRepliesMarkdown,
  recommendedRepliesBlockDefinition,
} from "@wallilabs/chat-blocks";
import "@wallilabs/chat/theme.css";
import "@wallilabs/chat-blocks/theme.css";

registerBlock(recommendedRepliesBlockDefinition);

const chat = document.querySelector("walli-chat");
chat.messages = [{
  id: "recommended-replies",
  role: "assistant",
  markdown: [
    "What would you like to explore next?",
    "",
    createRecommendedRepliesMarkdown([
      "Tell me more about custom blocks",
      "Show me a complete recommended replies example",
      "How do I disable interaction while streaming?",
    ]),
  ].join("\\n"),
  showActions: false,
}];`;

const confirmationCardSource = `import { registerBlock } from "@wallilabs/chat";
import {
  confirmationCardBlockDefinition,
  createConfirmationCardMarkdown,
} from "@wallilabs/chat-blocks";
import "@wallilabs/chat/theme.css";
import "@wallilabs/chat-blocks/theme.css";

registerBlock(confirmationCardBlockDefinition);

const confirmation = {
  title: "Confirm appointment",
  fields: [
    {
      id: "contact",
      label: "Contact",
      type: "text",
      required: true,
      minLength: 2,
      maxLength: 30,
      value: "Walli user",
      errorMessages: {
        required: "Enter a contact name",
        minLength: "Contact name must contain at least 2 characters",
        maxLength: "Contact name cannot exceed 30 characters",
      },
    },
    {
      id: "quantity",
      label: "Quantity",
      type: "number",
      min: 1,
      max: 100,
      decimals: 0,
      value: 2,
      errorMessages: {
        min: "Quantity must be at least 1",
        max: "Quantity cannot exceed 100",
        decimals: "Quantity must be a whole number",
      },
    },
    {
      id: "appointmentAt",
      label: "Appointment time",
      type: "time",
      format: "YYYY-MM-DD HH:mm",
      required: true,
      min: "now",
      errorMessages: {
        required: "Choose an appointment time",
        min: "Appointment time cannot be in the past",
      },
    },
  ],
  action: { id: "confirm-appointment", label: "Confirm" },
};

const chat = document.querySelector("walli-chat");
chat.messages = [{
  id: "confirmation-card",
  role: "assistant",
  markdown: createConfirmationCardMarkdown(confirmation),
  meta: confirmation,
  showActions: false,
}];

chat.onAction = async ({ name, data }) => {
  if (name === "confirmation-card") await submitConfirmation(data);
};`;

const noticesSource = `import { registerBlock } from "@wallilabs/chat";
import { createNoticeMarkdown, noticeBlockDefinition } from "@wallilabs/chat-blocks";
import "@wallilabs/chat/theme.css";
import "@wallilabs/chat-blocks/theme.css";

registerBlock(noticeBlockDefinition);

const chat = document.querySelector("walli-chat");
chat.messages = [
  { text: "Here is some helpful information.", variant: "info" },
  { text: "The operation completed successfully.", variant: "success" },
  { text: "Submission failed. Check your input and try again.", variant: "error" },
].map(({ text, variant }) => ({
  id: \`notice-\${variant}\`,
  role: "assistant",
  markdown: createNoticeMarkdown({ text, variant }),
  showActions: false,
}));`;

function renderBlocks(messages: WalliChatMessage[]) {
  let chat: WalliChatElement | undefined;

  return html`<div style="height:720px;width:100%;background:var(--walli-background)">
    <walli-chat
      ${ref((element) => {
        if (element?.localName === "walli-chat") chat = element as WalliChatElement;
      })}
      style="display:block;height:100%;width:100%"
      .messages=${messages}
      .onAction=${async (action: WalliChatAction) => {
        if (action.type !== "block") return;
        const { data, messageId, name } = action;
        if (!chat || name !== "confirmation-card") return;
        const submission = data as ConfirmationCardSubmission;
        const message = chat.messages.find((item) => item.id === messageId);
        const cardData = message?.meta as ConfirmationCardData | undefined;
        if (!cardData) return;

        const fields = cardData.fields.map<ConfirmationCardField>(
          (field) =>
            ({
              ...field,
              editable: false,
              value: submission.fields[field.id] ?? field.value,
            }) as ConfirmationCardField,
        );
        const confirmedData: ConfirmationCardData = {
          ...cardData,
          action: { ...cardData.action, disabled: true, label: "Submitted" },
          fields,
        };
        chat.replaceMessage(messageId, {
          markdown: createConfirmationCardMarkdown(confirmedData),
          meta: confirmedData,
        });
        chat.insertMessagesAtBottom(
          [
            {
              id: `storybook-confirmation-success-${crypto.randomUUID()}`,
              role: "assistant",
              markdown: createNoticeMarkdown({
                text: "Appointment submitted successfully.",
                variant: "success",
              }),
              showActions: false,
            },
          ],
          { stick: true },
        );
      }}
    >
      <walli-chat-composer
        slot="composer"
        placeholder="Choose a reply or type a message"
        .onSubmit=${async (markdown: string) => {
          if (!chat || !markdown) return;
          chat.insertMessagesAtBottom(
            [{ id: `storybook-user-${crypto.randomUUID()}`, role: "user", markdown }],
            { stick: true },
          );
        }}
      ></walli-chat-composer>
    </walli-chat>
  </div>`;
}

const meta: Meta<Args> = {
  title: "Components/Custom Blocks",
  excludeStories: /^[a-z]/,
  tags: ["autodocs"],
  argTypes: {
    messages: { table: { disable: true } },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Custom blocks provided by @wallilabs/chat-blocks, rendered through the production walli-chat component.",
      },
    },
  },
  args: {
    messages: [recommendedRepliesMessage, confirmationCardMessage, ...noticeMessages],
  },
  render: ({ messages }) => renderBlocks(messages),
};

export default meta;
type Story = StoryObj<Args>;

export const AllBlocks: Story = {
  play: assertBlockMessages,
  parameters: { docs: { source: { code: webComponentsSource, language: "ts" } } },
};

export const RecommendedReplies: Story = {
  args: { messages: [recommendedRepliesMessage] },
  play: assertBlockMessages,
  parameters: { docs: { source: { code: recommendedRepliesSource, language: "ts" } } },
};

export const ConfirmationCard: Story = {
  args: { messages: [confirmationCardMessage] },
  play: assertBlockMessages,
  parameters: { docs: { source: { code: confirmationCardSource, language: "ts" } } },
};

export const Notices: Story = {
  args: { messages: noticeMessages },
  play: assertBlockMessages,
  parameters: { docs: { source: { code: noticesSource, language: "ts" } } },
};

async function assertBlockMessages({
  args,
  canvasElement,
}: {
  args: Args;
  canvasElement: HTMLElement;
}): Promise<void> {
  const chat = canvasElement.querySelector<WalliChatElement>("walli-chat");
  await expect(chat).toBeTruthy();
  await chat!.updateComplete;
  await expect(chat!.messages.map(({ id }) => id)).toEqual(args.messages.map(({ id }) => id));
  await waitFor(() =>
    expect(chat!.renderRoot.querySelectorAll("walli-message").length).toBeGreaterThan(0),
  );
  await expect(chat!.renderRoot.querySelector("walli-custom-block")).toBeTruthy();
}

export const roleMessageMeta = { avatarUrl: "/demo-landscape-coast.jpg", nickname: "Oliver" };
export const roleMessageMessages: WalliChatMessage[] = [
  {
    id: "people-default",
    role: "people",
    markdown: "I found a quiet coffee shop near the station. Shall we meet there tomorrow?",
  },
  {
    id: "people-override",
    role: "people",
    markdown: "Sounds great! I will bring my notebook.",
    meta: { avatarUrl: "/demo-landscape-lake.jpg", nickname: "Emma" },
  },
  { id: "people-short", role: "people", markdown: "See you there!" },
];

registerBlock({ ...peopleBlockDefinition, role: "people", meta: roleMessageMeta });

export const RoleMessageBlock: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Registers a whole-message layout for a specific role using scope: "message". This example uses the people role with default avatar and nickname metadata that individual messages can override.',
      },
      source: {
        language: "ts",
        code: `import { registerBlock } from "@wallilabs/chat";
import { peopleBlockDefinition } from "@wallilabs/chat-blocks";
import "@wallilabs/chat/theme.css";

// Configure the block's default identity from outside.
registerBlock({
  ...peopleBlockDefinition,
  role: "people", // Register the message block for this role.
  meta: {
    avatarUrl: ${JSON.stringify(roleMessageMeta.avatarUrl)},
    nickname: ${JSON.stringify(roleMessageMeta.nickname)},
  },
});

const chat = document.createElement("walli-chat");
chat.style.cssText = "display:block;width:100%;height:380px";
chat.messages = ${JSON.stringify(roleMessageMessages, null, 2)};
document.body.append(chat);`,
      },
    },
  },
  render: () =>
    html`<walli-chat
      style="display:block;width:100%;height:380px"
      .messages=${roleMessageMessages}
    ></walli-chat>`,
  play: async ({ canvasElement }) => {
    const chat = canvasElement.querySelector<WalliChatElement>("walli-chat")!;
    const nestedList = parseMarkdownBlocks("- Parent\n  - Child\n  - Sibling\n- Next");
    await expect(nestedList.slice(1).map((block) => block.marginTop)).toEqual([4, 4, 4]);
    const quote = parseMarkdownBlocks("> First paragraph\n>\n> Second paragraph");
    await expect(quote[1]?.marginTop).toBe(8);
    const separatedLists = parseMarkdownBlocks("- Unordered\n\n1. Ordered");
    await expect(separatedLists[1]?.marginTop).toBe(12);
    const listAndQuote = parseMarkdownBlocks(
      "1. Ordered\n\n> First paragraph\n>\n> Second paragraph",
    );
    await expect(listAndQuote.slice(1).map((block) => block.marginTop)).toEqual([12, 8]);
    const separator = parseMarkdownBlocks("Before\n\n---\n\nAfter");
    await expect(separator[1]).toMatchObject({ kind: "rule", height: 1, marginTop: 12 });
    await expect(separator[2]?.marginTop).toBe(12);

    await expect(parseMarkdownBlocks("**Hello**", false, "people")[0]?.kind).toBe("inline");
    const prepared = createPreparedChatMessages([
      { id: "role-wrapper", role: "people", markdown: "**Hello**" },
    ]);
    await expect(prepared[0]?.blocks).toHaveLength(1);
    await expect(prepared[0]?.blocks[0]).toMatchObject({
      kind: "custom",
      definition: { name: "people", scope: "message" },
    });
    const streaming = new StreamingMarkdownParser("people").parse("**Hello**");
    await expect(streaming).toHaveLength(1);
    await expect(streaming[0]).toMatchObject({
      kind: "custom",
      role: "people",
      definition: { scope: "message" },
    });

    const roots = () =>
      [...chat.renderRoot.querySelectorAll("walli-custom-block-content")].map(
        (element) => element.shadowRoot!,
      );
    await waitFor(() =>
      expect(
        roots().map((root) => root.querySelector("[data-people-nickname]")?.textContent?.trim()),
      ).toEqual(["Oliver", "Emma", "Oliver"]),
    );
    await expect(roots()[0]!.querySelector("img")?.getAttribute("src")).toBe(
      "/demo-landscape-coast.jpg",
    );
    await expect(roots()[1]!.querySelector("img")?.getAttribute("src")).toBe(
      "/demo-landscape-lake.jpg",
    );
    const firstBubble = roots()[0]!.querySelector("[data-people-bubble]")!;
    const shortBubble = roots()[2]!.querySelector("[data-people-bubble]")!;
    await expect(getComputedStyle(firstBubble.querySelector("[aria-hidden]")!).transform).not.toBe(
      "none",
    );
    await expect(getComputedStyle(firstBubble).position).toBe("absolute");
    await expect(getComputedStyle(firstBubble).top).toBe("22px");
    await expect(getComputedStyle(firstBubble).backgroundColor).toBe("rgb(238, 238, 240)");
    const nickname = roots()[0]!.querySelector("[data-people-nickname]")!;
    await expect(firstBubble.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      nickname.getBoundingClientRect().bottom,
    );

    await expect(firstBubble.getBoundingClientRect().width).toBeGreaterThan(
      shortBubble.getBoundingClientRect().width,
    );
    chat.style.width = "240px";
    await waitFor(() =>
      expect(roots()[0]!.querySelectorAll("walli-inline-block .flex.w-max").length).toBeGreaterThan(
        1,
      ),
    );
    const root = roots()[0]!;
    const bubble = root.querySelector("[data-people-bubble]")!.getBoundingClientRect();
    for (const line of root.querySelectorAll("walli-inline-block .flex.w-max")) {
      expect(line.getBoundingClientRect().right).toBeLessThanOrEqual(bubble.right + 1);
      expect(line.getBoundingClientRect().bottom).toBeLessThanOrEqual(bubble.bottom + 1);
    }
    chat.style.width = "420px";
    const originalMessages = chat.messages;
    chat.messages = [
      { id: "people-initial", role: "people", markdown: "Hello", meta: { nickname: "小明" } },
      { id: "people-empty", role: "people", markdown: "Hello", meta: {} },
    ];
    await waitFor(() =>
      expect(
        roots().map((root) =>
          root.querySelector("[data-people-avatar-fallback]")?.textContent?.trim(),
        ),
      ).toEqual(["小", ""]),
    );
    await expect(
      getComputedStyle(roots()[1]!.querySelector("[data-people-avatar-fallback]")!).backgroundColor,
    ).toBe("rgb(236, 236, 237)");
    const themeRoot = document.documentElement;
    const wasDark = themeRoot.classList.contains("dark");
    try {
      themeRoot.classList.add("dark");
      const darkRoot = roots()[0]!;
      const darkBubble = darkRoot.querySelector("[data-people-bubble]")!;
      await expect(getComputedStyle(darkBubble).backgroundColor).toBe("rgb(39, 39, 42)");
      await expect(getComputedStyle(darkBubble).color).toBe("rgb(244, 244, 245)");
      await expect(
        getComputedStyle(darkBubble.querySelector("[aria-hidden]")!).backgroundColor,
      ).toBe("rgb(39, 39, 42)");
      await expect(getComputedStyle(darkRoot.querySelector("[data-people-nickname]")!).color).toBe(
        "rgb(161, 161, 170)",
      );
      await expect(
        getComputedStyle(darkRoot.querySelector("[data-people-avatar-fallback]")!).backgroundColor,
      ).toBe("rgb(63, 63, 70)");
    } finally {
      themeRoot.classList.toggle("dark", wasDark);
    }
    chat.style.height = "1600px";
    const longText = "People and assistant messages share the same width limit. ".repeat(4);
    chat.messages = [
      { id: "width-people", role: "people", markdown: longText },
      { id: "width-assistant", role: "assistant", markdown: longText },
    ];
    for (const width of [420, 280]) {
      chat.style.width = `${width}px`;
      await waitFor(() => {
        const rows = [...chat.renderRoot.querySelectorAll("walli-message")];
        const people = rows.find((row) => row.message?.prepared.id === "width-people");
        const assistant = rows.find((row) => row.message?.prepared.id === "width-assistant");
        expect(people?.message?.frame.frameWidth).toBeGreaterThan(0);
        expect(people?.message?.frame.frameWidth).toBe(assistant?.message?.frame.frameWidth);
        expect(people?.message?.frame.layoutContentWidth).toBe(
          assistant?.message?.frame.layoutContentWidth,
        );
        const bubble = people
          ?.querySelector("walli-custom-block-content")
          ?.shadowRoot?.querySelector("[data-people-bubble]");
        const assistantBubble = assistant?.querySelector(".message-bubble");
        expect(bubble).toBeTruthy();
        expect(bubble!.getBoundingClientRect().right).toBeLessThanOrEqual(
          assistantBubble!.getBoundingClientRect().right + 1,
        );
      });
    }
    chat.style.width = "420px";
    chat.style.height = "380px";

    chat.style.height = "1400px";
    chat.messages = [
      {
        id: "people-markdown",
        meta: { nickname: "Markdown", showBubble: false },
        role: "people",
        markdown: [
          "## Markdown in people messages",
          "**Bold** and *italic*, with a [link](https://example.com).",
          "",
          "- First item",
          "- Second item",
          "",
          "> A quoted message",
          "",
          "```ts",
          "const message = 'hello';",
          "```",
          "",
          "| Name | Status |",
          "| --- | --- |",
          "| People | Ready |",
          "",
          "![Coast](/demo-landscape-coast.jpg)",
          "",
          ":::notice info",
          "Nested custom block",
          ":::",
        ].join("\n"),
      },
    ];
    await waitFor(() => {
      const content = roots()[0]!.querySelector("[data-people-markdown]")!;
      const wrapper = roots()[0]!.querySelector("[data-people-bubble]")!;
      expect(getComputedStyle(wrapper).backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(wrapper.querySelector(":scope > [aria-hidden]")).toBeNull();
      expect(content.querySelector("walli-code-block")).toBeTruthy();
      const copyButton = content.querySelector('walli-code-block button[aria-label="Copy code"]');
      expect(copyButton?.querySelector("svg")).toBeTruthy();
      const keyword = content.querySelector("walli-code-block .token.keyword");
      expect(keyword).toBeTruthy();
      expect(getComputedStyle(keyword!).color).toBe("rgb(0, 119, 170)");
      const codeString = content.querySelector("walli-code-block .token.string");
      expect(codeString).toBeTruthy();
      expect(getComputedStyle(codeString!).color).toBe("rgb(102, 153, 0)");
      expect(content.querySelector("walli-table-block")).toBeTruthy();
      const table = content.querySelector("walli-table-block")!;
      const cells = [...table.querySelectorAll<HTMLElement>(".box-border")];
      const firstCell = cells[0]!;
      const lastCell = cells[1]!;
      const firstLine = firstCell.querySelector<HTMLElement>(".flex")!;
      const lastLine = lastCell.querySelector<HTMLElement>(".flex")!;
      expect(
        firstLine.getBoundingClientRect().left - firstCell.getBoundingClientRect().left,
      ).toBeGreaterThan(0);
      expect(
        lastCell.getBoundingClientRect().right - lastLine.getBoundingClientRect().right,
      ).toBeGreaterThan(0);

      expect(content.querySelector("walli-image-block")).toBeTruthy();
      expect(content.querySelector('a[href^="https://example.com"]')).toBeTruthy();
      expect(content.querySelector('walli-custom-block[data-block="notice"]')).toBeTruthy();
      expect(content.querySelector('walli-custom-block[data-block="people"]')).toBeNull();
      const bubble = roots()[0]!.querySelector("[data-people-bubble]")!.getBoundingClientRect();
      expect(content.getBoundingClientRect().bottom).toBeLessThanOrEqual(bubble.bottom);
    });
    chat.locales = { copyCode: "复制代码" };
    await waitFor(() =>
      expect(roots()[0]!.querySelector('button[aria-label="复制代码"]')).toBeTruthy(),
    );
    chat.locales = {};
    await waitFor(() =>
      expect(roots()[0]!.querySelector('button[aria-label="Copy code"]')).toBeTruthy(),
    );
    chat.messages = [
      {
        id: "assistant-identity",
        role: "assistant",
        meta: { nickname: "Alex", avatarUrl: "/demo-landscape-coast.jpg" },
        markdown: "**Shared assistant layout**",
      },
    ];
    await waitFor(() => {
      const root = roots()[0]!;
      expect(root.querySelector("[data-people-nickname]")?.textContent?.trim()).toBe("Alex");
      expect(root.querySelector("img")?.getAttribute("src")).toBe("/demo-landscape-coast.jpg");
      expect(root.querySelector("[data-people-markdown]")?.textContent).toContain(
        "Shared assistant layout",
      );
      expect(getComputedStyle(root.querySelector("[data-people-bubble]")!).backgroundColor).toBe(
        "rgba(0, 0, 0, 0)",
      );
    });
    const registration = registerBlock({
      ...assistantBlockDefinition,
      meta: { nickname: "Default assistant", showBubble: true },
    });
    try {
      chat.messages = [{ id: "assistant-default-meta", role: "assistant", markdown: "Hello" }];
      await waitFor(() => {
        const root = roots()[0]!;
        expect(root.querySelector("[data-people-nickname]")?.textContent?.trim()).toBe(
          "Default assistant",
        );
        expect(
          getComputedStyle(root.querySelector("[data-people-bubble]")!).backgroundColor,
        ).not.toBe("rgba(0, 0, 0, 0)");
        expect(root.querySelector("[data-people-markdown]")?.getAttribute("style")).toContain(
          "left:12px;top:8px",
        );
      });
    } finally {
      registration.unregister();
    }
    chat.style.height = "380px";
    chat.style.width = "100%";
    chat.messages = originalMessages;
  },
};
