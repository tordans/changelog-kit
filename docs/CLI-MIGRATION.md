# CLI migration: unified `changelog` command

This package previously shipped three separate binaries:

| Old command             | Replacement                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `changelog-kit-prefill` | `changelog --cleanup --prefill` (or `changelog --prefill` alone, which still runs cleanup first inside prefill) |
| `changelog-kit-verify`  | `changelog --validate`                                                                                          |
| `changelog-kit-build`   | `changelog --generate`                                                                                          |

The default guard script in consumer projects is usually verify then build:

```json
{
  "scripts": {
    "changelog": "changelog --non-interactive --ci --validate --generate",
    "changelog:prefill": "changelog --non-interactive --cleanup --prefill"
  }
}
```

## Phase flags

Phases compose with boolean flags. **Execution order is always** `cleanup → prefill → validate → generate`, no matter how flags are ordered on the command line.

Examples:

```bash
changelog --validate
changelog --validate --generate
changelog --cleanup --prefill --validate
```

Aliases:

- `--prefill-cleanup` → same as `--cleanup --prefill`
- `--validate-generate` → same as `--validate --generate`

## Remap after rebase (`--remap-refs`)

`changelog --remap-refs` is a standalone mode (not a phase flag). It reads `<old-oid> <new-oid>` lines from stdin (as written by Git’s `post-rewrite` hook), remaps matching registry refs to the new commits, and exits. Typical usage from `.husky/post-rewrite` after `rebase` or `amend`, with a script such as `changelog --non-interactive --ci --remap-refs`.

## Husky and CI

Use `--non-interactive` (and usually `--ci`) so the CLI never waits for an interactive menu when no phases are passed:

```bash
changelog --non-interactive --ci --validate --generate
```

Optional: `--no-color`, `--quiet`, or `--json` for a single machine-readable summary line on stdout.

## Interactive menu

Running `changelog` with no phase flags in a TTY opens a short menu (powered by Clack) to pick a common workflow.
