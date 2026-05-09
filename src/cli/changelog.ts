import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { intro, isCancel, outro, select } from '@clack/prompts'
import * as p from '@clack/prompts'

import {
  buildChangelog,
  prefillChangelog,
  resolveConfig,
  runRegistryCleanupAndPersist,
  shortHash,
  verifyChangelog,
} from '../core'
import {
  anyPhaseSelected,
  canonicalPhaseList,
  parseChangelogCliArgv,
  type ChangelogPhase,
  type PhaseSelection,
} from './args'

function readPackageVersion(): string {
  const pkgPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'package.json',
  )
  const raw = readFileSync(pkgPath, 'utf8')
  return (JSON.parse(raw) as { version: string }).version
}

function printHelp(): void {
  console.log(`changelog-kit — unified changelog CLI

Usage:
  changelog [flags]
  changelog --cleanup --prefill --validate --generate

Phase flags (compose any subset; execution order is always):
  cleanup → prefill → validate → generate (flag order does not matter)

  --cleanup              Remove stale refs and empty registry entries
  --prefill              Add draft entries for missing commits (includes cleanup unless --cleanup ran earlier in the same run)
  --validate             Verify registry coverage and consistency
  --generate             Write CHANGELOG.md and changelog JSON

Aliases:
  --prefill-cleanup      Same as --cleanup --prefill
  --validate-generate    Same as --validate --generate

Config (same as before):
  --project-root <dir>
  --registry-path <file>
  --output-json-path <file>
  --output-markdown-path <file>
  --changelog-only-path <path>   (repeatable)
  --ignore-commit-term <term>      (repeatable)

Runtime:
  --non-interactive      Error if no phases are selected (no prompts)
  --ci                   Implies stable, non-interactive behavior
  --quiet                Less console output (human mode only)
  --json                 Print one JSON summary object to stdout at the end
  --no-color             Disable ANSI colors
  --help
  --version

Examples:
  changelog --validate
  changelog --validate --generate
  changelog --cleanup --prefill --validate
  changelog --non-interactive --ci --validate --generate
`)
}

function mapMenuChoiceToPhases(choice: string): PhaseSelection {
  switch (choice) {
    case 'prefill+cleanup':
      return { cleanup: true, prefill: true, validate: false, generate: false }
    case 'validate+generate':
      return { cleanup: false, prefill: false, validate: true, generate: true }
    case 'validate+cleanup':
      return { cleanup: true, prefill: false, validate: true, generate: false }
    case 'cleanup-only':
      return { cleanup: true, prefill: false, validate: false, generate: false }
    default:
      return { cleanup: false, prefill: false, validate: false, generate: false }
  }
}

