---
name: changelog-update
description: Update the project changelog registry from recent git commits. Use when the user asks to add missing changelog refs, draft descriptions, translate entries to German, group related commits, or mark non-user-facing work as hidden.
license: MIT
---

# Changelog Update

Use this short workflow:

1. Run `changelog --cleanup --prefill` (or `changelog --prefill`, which runs cleanup first internally).
2. Run `changelog --validate` and read missing refs from output.
3. Group related refs into one registry entry where they describe one change.
4. Keep visible entries in German, short and user-facing.
5. Mark technical-only entries with `hide: true` and remove `descriptionMd`.
6. Run `changelog --generate` after `validate` passes (or `changelog --validate --generate`).
7. If paths differ from defaults, repeat commands with CLI flags such as `--registry-path`, `--output-markdown-path`, and `--output-json-path`.
8. Commit generated changelog files and registry updates with `git commit -m "Update changelog" -m "hide changelog"` to prevent changelog-loop commits.

Rules:

- Registry file default: `changelog.registry.yaml` (override via config or `--registry-path`).
- Visible entry shape: `refs` + `descriptionMd`.
- Hidden entry shape: `refs` + `hide: true` (no description).
