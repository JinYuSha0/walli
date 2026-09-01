# Changesets

Changesets describe user-facing package changes and drive versioning for
`@wallilabs/chat` and `@wallilabs/chat-blocks`.

Run `pnpm changeset`, select the affected package and semver bump, then commit the generated
Markdown file with your pull request. The two public packages are configured as a fixed group,
so Changesets always versions and publishes them together.

See [RELEASING.md](../RELEASING.md) for the complete release workflow.