async function main(): Promise<void> {
  let parsed
  try {
    parsed = parseChangelogCliArgv(process.argv.slice(2))
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
    return
  }

  const { projectRoot, config, phases, runtime } = parsed

  if (runtime.noColor) {
    process.env['NO_COLOR'] = '1'
    process.env['FORCE_COLOR'] = '0'
  }

  if (runtime.help) {
    printHelp()
    return
  }
  if (runtime.version) {
    console.log(readPackageVersion())
    return
  }

  const mustAvoidPrompts = runtime.nonInteractive || runtime.ci
  const canPrompt = process.stdin.isTTY && process.stdout.isTTY && !mustAvoidPrompts

  let selectedPhases: PhaseSelection = { ...phases }
  let usedInteractiveMenu = false

  if (!anyPhaseSelected(selectedPhases)) {
    if (!canPrompt) {
      console.error(
        'changelog: no phases selected. Pass --cleanup, --prefill, --validate, and/or --generate (see changelog --help).',
      )
      process.exit(1)
      return
    }
    usedInteractiveMenu = true
    intro('changelog-kit')
    const choice = await select({
      message: 'What should changelog-kit run?',
      options: [
        {
          value: 'prefill+cleanup',
          label: 'Prefill + cleanup',
          hint: 'clean registry and draft missing entries',
        },
        {
          value: 'validate+generate',
          label: 'Validate + generate',
          hint: 'verify registry then build outputs',
        },
        {
          value: 'validate+cleanup',
          label: 'Validate + cleanup',
          hint: 'verify then prune stale refs',
        },
        {
          value: 'cleanup-only',
          label: 'Cleanup only',
          hint: 'remove stale refs and empty entries',
        },
      ],
    })
    if (isCancel(choice)) {
      process.exit(0)
      return
    }
    selectedPhases = mapMenuChoiceToPhases(choice)
  }

  const order = canonicalPhaseList(selectedPhases)
  const ranCleanupThisRun = order.includes('cleanup')

  const humanLog = (msg: string): void => {
    if (runtime.json) return
    if (runtime.quiet) return
    p.log.info(msg)
  }

  const summary: {
    phases: ChangelogPhase[]
    version: string
    steps: Record<string, Record<string, unknown>>
  } = {
    phases: order,
    version: readPackageVersion(),
    steps: {},
  }

  const resolved = resolveConfig(config)
  const registryAbsPath = path.join(projectRoot, resolved.registryPath)

  const runPhase = async (phase: ChangelogPhase): Promise<void> => {
    if (phase === 'cleanup') {
      const stats = await runRegistryCleanupAndPersist(projectRoot, config)
      summary.steps.cleanup = {
        removedStaleRefCount: stats.removedStaleRefCount,
        removedEmptyEntryCount: stats.removedEmptyEntryCount,
      }
      humanLog(`[changelog-kit:cleanup] Registry file: ${registryAbsPath}`)
      if (stats.removedStaleRefCount > 0) {
        humanLog(`[changelog-kit:cleanup] Removed ${stats.removedStaleRefCount} stale refs.`)
      }
      if (stats.removedEmptyEntryCount > 0) {
        humanLog(
          `[changelog-kit:cleanup] Removed ${stats.removedEmptyEntryCount} registry entries that became empty.`,
        )
      }
      if (stats.removedStaleRefCount === 0 && stats.removedEmptyEntryCount === 0) {
        humanLog('[changelog-kit:cleanup] Registry already clean (no stale refs or empty entries).')
      }
      return
    }

    if (phase === 'prefill') {
      const result = await prefillChangelog(projectRoot, config, {
        skipInitialCleanup: ranCleanupThisRun,
      })
      summary.steps.prefill = {
        addedEntries: result.addedEntries.length,
        removedStaleRefCount: result.removedStaleRefCount,
        removedEmptyEntryCount: result.removedEmptyEntryCount,
        skippedChangelogOnlyCount: result.skippedChangelogOnlyCount,
        skippedIgnoredCount: result.skippedIgnoredCount,
        skippedOptOutCount: result.skippedOptOutCount,
        anchorHash: result.anchorHash,
      }
      humanLog(`[changelog-kit:prefill] Registry file: ${registryAbsPath}`)
      if (result.addedEntries.length === 0) {
        humanLog('[changelog-kit:prefill] No missing commits. Registry already covers this range.')
        if (result.anchorHash) {
          humanLog(`[changelog-kit:prefill] Anchor ref found at ${shortHash(result.anchorHash)}.`)
        }
      } else {
        humanLog(`[changelog-kit:prefill] Added ${result.addedEntries.length} entries.`)
      }
      if (result.skippedChangelogOnlyCount > 0) {
        humanLog(
          `[changelog-kit:prefill] Skipped ${result.skippedChangelogOnlyCount} changelog-only commits.`,
        )
      }
      if (result.skippedIgnoredCount > 0) {
        humanLog(
          `[changelog-kit:prefill] Skipped ${result.skippedIgnoredCount} commits matching configured ignore terms.`,
        )
      }
      if (result.skippedOptOutCount > 0) {
        humanLog(
          `[changelog-kit:prefill] Skipped ${result.skippedOptOutCount} commits with changelog opt-out terms (no-changelog / no changelog / hide changelog).`,
        )
      }
      if (result.removedStaleRefCount > 0) {
        humanLog(`[changelog-kit:prefill] Removed ${result.removedStaleRefCount} stale refs.`)
      }
      if (result.removedEmptyEntryCount > 0) {
        humanLog(
          `[changelog-kit:prefill] Removed ${result.removedEmptyEntryCount} registry entries that became empty.`,
        )
      }
      humanLog(
        '[changelog-kit:prefill] Next step: edit registry entries, then run changelog --validate --generate',
      )
      return
    }

    if (phase === 'validate') {
      const result = await verifyChangelog(projectRoot, config)
      summary.steps.validate = {
        checkedNonChangelogCount: result.checkedNonChangelogCount,
        skippedChangelogOnlyCount: result.skippedChangelogOnlyCount,
        skippedIgnoredCount: result.skippedIgnoredCount,
        skippedOptOutCount: result.skippedOptOutCount,
        anchorHash: result.anchorHash,
      }
      humanLog(`[changelog-kit:validate] Registry file: ${registryAbsPath}`)
      if (result.anchorHash) {
        humanLog(
          `[changelog-kit:validate] OK. Checked ${result.checkedNonChangelogCount} commits since ${shortHash(result.anchorHash)} (${result.skippedChangelogOnlyCount} changelog-only commits skipped, ${result.skippedIgnoredCount} ignored commits skipped, ${result.skippedOptOutCount} opt-out commits skipped).`,
        )
      } else {
        humanLog(
          `[changelog-kit:validate] OK. Checked ${result.checkedNonChangelogCount} commits from HEAD (${result.skippedChangelogOnlyCount} changelog-only commits skipped, ${result.skippedIgnoredCount} ignored commits skipped, ${result.skippedOptOutCount} opt-out commits skipped).`,
        )
      }
      return
    }

    if (phase === 'generate') {
      const { wroteJson } = await buildChangelog(projectRoot, config)
      summary.steps.generate = { wroteJson }
      humanLog(`[changelog-kit:generate] Registry file: ${registryAbsPath}`)
      humanLog(
        wroteJson
          ? `[changelog-kit:generate] Wrote ${resolved.outputMarkdownPath} and ${resolved.outputJsonPath}.`
          : `[changelog-kit:generate] Wrote ${resolved.outputMarkdownPath}; kept ${resolved.outputJsonPath} unchanged (timestamp-only diff).`,
      )
    }
  }

  for (const phase of order) {
    await runPhase(phase)
  }

  if (runtime.json) {
    console.log(JSON.stringify(summary))
  } else if (usedInteractiveMenu) {
    outro('Done.')
  }
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
