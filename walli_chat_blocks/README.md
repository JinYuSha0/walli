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

## People messages

`peopleBlockDefinition` renders plain text for `role: "people"` with a 36px avatar, nickname, and a content-sized bubble. Register default identity information in the block's `meta`:

```ts
import { registerBlock } from "@wallilabs/chat";
import { peopleBlockDefinition } from "@wallilabs/chat-blocks";

registerBlock({
  ...peopleBlockDefinition,
  meta: { avatarUrl: "/avatar.jpg", nickname: "guangzhi" },
});

const chat = document.createElement("walli-chat");
chat.style.cssText = "display:block;height:400px";
chat.messages = [
  { id: "person-1", role: "people", markdown: "Working towards the same goal." },
  {
    id: "person-2",
    role: "people",
    markdown: "Together!",
    meta: { avatarUrl: "/alex.jpg", nickname: "Alex" },
  },
];
document.body.append(chat);
```

Message `meta` replaces the block's default `meta` when provided. Custom block renderers receive the resolved value as `render({ meta })`. People messages support the same Markdown blocks as assistant messages, including headings, lists, quotes, links, code, tables, images, and registered custom blocks. Customize bubble colors with `--walli-people-background` and `--walli-people-color`.

People is registered as a role-level message wrapper (`scope: "message", role: "people"`), rather than a Markdown tokenizer. The wrapper is selected once per message; its body uses `prepareMarkdownContent(markdown, { role: "people" })`. Markdown and nested custom blocks still resolve their role-specific definitions normally.

Set message `meta.showBubble` to `false` to hide the people bubble background and pointer while keeping the avatar, nickname, and Markdown content. It defaults to `true` and can also be configured in the registered default meta.
