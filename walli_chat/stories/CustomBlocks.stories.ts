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
import {
  registerBlock,
  resolveBuiltInBlockDefinition,
  type WalliChatTokenizedBlockDefinition,
} from "../src/core/block-registry";
import { systemBlockDefinition } from "../src/core/blocks/system-block";
import { ruleBlockDefinition } from "../src/core/blocks/rule-block";
import { parseMarkdownBlocks, StreamingMarkdownParser } from "../src/core/md-parse";
import {
  createPreparedChatMessages,
  buildConversationFrame,
  materializeMessageBlocks,
} from "../src/core";
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

function roleCardDefinition(
  role?: string,
): WalliChatTokenizedBlockDefinition<string, string, { text: string; role: string }> {
  const label = role ?? "shared";
  return {
    name: "role-card",
    role,
    tokenizer: {
      tokenize(source) {
        const match = /^:::role-card\n([^\n]*)\n:::(?:\n|$)/.exec(source);
        return match ? { raw: match[0], data: `${label}:${match[1]}` } : undefined;
      },
    },
    measure: (_data, { role }) => ({ height: role === "user" ? 36 : 40 }),
    materialize: (text, { role }) => ({ text, role }),
    render: ({ data, role }) =>
      html`<div
        data-role-card=${`${role}:${data.text}`}
        data-materialized-role=${data.role}
        style="padding:8px;border:1px solid currentColor;border-radius:8px"
      >
        ${role}: ${data.text}
      </div>`,
  };
}

registerBlock(roleCardDefinition());
for (const role of ["user", "system", "tool"]) registerBlock(roleCardDefinition(role));

