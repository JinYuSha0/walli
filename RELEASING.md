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

Only pushing a `v*` tag triggers `Publish npm packages`. Ordinary branch pushes and PR merges
do not run the release workflow. Version PRs are no longer created automatically.

Prepare package versions and changelogs locally, then commit the resulting changes:

```bash
pnpm version-packages
git add walli_chat/package.json walli_chat/CHANGELOG.md walli_chat_blocks/package.json walli_chat_blocks/CHANGELOG.md .changeset
git commit -m "chore: version packages"
git push origin main
```

Once that version commit is on `main`, tag it with `v` followed by the exact version in both
package manifests. For example, if both versions are `0.0.0-alpha.1`:

```bash
git tag v0.0.0-alpha.1
git push origin v0.0.0-alpha.1
```

The workflow validates that the tag matches both package versions, runs the release gate,
builds and publishes both packages through npm Trusted Publishing (OIDC), and creates a GitHub
Release for the triggering tag. Tags containing a prerelease suffix create prereleases.
Configure the `npm` GitHub environment to allow deployment from release tags.

## Prereleases

The current prerelease channel is recorded in `.changeset/pre.json` (currently `alpha`).
`pnpm version-packages` prepares prerelease versions, and Changesets publishes them with the
corresponding npm dist-tag.

To leave beta mode before the first stable release:

```bash
pnpm changeset:pre:exit
git add .changeset/pre.json
git commit -m "chore: exit beta prerelease mode"
git push
```

Run `pnpm version-packages` to prepare stable versions, then commit and push a matching `v*`
tag as described above. To enter a future beta cycle:

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
