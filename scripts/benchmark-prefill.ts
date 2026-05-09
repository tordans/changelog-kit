/**
 * Wall-clock benchmark for `prefillChangelog` against the enclosing git checkout.
 *
 * Writes a disposable empty registry so this repo works without committing
 * `changelog.registry.yaml`. Before/after: checkout the parent commit or use hyperfine:
 * `hyperfine "bun run bench:prefill"`.
 */
import { unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

import { prefillChangelog } from '../src/core/index.ts'

/** Matches how consumer CLIs behave: timings are relative to the shell cwd. */
const cwd = process.cwd()

const benchRel = `.changelog-registry.bench.${process.pid}.${Date.now()}.yaml`
const benchAbs = path.join(cwd, benchRel)

await writeFile(benchAbs, 'entries: []\n', 'utf8')
const t0 = performance.now()
try {
  await prefillChangelog(cwd, { registryPath: benchRel })
} finally {
  await unlink(benchAbs).catch(() => {
    /* ignore */
  })
}
const ms = performance.now() - t0
console.log(`prefillChangelog: ${ms.toFixed(1)} ms (cwd=${cwd})`)
