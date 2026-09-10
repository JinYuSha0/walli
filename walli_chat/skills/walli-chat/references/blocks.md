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
