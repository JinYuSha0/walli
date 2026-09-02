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
  recommendedRepliesBlockDefinition,
} from "@wallilabs/chat-blocks";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";
import { expect, waitFor } from "storybook/test";
import type { WalliChatBlockAction, WalliChatMessage } from "../src/types";
import { registerBlock } from "../src/core/block-registry";
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
      .onAction=${async ({ data, messageId, name }: WalliChatBlockAction) => {
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
