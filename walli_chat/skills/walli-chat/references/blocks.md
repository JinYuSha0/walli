# Custom blocks

Use `registerBlock(definition)` from any framework entry before assigning messages. Registrations are global. It returns `{ unregister() }`; later definitions for the same name/role win, and unregistering restores the previous definition. Role-specific definitions take precedence over shared definitions.

For built-in customization, spread an existing definition and override only the needed hook. Import individual built-in definitions from the root entry when they are not exported by a wrapper:

```js
import { registerBlock, systemBlockDefinition } from "@wallilabs/chat";
import { html } from "lit";

const registration = registerBlock({
  ...systemBlockDefinition,
  render(context) {
    return html`<div class="system-note">${systemBlockDefinition.render(context)}</div>`;
  },
});
// registration.unregister() when no longer needed.
```

`systemBlockDefinition` is the default inline/system definition. `createAssistantBlockDefinition(role)` supplies an assistant-style message container for another role; assistant metadata includes nickname, avatarUrl and showBubble.

For new Markdown syntax use `WalliChatTokenizedBlockDefinition<Input, Prepared, Materialized>`:

- `name`, optional `role`, `meta`, `marginTop`, `marginBottom`, `styles`.
- `tokenizer.tokenize(source, tokens)` returns `{ raw, data }` or undefined; optional `level: "block"`.
- `prepare(data)` converts parsed data if needed.
- `measure(prepared, { availableWidth, role, meta })` returns `{ height, width? }`.
- `materialize(prepared, { height, width, role })` optionally derives render data.
- `render({ data, ctx, messageId, role, meta, height, width, left, top, contentInsetX })` returns render content. Use Lit templates for custom-element rendering, not React/Vue nodes.

When stage types differ, the corresponding prepare/materialize function is required. Accurate measurement is essential for virtualization. Persist interactive state through `ctx.getBlockState` / `setBlockState`, request redraw with `ctx.requestRender`, and report actions through `ctx.action` rather than relying on mounted DOM surviving scroll.

`WalliChatRoleBlockDefinition` uses `scope: "message"`, a required role, optional `getContentInsetX(meta)`, and no tokenizer. Inspect the installed declarations for exact built-in hook signatures; they differ from custom tokenized definitions.

For the existing recommended replies, confirmation card, notice, and people definitions in `@wallilabs/chat-blocks`, read [existing custom blocks](existing-blocks.md). See [installation](installation.md) for packages and styles.

## Incomplete blocks during streaming

Set `tokenizer.streamingPrefix` to the opening marker (for example, `":::notice"`) to hide unfinished custom block content while its Markdown is streaming. A recognized block displays the existing tool-call indicator with the default label `rendering ${blockName}`. Before the opening marker identifies a block, an otherwise empty message retains its start indicator. Pass `getCustomBlockLabel: (blockName) => string` to `insertStreamingMessageAtBottom` to customize the pending label.

If a tokenizer throws while parsing a closed `streamingPrefix` directive, the directive is displayed as a plain code block. Other message content continues rendering. Invalid input is not coerced or submitted. Tokenizers without a matching closed directive fall back to normal Markdown parsing.

The tokenizer still decides when a block is complete. Once it returns a token, that block renders normally. Incomplete content remains visible as ordinary Markdown when streaming ends, so malformed output is not silently lost. Code fences are handled as code and are not hidden.
