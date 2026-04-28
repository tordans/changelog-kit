# @tordans/changelog-kit

Shared changelog tooling for multiple repositories:

- CLI commands to `prefill`, `verify`, and `build` changelog assets
- Core library APIs for registry + git changelog workflows
- React `ChangelogList` component (list only, no page wrapper, no fetching)
- Zod + TypeScript schemas for changelog payloads

## Install

```bash
bun add github:tordans/changelog-kit#main
```

For local development from another repo:

```json
{
  "dependencies": {
    "@tordans/changelog-kit": "github:tordans/changelog-kit#main"
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
changelog-kit-prefill --registry-path changelog.registry.yaml
changelog-kit-verify --registry-path changelog.registry.yaml
changelog-kit-build --registry-path changelog.registry.yaml
```

Optional shared flags:

- `--project-root /abs/or/relative/path`
- `--output-json-path public/changelog.gen.json`
- `--output-markdown-path CHANGELOG.md`
- `--changelog-only-path <path>` (repeatable)

## Shared Agent Skill

This package also ships a reusable agent skill at `.cursor/skills/changelog-update/SKILL.md`.

If you want Cursor to load it in a consumer repository, use the bundled reference template in this package.

Run from inside the consumer repository (after installing dependencies so the file exists in `node_modules`).

Example command:

```bash
mkdir -p ".cursor/skills/changelog-update" && cp "node_modules/@tordans/changelog-kit/.cursor/skills/changelog-update/SKILL.reference.md" ".cursor/skills/changelog-update/SKILL.md"
```

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

## Updates

Because dependencies use `github:tordans/changelog-kit#main`, `bun install` fetches the latest `main` from that repository.
