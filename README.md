# @tordans/changelog-kit

Shared changelog scripts and React list component to manage and generate user facing changelogs.

The goal is an automated reminder workflow that still leaves full control to the maintainer.

## Features

- [Unified `changelog` CLI](#cli-usage) with composable phases (`cleanup`, `prefill`, `validate`, `generate`) and an optional interactive menu (Clack)
- [React `ChangelogList` component](#react-usage-list-only) to use in your changelog page
- [Shared `changelog-update` agent skill](#shared-agent-skill) for commit-to-changelog triage workflows

## Workflow

- **Manual usage:** run `changelog --prefill` (or `changelog --cleanup --prefill`) to add missing refs, edit the registry entries (`description`, grouping, `hide`) manually, then run `changelog --validate --generate`.
  Note: `prefill` may auto-set `hide: true` for commits that look like non user facing.
- **Guard:** add a [Husky `pre-push` hook](https://typicode.github.io/husky/get-started.html) that runs `changelog --non-interactive --ci --validate --generate` so hooks never wait for prompts.
- **Review:** inspect the registry and generated files after `changelog --validate --generate`, then adjust entries manually if needed before committing.
- **LLM:** use the [Shared Agent Skill](#shared-agent-skill) with a prompt like "Update changelog from recent commits, group related commits, and hide non-user-facing work."
- **Commits:** only user-facing changes belong in the changelog; non-user-facing changelog updates can be opted out with `hide changelog` (also supports `no-changelog` / `no changelog`) in the commit message body.
- **Custom ignore terms:** pass one or more `--ignore-commit-term` flags to skip recurring commits (for example automated `chore(data):` imports).

### Rebase-safe registry

After `git pull --rebase`, `git rebase`, or `git commit --amend`, commit SHAs change. Without a remap step, a later `changelog --cleanup` can drop registry refs that no longer exist on the rewritten history, which loses handwritten `descriptionMd` for those entries.

Run `changelog --remap-refs` from a Husky **`post-rewrite`** hook so Git’s `<old-sha> <new-sha>` lines on stdin update the registry in place (short and full refs are preserved; squashed duplicates are deduped).

Example `.husky/post-rewrite`:

```sh
#!/usr/bin/env sh
cd "$(dirname -- "$0")/.." || exit 1

case "$1" in
  rebase|amend)
    bun run changelog:remap
    ;;
esac
```

Consumer `package.json` script (stdin is inherited from the hook; no extra redirection needed):

```json
{
  "scripts": {
    "changelog:remap": "changelog --non-interactive --ci --remap-refs"
  }
}
```

## Install

```bash
bun add github:tordans/changelog-kit#main
```

Because this dependency uses `github:tordans/changelog-kit#main`, run `bun update @tordans/changelog-kit` to pull the latest `main`.

## CLI Usage

The package exposes a single binary: **`changelog`**.

Breaking change from older releases: `changelog-kit-prefill`, `changelog-kit-verify`, and `changelog-kit-build` are removed. See [docs/CLI-MIGRATION.md](docs/CLI-MIGRATION.md) for a mapping table and Husky examples.

Example `package.json` scripts in a consumer project:

```json
{
  "scripts": {
    "changelog": "changelog --non-interactive --ci --validate --generate",
    "changelog:prefill": "changelog --non-interactive --cleanup --prefill"
  }
}
```

### Phases

Pass any combination of:

| Flag         | Meaning                                      |
| ------------ | -------------------------------------------- |
| `--cleanup`  | Remove stale refs and empty registry entries |
| `--prefill`  | Draft registry entries for missing commits   |
| `--validate` | Verify registry consistency and coverage     |
| `--generate` | Write `CHANGELOG.md` and JSON output         |

**Order is always** `cleanup → prefill → validate → generate`, regardless of how flags are ordered on the command line.

Aliases: `--prefill-cleanup` (same as `--cleanup --prefill`), `--validate-generate` (same as `--validate --generate`).

Standalone: `--remap-refs` reads git post-rewrite lines from stdin and updates the registry only (no phase pipeline). Combine with `--non-interactive` / `--ci` in hooks.

With no phase flags in a TTY, `changelog` opens an interactive menu. In CI or when stdin is not a TTY, pass explicit flags (use `--non-interactive` / `--ci` in scripts so missing flags fail fast instead of hanging).

### Shared flags

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

### Runtime flags

- `--non-interactive` — require explicit phase flags (no interactive menu)
- `--ci` — stable, non-interactive-oriented behavior
- `--quiet` — less human-oriented logging
- `--json` — print one JSON summary object to stdout at the end (no decorative Clack output mixed in)
- `--no-color` — disable ANSI colors
- `--help`, `--version`

## Development

- `bun test` runs unit checks (predicate semantics, git stdout parsing, CLI argv parsing).
- `bun run bench:prefill` prints a coarse wall-clock time for `prefillChangelog` on the repo in `process.cwd()` (creates a disposable empty registry next to `--registry-path`). Compare against an older checkout with `hyperfine 'bun run bench:prefill'` or `git worktree`.

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
