# @wallilabs/chat-blocks

Optional custom blocks for `@wallilabs/chat`.

```ts
import "@wallilabs/chat/theme.css";
import "@wallilabs/chat-blocks/theme.css";
```

## Recommended replies

Register the block once, then include its Markdown in an assistant message:

```ts
import { registerBlock } from "@wallilabs/chat";
import {
  createRecommendedRepliesMarkdown,
  recommendedRepliesBlockDefinition,
} from "@wallilabs/chat-blocks";

registerBlock(recommendedRepliesBlockDefinition);

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

An empty block uses `defaultRecommendedReplies`. Clicking a reply calls the chat composer's
`onSubmit` callback with that text. All replies are disabled while the chat is streaming.

## Confirmation card

```ts
import { registerBlock } from "@wallilabs/chat";
import {
  confirmationCardBlockDefinition,
  createConfirmationCardMarkdown,
} from "@wallilabs/chat-blocks";

registerBlock(confirmationCardBlockDefinition);

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

Time fields support `YYYY-MM-DD` and `YYYY-MM-DD HH:mm`. Every field supports `required` and
`editable`. On confirmation, the composer receives a JSON string with this shape:

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
