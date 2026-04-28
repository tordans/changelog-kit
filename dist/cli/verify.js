#!/usr/bin/env node
import { parseCliContext, verifyChangelog, shortHash } from '../chunk-6NJQY5O5.js';

// src/cli/verify.ts
async function main() {
  const { projectRoot, config } = parseCliContext(process.argv.slice(2));
  const result = await verifyChangelog(projectRoot, config);
  if (result.anchorHash) {
    console.info(
      `[changelog-kit:verify] OK. Checked ${result.checkedNonChangelogCount} commits since ${shortHash(result.anchorHash)} (${result.skippedChangelogOnlyCount} changelog-only commits skipped, ${result.skippedIgnoredCount} ignored commits skipped, ${result.skippedOptOutCount} opt-out commits skipped).`
    );
    return;
  }
  console.info(
    `[changelog-kit:verify] OK. Checked ${result.checkedNonChangelogCount} commits from HEAD (${result.skippedChangelogOnlyCount} changelog-only commits skipped, ${result.skippedIgnoredCount} ignored commits skipped, ${result.skippedOptOutCount} opt-out commits skipped).`
  );
}
void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
//# sourceMappingURL=verify.js.map
//# sourceMappingURL=verify.js.map