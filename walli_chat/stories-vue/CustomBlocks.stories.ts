import type { Meta, StoryObj } from "@storybook/vue3-vite";
import {
  confirmationCardBlockDefinition,
  createConfirmationCardMarkdown,
  createNoticeMarkdown,
  noticeBlockDefinition,
  recommendedRepliesBlockDefinition,
  type ConfirmationCardData,
  type ConfirmationCardField,
  type ConfirmationCardSubmission,
} from "@wallilabs/chat-blocks";
import { defineComponent, h, ref } from "vue";
import {
  WalliChat,
  WalliChatComposer,
  registerBlock,
  type WalliChatBlockAction,
  type WalliChatExpose,
  type WalliChatMessage,
} from "../src/vue";
import {
  confirmationCardMessage,
  noticeMessages,
  recommendedRepliesMessage,
} from "../stories/CustomBlocks.stories";
import { source } from "./source";

registerBlock(recommendedRepliesBlockDefinition);
registerBlock(confirmationCardBlockDefinition);
registerBlock(noticeBlockDefinition);

type Args = { messages: WalliChatMessage[] };

const vueSource = `<script setup lang="ts">
import { ref } from "vue";
import {
  WalliChat,
  WalliChatComposer,
  registerBlock,
  type WalliChatExpose,
} from "@wallilabs/chat/vue";
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

const chat = ref<WalliChatExpose>();
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
const messages = [
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
  ...(["info", "success", "error"] as const).map((variant) => ({
    id: \`notice-\${variant}\`,
    role: "assistant" as const,
    markdown: createNoticeMarkdown({ text: \`\${variant} notice\`, variant }),
  })),
];

async function onAction({ name, data }) {
  if (name !== "confirmation-card") return;
  await submitConfirmation(data);
  chat.value?.insertMessagesAtBottom([{
    id: crypto.randomUUID(),
    role: "assistant",
    markdown: createNoticeMarkdown({ text: "Appointment submitted successfully.", variant: "success" }),
  }]);
}
</script>

<template>
  <WalliChat ref="chat" :messages="messages" :on-action="onAction" style="height: 720px">
    <WalliChatComposer slot="composer" value="" />
  </WalliChat>
</template>`;

const vueRecommendedRepliesSource = `<script setup lang="ts">
import { WalliChat, WalliChatComposer, registerBlock } from "@wallilabs/chat/vue";
import {
  createRecommendedRepliesMarkdown,
  recommendedRepliesBlockDefinition,
} from "@wallilabs/chat-blocks";
import "@wallilabs/chat/theme.css";
import "@wallilabs/chat-blocks/theme.css";

registerBlock(recommendedRepliesBlockDefinition);

const messages = [{
  id: "recommended-replies",
  role: "assistant" as const,
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
}];
</script>

<template>
  <WalliChat :messages="messages" style="height: 720px">
    <WalliChatComposer slot="composer" value="" />
  </WalliChat>
</template>`;

const vueConfirmationCardSource = `<script setup lang="ts">
import { WalliChat, registerBlock } from "@wallilabs/chat/vue";
import {
  confirmationCardBlockDefinition,
  createConfirmationCardMarkdown,
  type ConfirmationCardData,
} from "@wallilabs/chat-blocks";
import "@wallilabs/chat/theme.css";
import "@wallilabs/chat-blocks/theme.css";

registerBlock(confirmationCardBlockDefinition);

const confirmation: ConfirmationCardData = {
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
const messages = [{
  id: "confirmation-card",
  role: "assistant" as const,
  markdown: createConfirmationCardMarkdown(confirmation),
  meta: confirmation,
  showActions: false,
}];

async function onAction({ name, data }) {
  if (name === "confirmation-card") await submitConfirmation(data);
}
</script>

<template>
  <WalliChat :messages="messages" :on-action="onAction" style="height: 720px" />
</template>`;

const vueNoticesSource = `<script setup lang="ts">
import { WalliChat, registerBlock } from "@wallilabs/chat/vue";
import { createNoticeMarkdown, noticeBlockDefinition } from "@wallilabs/chat-blocks";
import "@wallilabs/chat/theme.css";
import "@wallilabs/chat-blocks/theme.css";

registerBlock(noticeBlockDefinition);

const messages = [
  { text: "Here is some helpful information.", variant: "info" as const },
  { text: "The operation completed successfully.", variant: "success" as const },
  {
    text: "Submission failed. Check your input and try again.",
    variant: "error" as const,
  },
].map(({ text, variant }) => ({
  id: \`notice-\${variant}\`,
  role: "assistant" as const,
  markdown: createNoticeMarkdown({ text, variant }),
  showActions: false,
}));
</script>

<template>
  <WalliChat :messages="messages" style="height: 720px" />
</template>`;

const CustomBlocksSurface = defineComponent({
  name: "CustomBlocksSurface",
  props: { messages: { required: true, type: Array } },
  setup(props) {
    const chat = ref<WalliChatExpose>();
    const handleAction = async ({ data, messageId, name }: WalliChatBlockAction) => {
      if (name !== "confirmation-card") return;
      const submission = data as ConfirmationCardSubmission;
      const message = chat.value?.element?.messages.find((item) => item.id === messageId);
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
      chat.value?.replaceMessage(messageId, {
        markdown: createConfirmationCardMarkdown(confirmedData),
        meta: confirmedData,
      });
      chat.value?.insertMessagesAtBottom(
        [
          {
            id: `vue-confirmation-success-${crypto.randomUUID()}`,
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
    };

    return () =>
      h(
        "div",
        { style: { height: "720px", width: "100%", background: "var(--walli-background)" } },
        [
          h(
            WalliChat,
            {
              ref: chat,
              messages: props.messages as WalliChatMessage[],
              onAction: handleAction,
              style: { display: "block", height: "100%", width: "100%" },
            },
            {
              default: () =>
                h(WalliChatComposer, {
                  slot: "composer",
                  value: "",
                  placeholder: "Choose a reply or type a message",
                  onSubmit: async (markdown: string) => {
                    if (!markdown) return;
                    chat.value?.insertMessagesAtBottom(
                      [{ id: `vue-user-${crypto.randomUUID()}`, role: "user", markdown }],
                      { stick: true },
                    );
                  },
                }),
            },
          ),
        ],
      );
  },
});

const meta = {
  title: "Vue/Custom Blocks",
  component: WalliChat,
  tags: ["autodocs"],
  argTypes: {
    messages: { table: { disable: true } },
  },
  parameters: { layout: "fullscreen" },
  args: {
    messages: [recommendedRepliesMessage, confirmationCardMessage, ...noticeMessages],
  },
  render: (args) => ({
    components: { CustomBlocksSurface },
    setup: () => ({ args }),
    template: `<CustomBlocksSurface v-bind="args" />`,
  }),
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const AllBlocks: Story = { parameters: source(vueSource) };
export const RecommendedReplies: Story = {
  args: { messages: [recommendedRepliesMessage] },
  parameters: source(vueRecommendedRepliesSource),
};
export const ConfirmationCard: Story = {
  args: { messages: [confirmationCardMessage] },
  parameters: source(vueConfirmationCardSource),
};
export const Notices: Story = {
  args: { messages: noticeMessages },
  parameters: source(vueNoticesSource),
};
