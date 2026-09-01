# Releasing npm packages

`@wallilabs/chat` and `@wallilabs/chat-blocks` are managed by Changesets as a fixed group. They
always receive the same version and are published together.

## Add a changeset

For every pull request that changes a public package, run:

```bash
pnpm changeset
```

Select either or both public packages, choose the semver impact, and enter a consumer-facing
summary. Commit the generated `.changeset/*.md` file with the code change.

- `patch`: compatible bug fix
- `minor`: backward-compatible feature
- `major`: breaking change
- `pnpm changeset --empty`: no package release is required

Because the packages are a fixed group, the highest selected bump applies to both packages.

## Automated release

After changesets are merged into `main`, the `Publish npm packages` workflow creates or updates a
`Version Packages` pull request. That pull request contains synchronized package versions,
changelogs, and consumed changesets.

Review and merge the version pull request when ready to publish. The next workflow run will:

1. Build both packages in dependency order.
2. Publish both packages to npm through Trusted Publishing (OIDC).
3. Push package tags and create GitHub Releases.

Do not create release tags manually. Changesets creates tags in these forms:

```text
@wallilabs/chat@0.0.0-beta.0
@wallilabs/chat-blocks@0.0.0-beta.0
```

## Prereleases

The repository is initially placed in the `beta` prerelease channel. While beta mode is active,
version pull requests produce versions such as `0.0.0-beta.0` and npm publishes them with the
`beta` dist-tag.

To leave beta mode before the first stable release:

```bash
pnpm changeset:pre:exit
git add .changeset/pre.json
git commit -m "chore: exit beta prerelease mode"
git push
```

The release workflow will then prepare stable versions. To enter a future beta cycle:

```bash
pnpm changeset:pre:beta
git add .changeset/pre.json
git commit -m "chore: enter beta prerelease mode"
```

## Local inspection

Check pending release changes without publishing:

```bash
pnpm changeset:status
```

`pnpm run release` performs a real npm publish and is intended for CI. Do not use it as a dry run.
