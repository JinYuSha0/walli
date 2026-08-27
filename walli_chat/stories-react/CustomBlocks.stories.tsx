import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  confirmationCardBlockDefinition,
  createConfirmationCardMarkdown,
  createNoticeMarkdown,
  noticeBlockDefinition,
  recommendedRepliesBlockDefinition,
  type ConfirmationCardData,
  type ConfirmationCardField,
  type ConfirmationCardSubmission,
} from "@walli/chat-blocks";
import { useRef } from "react";
import {
  WalliChat,
  WalliChatComposer,
  registerBlock,
  type WalliChatBlockAction,
  type WalliChatMessage,
  type WalliChatRef,
} from "../src/react";
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

const reactSource = `import { useRef } from "react";
import {
  WalliChat,
  WalliChatComposer,
  registerBlock,
  type WalliChatRef,
} from "@walli/chat/react";
import {
  confirmationCardBlockDefinition,
  createConfirmationCardMarkdown,
  createNoticeMarkdown,
  createRecommendedRepliesMarkdown,
  noticeBlockDefinition,
  recommendedRepliesBlockDefinition,
} from "@walli/chat-blocks";
import "@walli/chat/theme.css";

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
  ...(["info", "success", "error"]).map((variant) => ({
    id: \`notice-\${variant}\`,
    role: "assistant",
    markdown: createNoticeMarkdown({ text: \`\${variant} notice\`, variant }),
  })),
];

export function CustomBlocks() {
  const chat = useRef<WalliChatRef>(null);
  return (
    <WalliChat
      ref={chat}
      messages={messages}
      onAction={async ({ name, data }) => {
        if (name !== "confirmation-card") return;
        await submitConfirmation(data);
        chat.current?.insertMessagesAtBottom([{
          id: crypto.randomUUID(),
          role: "assistant",
          markdown: createNoticeMarkdown({
            text: "Appointment submitted successfully.",
            variant: "success",
          }),
        }]);
      }}
      style={{ height: 720 }}
    >
      <WalliChatComposer slot="composer" value="" />
    </WalliChat>
  );
}`;

function CustomBlocksSurface({ messages }: Args) {
  const chat = useRef<WalliChatRef>(null);

  const handleAction = async ({ data, messageId, name }: WalliChatBlockAction) => {
    if (name !== "confirmation-card") return;
    const submission = data as ConfirmationCardSubmission;
    const message = chat.current?.element?.messages.find((item) => item.id === messageId);
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
    chat.current?.replaceMessage(messageId, {
      markdown: createConfirmationCardMarkdown(confirmedData),
      meta: confirmedData,
    });
    chat.current?.insertMessagesAtBottom(
      [
        {
          id: `react-confirmation-success-${crypto.randomUUID()}`,
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

  return (
    <div style={{ height: 720, width: "100%", background: "var(--walli-background)" }}>
      <WalliChat
        ref={chat}
        messages={messages}
        onAction={handleAction}
        style={{ display: "block", height: "100%", width: "100%" }}
      >
        <WalliChatComposer
          slot="composer"
          value=""
          placeholder="Choose a reply or type a message"
          onSubmit={async (markdown) => {
            if (!markdown) return;
            chat.current?.insertMessagesAtBottom(
              [{ id: `react-user-${crypto.randomUUID()}`, role: "user", markdown }],
              { stick: true },
            );
          }}
        />
      </WalliChat>
    </div>
  );
}

const meta = {
  title: "React/Custom Blocks",
  component: WalliChat,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    messages: [recommendedRepliesMessage, confirmationCardMessage, ...noticeMessages],
  },
  render: (args) => <CustomBlocksSurface {...args} />,
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const AllBlocks: Story = { parameters: source(reactSource) };
export const RecommendedReplies: Story = {
  args: { messages: [recommendedRepliesMessage] },
  parameters: source(reactSource),
};
export const ConfirmationCard: Story = {
  args: { messages: [confirmationCardMessage] },
  parameters: source(reactSource),
};
export const Notices: Story = {
  args: { messages: noticeMessages },
  parameters: source(reactSource),
};
