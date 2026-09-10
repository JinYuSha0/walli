# Installation

## Install the UI library

Use the consuming project's package manager and preserve an existing compatible version:

```bash
npm install @wallilabs/chat
# or
pnpm add @wallilabs/chat
```

React applications also need React >=18; Vue applications need Vue >=3.4. Neither framework is required for vanilla JavaScript. Import the matching entry (`@wallilabs/chat`, `@wallilabs/chat/react`, or `@wallilabs/chat/vue`) and `@wallilabs/chat/theme.css`. The library is browser UI; use a client-only boundary for SSR.

For the ready-made blocks described in [existing blocks](existing-blocks.md):

```bash
npm install @wallilabs/chat @wallilabs/chat-blocks lit
# or
pnpm add @wallilabs/chat @wallilabs/chat-blocks lit
```

Use compatible chat/chat-blocks releases; the blocks package declares chat and Lit >=3.3 as peers. Also import `@wallilabs/chat-blocks/theme.css`. Installing the blocks package does not register its definitions: call `registerBlock` for each required block before assigning messages.

## Install or discover this skill

The npm package includes `skills/walli-chat/SKILL.md` and its references. For releases containing the installer, `postinstall` automatically links the installed folder to the consuming project's `.agents/skills/walli-chat`. The link follows package upgrades. Source-repository installs without a consumer and global installs are skipped. An existing different skill is preserved; a link failure does not fail the library install.

If the package manager blocks dependency lifecycle scripts, automatic linking cannot run. The bundled files remain available. The optional repair command from the consuming project is:

```bash
npx --no-install walli-chat-skill
# or
pnpm exec walli-chat-skill
```

For other supported agents, or when deliberately using the skills.sh CLI, install from the local package:

```bash
npx skills add ./node_modules/@wallilabs/chat/skills/walli-chat
```

From this source repository, before publishing:

```bash
npx skills add ./walli_chat/skills/walli-chat
```

After this skill directory has been pushed to the repository's main branch, the remote form is:

```bash
npx skills add https://github.com/JinYuSha0/walli/tree/main/walli_chat/skills/walli-chat
```

The local command works with the checked-out files; the remote command requires those files to exist on GitHub. Publishing only to npm does not publish a GitHub directory. The skills CLI installs instructions, not the UI package or its dependencies. Let it select the target agent, or pass `--agent codex --skill walli-chat` when specifically targeting Codex. Do not install a second copy if the npm-linked skill is already discovered; choose one installation owner.

Codex discovers `.agents/skills` and supports symlinked skill folders. Invoke `$walli-chat` or use the skill selector. If it is missing, restart Codex and inspect the link target and `SKILL.md`. Other agents use their own discovery locations, handled by the skills CLI.

Sources: [skills CLI source formats and options](https://github.com/vercel-labs/skills), [Codex discovery](https://learn.chatgpt.com/docs/build-skills), [npm lifecycle](https://docs.npmjs.com/cli/v11/using-npm/scripts/), [pnpm settings](https://pnpm.io/settings).