export const RoleScopedBlocks: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The same block name can have different tokenizers and renderers by message role. Role-specific registrations override the shared fallback. Custom roles use assistant message layout. Built-in blocks use the same registration API.",
      },
      source: {
        language: "ts",
        code: `import { registerBlock } from "@wallilabs/chat";
import { createNoticeMarkdown, noticeBlockDefinition } from "@wallilabs/chat-blocks";
import "@wallilabs/chat/theme.css";

registerBlock(noticeBlockDefinition); // Shared fallback.
const registration = registerBlock({
  ...noticeBlockDefinition,
  role: "tool", // Also accepts assistant, system, user, or another custom role.
  render(context) {
    console.log(context.role); // Actual message role.
    return noticeBlockDefinition.render(context);
  },
});

const chat = document.createElement("walli-chat");
chat.style.cssText = "display: block; height: 640px";
chat.messages = [
  {
    id: "tool-result",
    role: "tool",
    markdown: createNoticeMarkdown({ text: "Tool finished", variant: "success" }),
  },
];
document.body.append(chat);

// registration.unregister() restores the shared fallback.`,
      },
    },
  },
  render: () => {
    const messages: WalliChatMessage[] = ["assistant", "user", "system", "tool"].map((role) => ({
      id: `role-${role}`,
      role,
      markdown: ":::role-card\nhello\n:::",
      showActions: false,
    }));
    return html`<walli-chat
      style="display:block;height:640px;width:100%"
      .messages=${messages}
    ></walli-chat>`;
  },
  play: async ({ canvasElement }) => {
    const chat = canvasElement.querySelector<WalliChatElement>("walli-chat")!;
    await chat.updateComplete;
    await expect(parseMarkdownBlocks(":::role-card\nhello\n:::", false, "tool")[0]?.kind).toBe(
      "custom",
    );
    const cards = () =>
      [...chat.renderRoot.querySelectorAll("walli-custom-block-content")].map((element) =>
        element.shadowRoot?.querySelector<HTMLElement>("[data-role-card]"),
      );
    await waitFor(() =>
      expect(
        cards()
          .map((card) => card?.dataset.roleCard)
          .sort(),
      ).toEqual([
        "assistant:shared:hello",
        "system:system:hello",
        "tool:tool:hello",
        "user:user:hello",
      ]),
    );
    for (const card of cards())
      await expect(card?.dataset.materializedRole).toBe(card?.dataset.roleCard?.split(":")[0]);
    const toolRow = [...chat.renderRoot.querySelectorAll("walli-message")].find(
      (row) => row.message?.prepared.role === "tool",
    )!;
    await expect(toolRow.message?.prepared.role).toBe("tool");
    await expect(toolRow.message?.frame.actionHeight).toBe(0);
    await expect(toolRow.querySelector(".justify-start")).toBeTruthy();

    const isolated = registerBlock({
      ...roleCardDefinition("tool"),
      name: "tool-only",
      tokenizer: {
        tokenize(source: string) {
          return source.startsWith("!tool-only")
            ? { raw: "!tool-only", data: "tool-only" }
            : undefined;
        },
      },
    });
    const rule = registerBlock({
      ...ruleBlockDefinition,
      role: "tool",
      measure(block, context) {
        return {
          ...ruleBlockDefinition.measure(block, context),
          height: context.role === "tool" ? 37 : 99,
        };
      },
      render: ({ role, block }) =>
        html`<div data-role-rule=${role} style=${`height:${block.height}px`}>Tool rule</div>`,
    });
    try {
      await expect(parseMarkdownBlocks("!tool-only", false, "tool")[0]?.kind).toBe("custom");
      await expect(parseMarkdownBlocks("!tool-only", false, "assistant")[0]?.kind).not.toBe(
        "custom",
      );
      const nested = parseMarkdownBlocks("> :::role-card\n> hello\n> :::", false, "tool");
      await expect(nested[0]?.role).toBe("tool");
      await expect(nested[0]?.kind).toBe("custom");
      const parser = new StreamingMarkdownParser("tool");
      const stable = parser.parse(":::role-card\nhello\n:::\n\nFirst");
      const updated = parser.parse(":::role-card\nhello\n:::\n\nFirst second");
      await expect(updated[0]).toBe(stable[0]);
      await expect(updated[0]?.role).toBe("tool");
      const prepared = createPreparedChatMessages([
        { id: "rule-tool", role: "tool", markdown: "---" },
      ]);
      const frame = buildConversationFrame(prepared, 500);
      await expect(frame.messages[0]?.frame.blocks[0]?.height).toBe(37);
      await expect(materializeMessageBlocks(frame.messages[0]!).blocks[0]?.height).toBe(37);
      chat.insertMessagesAtBottom(
        [{ id: "rule-tool", role: "tool", markdown: "---", showActions: false }],
        { stick: true },
      );
      await waitFor(() =>
        expect(chat.renderRoot.querySelector('[data-role-rule="tool"]')).toBeTruthy(),
      );
      await expect(resolveBuiltInBlockDefinition("rule", "assistant")).toBe(ruleBlockDefinition);

      const first = registerBlock({ ...ruleBlockDefinition, role: "isolated-role" });
      const second = registerBlock({ ...ruleBlockDefinition, role: "isolated-role" });
      first.unregister();
      second.unregister();
      await expect(resolveBuiltInBlockDefinition("rule", "isolated-role")).toBe(
        ruleBlockDefinition,
      );
      const override = registerBlock(roleCardDefinition("assistant"));
      await expect(
        parseMarkdownBlocks(":::role-card\nhello\n:::", false, "assistant")[0],
      ).toMatchObject({ data: "assistant:hello" });
      override.unregister();
      await expect(
        parseMarkdownBlocks(":::role-card\nhello\n:::", false, "assistant")[0],
      ).toMatchObject({ data: "shared:hello" });

      let streamController!: ReadableStreamDefaultController<string>;
      const stream = new ReadableStream<string>({
        start(controller) {
          streamController = controller;
          controller.enqueue(
            `data: ${JSON.stringify({ type: "text-delta", delta: ":::role-card\nhello\n:::" })}\n\n`,
          );
        },
      });
      const insertion = chat.insertStreamingMessageAtBottom(stream, {
        messageId: "tool-stream",
        role: "tool",
        stickToBottom: true,
      });
      try {
        await waitFor(() => {
          const row = [...chat.renderRoot.querySelectorAll("walli-message")].find(
            (row) => row.message?.prepared.id === "tool-stream",
          );
          expect(row?.message?.prepared.streaming).toBe(true);
          expect(row?.message?.prepared.role).toBe("tool");
        });
      } finally {
        streamController.close();
        await insertion.finished;
      }
      await expect(chat.messages.at(-1)?.role).toBe("tool");
      await waitFor(() =>
        expect(cards().some((card) => card?.dataset.roleCard === "tool:tool:hello")).toBe(true),
      );
    } finally {
      isolated.unregister();
      rule.unregister();
    }
  },
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

