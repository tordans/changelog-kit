# @tordans/changelog-kit

Shared changelog scripts and React list component to manage and generate user facing changelogs.

The goal is an automated reminder workflow that still leaves full control to the maintainer.

## Features

- [CLI commands](#cli-usage) to `prefill`, `verify`, and `build` changelog assets
- [React `ChangelogList` component](#react-usage-list-only) to use in your changelog page
- [Shared `changelog-update` agent skill](#shared-agent-skill) for commit-to-changelog triage workflows

## Workflow

- **Manual usage:** run `bun run changelog:prefill` to add missing refs, edit the registry entries (`description`, grouping, `hide`) manually, then run `bun run changelog`.
  Note: `prefill` may auto-set `hide: true` for commits that look like non user facing.
- **Guard:** add a [Husky `pre-push` hook](https://typicode.github.io/husky/get-started.html) that runs `bun run changelog` to verify and build before pushing.
- **Review:** inspect the registry and generated files after `bun run changelog`, then adjust entries manually if needed before committing.
- **LLM:** use the [Shared Agent Skill](#shared-agent-skill) with a prompt like "Update changelog from recent commits, group related commits, and hide non-user-facing work."
- **Commits:** only user-facing changes belong in the changelog; non-user-facing changelog updates can be opted out with `hide changelog` (also supports `no-changelog` / `no changelog`) in the commit message body.
- **Custom ignore terms:** pass one or more `--ignore-commit-term` flags to skip recurring commits (for example automated `chore(data):` imports).

## Install

```bash
bun add github:tordans/changelog-kit#main
```

Because this dependency uses `github:tordans/changelog-kit#main`, run `bun update @tordans/changelog-kit` to pull the latest `main`.

## CLI Usage

Example `package.json` scripts in a consumer project:

```json
{
  "scripts": {
    "changelog": "bun run changelog:verify && bun run changelog:build",
    "changelog:prefill": "changelog-kit-prefill",
    "changelog:verify": "changelog-kit-verify",
    "changelog:build": "changelog-kit-build"
  }
}
```

Shared flags:

- `--registry-path changelog.registry.yaml`
  Reads changelog entries from this registry file.
  > Default: `changelog.registry.yaml`
- `--output-json-path public/changelog.gen.json`
  > Default: `public/changelog.gen.json`
- `--output-markdown-path CHANGELOG.md`
  > Default: `CHANGELOG.md`
- `--project-root /abs/or/relative/path`
  Resolves all relative paths from this directory instead of the current shell location.
  > Default: current working directory
- `--changelog-only-path <path>` (repeatable)
  Limits git commit scanning to files that affect changelog generation.
  > Default: not set
- `--ignore-commit-term <term>` (repeatable)
  Skips commits whose message contains the given term (case-insensitive).
  > Default: not set

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
import { ChangelogList } from '@tordans/changelog-kit/react'
import '@tordans/changelog-kit/styles'
import { changelogFileSchema } from '@tordans/changelog-kit/schemas'

const data = changelogFileSchema.parse(await fetch('/changelog.gen.json').then((r) => r.json()))

<ChangelogList
  data={data}
  commitUrl={(ref) => `https://github.com/org/repo/commit/${ref}`}
  labels={{ empty: 'Keine Eintraege.' }}
/>
```

`@tordans/changelog-kit/styles` ships prebuilt CSS for `ChangelogList`.
In a Tailwind app, import it once in your global stylesheet (for example `src/index.css`) after `@import 'tailwindcss';`:

```css
@import 'tailwindcss';
@import '@tordans/changelog-kit/styles';
```

Use browser-safe subpath imports (`/react` and `/schemas`) instead of the package root in frontend code to avoid bundling Node-only CLI/core chunks.
