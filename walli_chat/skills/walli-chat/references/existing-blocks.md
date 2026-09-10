# Existing custom blocks

All four definitions below are exported by `@wallilabs/chat-blocks` and work with vanilla JavaScript, React and Vue. See [installation](installation.md) for packages and peer dependencies. These are optional extensions; the chat package's built-in code, image, table and streaming blocks do not require this package.

## Register once before messages

```ts
import { registerBlock } from "@wallilabs/chat";
import "@wallilabs/chat/theme.css";
import "@wallilabs/chat-blocks/theme.css";
import {
  recommendedRepliesBlockDefinition,
  confirmationCardBlockDefinition,
  noticeBlockDefinition,
  peopleBlockDefinition,
} from "@wallilabs/chat-blocks";

const registrations = [
  recommendedRepliesBlockDefinition,
  confirmationCardBlockDefinition,
  noticeBlockDefinition,
  peopleBlockDefinition,
].map((definition) => registerBlock(definition));
// Register only the blocks the app uses. To remove them:
// registrations.forEach(registration => registration.unregister());
```

Run registration in the browser application entry, not each React render or each Vue reactive update. React/Vue may import `registerBlock` from their respective chat entry. The block definitions and Markdown helpers always come from `@wallilabs/chat-blocks`; there are no `/react` or `/vue` block-package entries.

| Block               | Definition                        | Content helper / role                         |
| ------------------- | --------------------------------- | --------------------------------------------- |
| Recommended replies | recommendedRepliesBlockDefinition | createRecommendedRepliesMarkdown(replies?)    |
| Confirmation form   | confirmationCardBlockDefinition   | createConfirmationCardMarkdown(data)          |
| Notice              | noticeBlockDefinition             | createNoticeMarkdown(data)                    |
| People message      | peopleBlockDefinition             | Message role `people`; ordinary Markdown body |

Prefer the helpers over hand-constructed directives. Confirmation and notice helpers validate their data and can throw for invalid input.

## Recommended replies

```ts
import { createRecommendedRepliesMarkdown } from "@wallilabs/chat-blocks";
const markdown = createRecommendedRepliesMarkdown([
  "Tell me more",
  "Show an example",
  "Choose another time",
]);
```

- Input: `readonly string[]`; omission or an empty parsed block uses `defaultRecommendedReplies` (also exported).
- Syntax: `:::recommended-replies`, bullet-list replies, closing `:::` on its own line.
- Clicking a reply scrolls to the bottom and calls the mounted composer's `onSubmit` through the chat action API. Mount a composer in `slot="composer"` and supply `onSubmit`; this does not emit a custom `recommended-replies` action.
- Disabled during streaming. Sending the reply and obtaining the assistant response remain application responsibilities.
- Exported data type: `RecommendedRepliesData` (`replies: readonly string[]`).

## Confirmation card

```ts
import { createConfirmationCardMarkdown } from "@wallilabs/chat-blocks";
const markdown = createConfirmationCardMarkdown({
  title: "Confirm booking",
  fields: [
    {
      id: "name",
      label: "Name",
      type: "text",
      value: "Ada",
      required: true,
      minLength: 2,
      maxLength: 30,
      errorMessages: { required: "Enter a name" },
    },
    { id: "quantity", label: "Quantity", type: "number", value: 1, min: 1, max: 10, decimals: 0 },
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

`ConfirmationCardData` has optional `title`, required `fields`, and required `action: { id, label?, disabled? }`. Field IDs must be unique. All fields have `id`, `label`, optional `required`, and optional `editable` (defaults true).

| Field type | Value and constraints                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| text       | value?: string; minLength?, maxLength?                                                                                  |
| number     | value?: number; min?, max?, decimals? (integer 0–20)                                                                    |
| time       | value?: string; required format: `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`; min?, max? matching format; min also accepts `now` |

`errorMessages` supports the relevant keys: required; text minLength/maxLength; number invalid/min/max/decimals; time invalid/min/max. Optional empty fields are omitted from the submission. Numeric results are numbers; text/time results are strings.

The outer chat action is `type: "block"`, `name: "confirmation-card"`. The inner data has its own `type: "confirmation-card"`. Do not confuse them:

```ts
import type { WalliChatActionCallback } from "@wallilabs/chat";
import type { ConfirmationCardSubmission } from "@wallilabs/chat-blocks";

const onAction: WalliChatActionCallback<
  {},
  {
    "confirmation-card": ConfirmationCardSubmission;
  }
> = async (action) => {
  if (action.type !== "block" || action.name !== "confirmation-card") return;
  const { data, messageId } = action;
  // data = { type: "confirmation-card", action: "confirm-booking",
  //          fields: { name: "Ada", quantity: 1, appointmentAt: "..." } }
  console.log(messageId, data.action, data.fields);
  // Await the app's booking/API request here; the block does not persist data.
};
```

Vanilla: `chat.onAction = onAction`. React: `<WalliChat onAction={onAction} ... />`. Vue: `<WalliChat :on-action="onAction" ... />`. Validation runs before dispatch. The form disables during submission; errors or an unhandled action re-enable it. After successful handling, let the application update/replace the message to show the final state.

Exported types: `ConfirmationCardData`, `ConfirmationCardField`, `ConfirmationCardAction`, `ConfirmationCardSubmission`, `ConfirmationTextField`, `ConfirmationNumberField`, `ConfirmationTimeField`, `ConfirmationFieldErrorMessages`.

## Notice

```ts
import { createNoticeMarkdown } from "@wallilabs/chat-blocks";
const markdown = createNoticeMarkdown({ variant: "success", text: "Booking confirmed." });
```

`NoticeBlockData`: nonempty `text: string`, optional `variant: "info" | "success" | "error"` (defaults info). `NoticeBlockVariant` is exported. Syntax is `:::notice` containing JSON. This block displays a notice; it has no submission callback.

## People messages

```ts
import { registerBlock, type WalliChatMessage } from "@wallilabs/chat";
import { peopleBlockDefinition } from "@wallilabs/chat-blocks";

registerBlock({
  ...peopleBlockDefinition,
  meta: { avatarUrl: "/avatar.jpg", nickname: "Support", showBubble: true },
});
const messages: WalliChatMessage[] = [
  { id: "person-1", role: "people", markdown: "Hello **there**!" },
  {
    id: "person-2",
    role: "people",
    markdown: "A message without a bubble.",
    meta: { avatarUrl: "/alex.jpg", nickname: "Alex", showBubble: false },
  },
];
```

This is `scope: "message", role: "people"`, created with `createAssistantBlockDefinition("people")`. There is no `:::people` syntax and no `createPeopleMarkdown` helper. `PeopleBlockMeta` aliases assistant metadata: nickname, avatarUrl, showBubble. Message meta replaces registration defaults when supplied; it is not merged field by field.

The body supports the same Markdown and registered custom blocks as assistant messages. `showBubble: false` removes the background/pointer while retaining identity and content. Theme variables: `--walli-people-background`, `--walli-people-color`. Do not assume assistant/user built-in action buttons or assistant-only entrance animations apply to this custom role.

For authoring new definitions or role-specific overrides, read [custom block authoring](blocks.md). For version-specific details, inspect `node_modules/@wallilabs/chat-blocks/dist/index.d.ts` and its referenced declarations.
