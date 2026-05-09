#!/usr/bin/env node
import { parseCliContext, resolveConfig, prefillChangelog, shortHash } from '../chunk-3ZRK5GL6.js';
import path from 'path';
import { styleText } from 'util';

async function main() {
  const { projectRoot, config } = parseCliContext(process.argv.slice(2));
  const resolved = resolveConfig(config);
  const registryAbsPath = path.join(projectRoot, resolved.registryPath);
  const result = await prefillChangelog(projectRoot, config);
  if (result.addedEntries.length === 0) {
    console.info("[changelog-kit:prefill] No missing commits. Registry already covers this range.");
    if (result.anchorHash) {
      console.info(`[changelog-kit:prefill] Anchor ref found at ${shortHash(result.anchorHash)}.`);
    }
  } else {
    console.info(`[changelog-kit:prefill] Added ${result.addedEntries.length} entries.`);
  }
  if (result.skippedChangelogOnlyCount > 0) {
    console.info(
      `[changelog-kit:prefill] Skipped ${result.skippedChangelogOnlyCount} changelog-only commits.`
    );
  }
  if (result.skippedIgnoredCount > 0) {
    console.info(
      `[changelog-kit:prefill] Skipped ${result.skippedIgnoredCount} commits matching configured ignore terms.`
    );
  }
  if (result.skippedOptOutCount > 0) {
    console.info(
      `[changelog-kit:prefill] Skipped ${result.skippedOptOutCount} commits with changelog opt-out terms (no-changelog / no changelog / hide changelog).`
    );
  }
  if (result.removedStaleRefCount > 0) {
    console.info(`[changelog-kit:prefill] Removed ${result.removedStaleRefCount} stale refs.`);
  }
  if (result.removedEmptyEntryCount > 0) {
    console.info(
      `[changelog-kit:prefill] Removed ${result.removedEmptyEntryCount} registry entries that became empty.`
    );
  }
  console.info(
    `[changelog-kit:prefill] Registry file: ${styleText(["bold", "cyan"], registryAbsPath)}`
  );
  console.info(
    "[changelog-kit:prefill] Next step: edit registry entries, then run: bun run changelog"
  );
}
void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
//# sourceMappingURL=prefill.js.map
//# sourceMappingURL=prefill.js.map