export const SystemBlockOverride: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "System text uses the registered inline block for the system role. Override its preparation, measurement, or rendering without changing other roles.",
      },
      source: {
        language: "ts",
        code: `import { registerBlock, systemBlockDefinition } from "@wallilabs/chat";
import { html } from "lit";

const registration = registerBlock({
  ...systemBlockDefinition,
  render(context) {
    return html\`<div style="color: teal">\${systemBlockDefinition.render(context)}</div>\`;
  },
});

const chat = document.createElement("walli-chat");
chat.style.cssText = "display: block; height: 320px";
chat.messages = [{ id: "system", role: "system", markdown: "Conversation started" }];
document.body.append(chat);

// registration.unregister() restores the default system block.`,
      },
    },
  },
  render: () =>
    renderBlocks([{ id: "system-default", role: "system", markdown: "Conversation started" }]),
  play: async ({ canvasElement }) => {
    const chat = canvasElement.querySelector<WalliChatElement>("walli-chat")!;
    const original = resolveBuiltInBlockDefinition("inline", "assistant");
    await expect(resolveBuiltInBlockDefinition("inline", "system")).toBe(systemBlockDefinition);
    const registration = registerBlock({
      ...systemBlockDefinition,
      render(context) {
        return html`<div data-system-override=${context.role} style="color:teal">
          ${systemBlockDefinition.render(context)}
        </div>`;
      },
    });
    try {
      chat.messages = [{ id: "system-override", role: "system", markdown: "Conversation started" }];
      await waitFor(() =>
        expect(chat.renderRoot.querySelector('[data-system-override="system"]')).toBeTruthy(),
      );
      await expect(resolveBuiltInBlockDefinition("inline", "assistant")).toBe(original);
    } finally {
      registration.unregister();
    }
    await expect(resolveBuiltInBlockDefinition("inline", "system")).toBe(systemBlockDefinition);
    chat.messages = [{ id: "system-restored", role: "system", markdown: "Conversation started" }];
    await waitFor(() => expect(chat.renderRoot.querySelector("[data-system-override]")).toBeNull());
  },
};

registerBlock({
  ...peopleBlockDefinition,
  meta: { avatarUrl: "/demo-landscape-coast.jpg", nickname: "guangzhi" },
});

export const People: Story = {
  parameters: {
    docs: {
      source: {
        language: "ts",
        code: `import { registerBlock } from "@wallilabs/chat";
import { peopleBlockDefinition } from "@wallilabs/chat-blocks";
import "@wallilabs/chat/theme.css";

// Configure the block's default identity from outside.
registerBlock({
  ...peopleBlockDefinition,
  meta: { avatarUrl: "/avatar.jpg", nickname: "guangzhi" },
});

const chat = document.createElement("walli-chat");
chat.style.cssText = "display: block; height: 380px";
chat.messages = [
  { id: "people-default", role: "people", markdown: "Working towards the same goal." },
  {
    id: "people-override",
    role: "people",
    markdown: "Together!",
    meta: { avatarUrl: "/alex.jpg", nickname: "Alex" },
  },
];
document.body.append(chat);`,
      },
    },
  },
  render: () =>
    html`<walli-chat
      style="display:block;width:420px;height:380px"
      .messages=${[
        { id: "people-default", role: "people", markdown: "在这一点上，我们目标出奇的一致" },
        {
          id: "people-override",
          role: "people",
          markdown: "众志成城",
          meta: { avatarUrl: "/demo-landscape-lake.jpg", nickname: "Alex" },
        },
        { id: "people-short", role: "people", markdown: "fighting" },
      ]}
    ></walli-chat>`,
  play: async ({ canvasElement }) => {
    const chat = canvasElement.querySelector<WalliChatElement>("walli-chat")!;
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
      ).toEqual(["guangzhi", "Alex", "guangzhi"]),
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
    chat.style.height = "380px";
    chat.messages = originalMessages;
  },
};
