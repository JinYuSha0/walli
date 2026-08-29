# @wallilabs/chat-blocks

Recommended replies, confirmation cards, and notices for `@wallilabs/chat`. The block definitions work with the Vanilla, React, and Vue APIs.

## Storybook

- **Vanilla:** [https://storybook.wallibot.dev/?path=/docs/components-custom-blocks--docs](https://storybook.wallibot.dev/?path=/docs/components-custom-blocks--docs)
- **React:** [https://storybook-react.wallibot.dev/?path=/docs/components-custom-blocks--docs](https://storybook-react.wallibot.dev/?path=/docs/components-custom-blocks--docs)
- **Vue:** [https://storybook-vue.wallibot.dev/?path=/docs/components-custom-blocks--docs](https://storybook-vue.wallibot.dev/?path=/docs/components-custom-blocks--docs)

## Install

```bash
npm install @wallilabs/chat@alpha @wallilabs/chat-blocks@alpha
```

## Minimal example

Register each block once before rendering messages:

```ts
import "@wallilabs/chat";
import "@wallilabs/chat/theme.css";
import "@wallilabs/chat-blocks/theme.css";
import {
  registerBlock,
  type WalliChatComposerElement,
  type WalliChatElement,
} from "@wallilabs/chat";
import {
  confirmationCardBlockDefinition,
  createConfirmationCardMarkdown,
  createNoticeMarkdown,
  createRecommendedRepliesMarkdown,
  noticeBlockDefinition,
  recommendedRepliesBlockDefinition,
} from "@wallilabs/chat-blocks";

registerBlock(recommendedRepliesBlockDefinition);
registerBlock(confirmationCardBlockDefinition);
registerBlock(noticeBlockDefinition);

const chat = document.querySelector<WalliChatElement>("walli-chat")!;
const composer = document.querySelector<WalliChatComposerElement>("walli-chat-composer")!;

chat.messages = [
  {
    id: "custom-blocks",
    role: "assistant",
    markdown: [
      createNoticeMarkdown({ variant: "info", text: "Review the booking details." }),
      createConfirmationCardMarkdown({
        title: "Confirm booking",
        fields: [
          {
            id: "name",
            label: "Name",
            type: "text",
            value: "Ada",
            required: true,
            editable: true,
          },
          {
            id: "appointmentAt",
            label: "Appointment time",
            type: "time",
            format: "YYYY-MM-DD HH:mm",
            min: "now",
            required: true,
          },
        ],
        action: { id: "confirm-booking", label: "Confirm" },
      }),
      createRecommendedRepliesMarkdown(["Tell me more", "Choose another time"]),
    ].join("\n\n"),
  },
];

composer.onSubmit = async (markdown) => {
  console.log("Recommended reply:", markdown);
};

chat.onAction = async ({ data, messageId, name }) => {
  if (name !== "confirmation-card") return;
  console.log("Confirmation:", { data, messageId });
};
```

```html
<walli-chat style="display: block; height: 640px">
  <walli-chat-composer slot="composer" placeholder="Message Walli"></walli-chat-composer>
</walli-chat>
```

For React or Vue, run the same `registerBlock(...)` calls in your application entry and render the message Markdown with `WalliChat` from `@wallilabs/chat/react` or `@wallilabs/chat/vue`.

## Recommended replies

```ts
const markdown = createRecommendedRepliesMarkdown([
  "Tell me more",
  "Give me an example",
  "What should I do next?",
]);
```

The equivalent Markdown is:

```md
:::recommended-replies
- Tell me more
- Give me an example
- What should I do next?
:::
```

An empty block uses `defaultRecommendedReplies`. Clicking a reply calls the chat composer's `onSubmit` callback. Replies are disabled while the chat is streaming.

## Confirmation card

```ts
const markdown = createConfirmationCardMarkdown({
  title: "Confirm booking",
  fields: [
    {
      id: "name",
      label: "Name",
      type: "text",
      required: true,
      editable: true,
      minLength: 2,
      maxLength: 30,
      errorMessages: { required: "Enter your name" },
    },
    {
      id: "quantity",
      label: "Quantity",
      type: "number",
      min: 1,
      max: 100,
      decimals: 0,
    },
    {
      id: "appointmentAt",
      label: "Appointment time",
      type: "time",
      format: "YYYY-MM-DD HH:mm",
      min: "now",
      required: true,
    },
  ],
  action: { id: "confirm-booking", label: "Confirm" },
});
```

The `onAction` callback receives confirmation data in this shape:

```json
{
  "type": "confirmation-card",
  "action": "confirm-booking",
  "fields": {
    "name": "Ada",
    "quantity": 2,
    "appointmentAt": "2026-08-28 10:30"
  }
}
```

Time fields support `YYYY-MM-DD` and `YYYY-MM-DD HH:mm`. Every field supports `required`, `editable`, and custom error messages.

## Notice

```ts
const info = createNoticeMarkdown({ variant: "info", text: "Check the details." });
const success = createNoticeMarkdown({ variant: "success", text: "Booking confirmed." });
const error = createNoticeMarkdown({ variant: "error", text: "Submission failed." });
```

## License

[MIT](./LICENSE) © 2026 JinYuSha0
