# @tordans/changelog-kit

Shared changelog tooling for multiple repositories:

- CLI commands to `prefill`, `verify`, and `build` changelog assets
- Core library APIs for registry + git changelog workflows
- React `ChangelogList` component (list only, no page wrapper, no fetching)
- Zod + TypeScript schemas for changelog payloads

## Install

```bash
bun add @tordans/changelog-kit
```

For local development from another repo:

```json
{
  "dependencies": {
    "@tordans/changelog-kit": "file:../../../NPM/changelog-kit"
  }
}
```

## Registry Defaults

By default, the package expects:

- `changelog.registry.yaml`
- `CHANGELOG.md`
- `public/changelog.gen.json`

You can override any path with CLI flags or `ChangelogKitConfig`.

## CLI Usage

```bash
changelog-kit-prefill --registry-path registry.yaml
changelog-kit-verify --registry-path registry.yaml
changelog-kit-build --registry-path registry.yaml
```

Optional shared flags:

- `--project-root /abs/or/relative/path`
- `--output-json-path public/changelog.gen.json`
- `--output-markdown-path CHANGELOG.md`
- `--changelog-only-path <path>` (repeatable)

## React Usage (list only)

`ChangelogList` is presentational only. The outer app owns route/page/fetching/loading/error states.

```tsx
import { ChangelogList, changelogFileSchema } from '@tordans/changelog-kit'

const data = changelogFileSchema.parse(await fetch('/changelog.gen.json').then((r) => r.json()))

<ChangelogList
  data={data}
  commitUrl={(ref) => `https://github.com/org/repo/commit/${ref}`}
  labels={{ empty: 'Keine Eintraege.' }}
/>
```

## Publish to GitHub Packages (`tordans`)

1. Create a personal access token with `read:packages` and `write:packages`.
2. Add token as repository secret: `GH_PACKAGES_TOKEN`.
3. Configure local auth in `~/.npmrc`:

   ```ini
   @tordans:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=YOUR_TOKEN
   ```

4. Bump version in `package.json`.
5. Tag and push:

   ```bash
   git tag v0.1.0
   git push origin main --tags
   ```

The publish workflow will run on version tags (`v*`) and publish `@tordans/changelog-kit`.
