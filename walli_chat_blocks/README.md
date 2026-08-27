# @walli/chat-blocks

Optional custom blocks for `@walli/chat`.

## Recommended replies

Register the block once, then include its Markdown in an assistant message:

```ts
import { registerBlock } from "@walli/chat";
import {
  createRecommendedRepliesMarkdown,
  recommendedRepliesBlockDefinition,
} from "@walli/chat-blocks";

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
