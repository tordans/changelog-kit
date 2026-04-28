import { shortHash, prefillChangelog } from '../core'
import { parseCliContext } from './args'

async function main() {
  const { projectRoot, config } = parseCliContext(process.argv.slice(2))
  const result = await prefillChangelog(projectRoot, config)

  if (result.addedEntries.length === 0) {
    console.info('[changelog-kit:prefill] No missing commits. Registry already covers this range.')
    if (result.anchorHash) {
      console.info(`[changelog-kit:prefill] Anchor ref found at ${shortHash(result.anchorHash)}.`)
    }
  } else {
    console.info(`[changelog-kit:prefill] Added ${result.addedEntries.length} entries.`)
  }

  if (result.skippedChangelogOnlyCount > 0) {
    console.info(
      `[changelog-kit:prefill] Skipped ${result.skippedChangelogOnlyCount} changelog-only commits.`,
    )
  }
  if (result.skippedOptOutCount > 0) {
    console.info(
      `[changelog-kit:prefill] Skipped ${result.skippedOptOutCount} commits with changelog opt-out terms (no-changelog / no changelog / hide changelog).`,
    )
  }
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
