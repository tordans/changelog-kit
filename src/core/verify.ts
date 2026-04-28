import {
  isChangelogOnlyCommit,
  isChangelogOptOutCommit,
  shortHash,
  sliceCommitsSinceAnchor,
} from './changelog'
import type { ChangelogKitConfig } from './config'
import { resolveConfig } from './config'
import { listFirstParentHeadHistory, readCommitInfo, resolveCommitRef } from './git'
import { readRegistry } from './registry'

type ResolvedRefRow = {
  entryIndex: number
  inputRef: string
  resolvedHash: string | null
}

export type VerifyResult = {
  checkedNonChangelogCount: number
  skippedChangelogOnlyCount: number
  skippedOptOutCount: number
  anchorHash: string | null
}

export async function verifyChangelog(
  projectRoot: string,
  config?: ChangelogKitConfig,
): Promise<VerifyResult> {
  const resolvedConfig = resolveConfig(config)
  const registry = await readRegistry(projectRoot, resolvedConfig)

  const resolvedRows: ResolvedRefRow[] = []
  for (let entryIndex = 0; entryIndex < registry.entries.length; entryIndex += 1) {
    const entry = registry.entries[entryIndex]
    for (const ref of entry.refs) {
      const resolved = await resolveCommitRef(projectRoot, ref)
      resolvedRows.push({
        entryIndex,
        inputRef: ref,
        resolvedHash: resolved.hash,
      })
    }
  }

  const invalidRefs = resolvedRows.filter((row) => row.resolvedHash === null)
  if (invalidRefs.length > 0) {
    const list = invalidRefs
      .map((row) => `entry #${row.entryIndex + 1}: ${row.inputRef}`)
      .join('\n')
    throw new Error(`[changelog:verify] Invalid refs found in changelog registry:\n${list}`)
  }

  const byHash = new Map<string, ResolvedRefRow[]>()
  for (const row of resolvedRows) {
    const hash = row.resolvedHash
    if (!hash) continue
    const list = byHash.get(hash) ?? []
    list.push(row)
    byHash.set(hash, list)
  }

  const duplicateHashes = Array.from(byHash.entries()).filter(([, rows]) => rows.length > 1)
  if (duplicateHashes.length > 0) {
    const list = duplicateHashes
      .map(([hash, rows]) => {
        const locations = rows
          .map((row) => `entry #${row.entryIndex + 1} (${row.inputRef})`)
          .join(', ')
        return `- ${shortHash(hash)} appears multiple times: ${locations}`
      })
      .join('\n')
    throw new Error(`[changelog:verify] Duplicate commit coverage found:\n${list}`)
  }

  const registeredHashes = new Set(Array.from(byHash.keys()))
  const firstParentHistory = await listFirstParentHeadHistory(projectRoot)
  const { anchorHash, commitsSinceAnchor } = sliceCommitsSinceAnchor(
    firstParentHistory,
    registeredHashes,
  )

  const missingCommits = commitsSinceAnchor.filter((hash) => !registeredHashes.has(hash))
  const missingNonChangelogCommits: string[] = []
  let skippedChangelogOnlyCount = 0
  let skippedOptOutCount = 0
  for (const hash of missingCommits) {
    if (await isChangelogOnlyCommit(projectRoot, hash, resolvedConfig)) {
      skippedChangelogOnlyCount += 1
      continue
    }
    if (await isChangelogOptOutCommit(projectRoot, hash)) {
      skippedOptOutCount += 1
      continue
    }
    missingNonChangelogCommits.push(hash)
  }

  if (missingNonChangelogCommits.length > 0) {
    const commits = await Promise.all(
      missingNonChangelogCommits.map(async (hash) => {
        const commit = await readCommitInfo(projectRoot, hash)
        return `${shortHash(hash)} ${commit.subject}`
      }),
    )
    const anchorLine = anchorHash
      ? `[changelog:verify] Anchor commit: ${shortHash(anchorHash)}.`
      : '[changelog:verify] No anchor commit found in registry; checked from HEAD back.'
    throw new Error(
      [
        '[changelog:verify] Missing commits in changelog registry:',
        ...commits.map((line) => `- ${line}`),
        anchorLine,
      ].join('\n'),
    )
  }

  const checkedCount = commitsSinceAnchor.length
  return {
    checkedNonChangelogCount: checkedCount - skippedChangelogOnlyCount - skippedOptOutCount,
    skippedChangelogOnlyCount,
    skippedOptOutCount,
    anchorHash,
  }
}
