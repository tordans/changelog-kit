import type { ChangelogRegistryEntry } from '../schemas'
import {
  isChangelogOnlyFromPaths,
  isIgnoredFromCommit,
  isChangelogOptOutFromCommit,
  shortHash,
  sliceCommitsSinceAnchor,
} from './changelog'
import type { ChangelogKitConfig } from './config'
import { resolveConfig } from './config'
import type { CommitInfo } from './git'
import {
  listCommitsChangedPathsBatch,
  listCommitChangedPaths,
  listFirstParentHeadHistory,
  readCommitsInfoBatch,
  readCommitInfo,
  resolveCommitRef,
} from './git'
import { readRegistry, writeRegistry } from './registry'

const HIDE_TERMS = ['chore', 'lint', 'autoformat']
const VISIBLE_HINT_TERMS = ['feature', 'improve']

/** Balance fewer git subprocesses vs stdout size / parse cost. */
const PREFILTER_BATCH_SIZE = 128

function shouldHideFromSubject(subject: string): boolean {
  const lower = subject.toLowerCase()
  const hasHiddenTerm = HIDE_TERMS.some((term) => lower.includes(term))
  const hasVisibleHint = VISIBLE_HINT_TERMS.some((term) => lower.includes(term))
  return hasHiddenTerm && !hasVisibleHint
}

function draftDescription(subject: string, body: string): string {
  const cleanSubject = subject.trim()
  const bodyParagraph = body
    .split('\n\n')
    .map((part) => part.trim())
    .find(Boolean)
  if (!bodyParagraph) return cleanSubject
  const firstLine = bodyParagraph
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  if (!firstLine) return cleanSubject
  if (firstLine.toLowerCase() === cleanSubject.toLowerCase()) return cleanSubject
  return `${cleanSubject}\n${firstLine}`
}

export type PrefillResult = {
  addedEntries: ChangelogRegistryEntry[]
  removedStaleRefCount: number
  removedEmptyEntryCount: number
  skippedChangelogOnlyCount: number
  skippedIgnoredCount: number
  skippedOptOutCount: number
  anchorHash: string | null
}

export async function prefillChangelog(
  projectRoot: string,
  config?: ChangelogKitConfig,
): Promise<PrefillResult> {
  const resolvedConfig = resolveConfig(config)
  const registry = await readRegistry(projectRoot, resolvedConfig)
  const history = await listFirstParentHeadHistory(projectRoot)
  const historySet = new Set(history)
  let removedStaleRefCount = 0

  const refResolveCache = new Map<string, { ref: string; hash: string | null }>()
  const resolveRefCached = async (ref: string) => {
    const hit = refResolveCache.get(ref)
    if (hit) return hit
    const r = await resolveCommitRef(projectRoot, ref)
    refResolveCache.set(ref, r)
    return r
  }

  const entryCountBeforeCleanup = registry.entries.length
  const cleanedEntries = await Promise.all(
    registry.entries.map(async (entry) => {
      const keepRefs: string[] = []
      for (const ref of entry.refs) {
        const resolved = await resolveRefCached(ref)
        if (!resolved.hash || !historySet.has(resolved.hash)) {
          removedStaleRefCount += 1
          continue
        }
        keepRefs.push(ref)
      }
      return {
        ...entry,
        refs: keepRefs,
      }
    }),
  )
  registry.entries = cleanedEntries.filter((entry) => entry.refs.length > 0)
  const removedEmptyEntryCount = entryCountBeforeCleanup - registry.entries.length
  const existingRefs = registry.entries.flatMap((entry) => entry.refs)
  const registeredHashes = new Set<string>()
  for (const ref of existingRefs) {
    const resolved = await resolveRefCached(ref)
    if (resolved.hash) {
      registeredHashes.add(resolved.hash)
    }
  }

  const { anchorHash, commitsSinceAnchor } = sliceCommitsSinceAnchor(history, registeredHashes)
  const missingCommits = commitsSinceAnchor.filter((hash) => !registeredHashes.has(hash))
  const orderedMissing = [...missingCommits].reverse()
  const missingNonChangelogCommits: string[] = []
  let skippedChangelogOnlyCount = 0
  let skippedIgnoredCount = 0
  let skippedOptOutCount = 0

  const commitInfoCache = new Map<string, CommitInfo>()

  for (let offset = 0; offset < orderedMissing.length; offset += PREFILTER_BATCH_SIZE) {
    const slice = orderedMissing.slice(offset, offset + PREFILTER_BATCH_SIZE)
    const uniq = [...new Set(slice)]
    const [pathsByHash, infoByHash] = await Promise.all([
      listCommitsChangedPathsBatch(projectRoot, uniq),
      readCommitsInfoBatch(projectRoot, uniq),
    ])

    for (const hash of slice) {
      let paths = pathsByHash.get(hash)
      if (paths === undefined) {
        paths = await listCommitChangedPaths(projectRoot, hash)
      }

      if (isChangelogOnlyFromPaths(paths, resolvedConfig)) {
        skippedChangelogOnlyCount += 1
        continue
      }

      let commit = infoByHash.get(hash)
      if (!commit) {
        commit = await readCommitInfo(projectRoot, hash)
      }

      if (isIgnoredFromCommit(commit, resolvedConfig)) {
        skippedIgnoredCount += 1
        continue
      }
      if (isChangelogOptOutFromCommit(commit)) {
        skippedOptOutCount += 1
        continue
      }

      const canonicalHash = commit.hash
      commitInfoCache.set(canonicalHash, commit)
      missingNonChangelogCommits.push(canonicalHash)
    }
  }

  const addedEntries: ChangelogRegistryEntry[] = []
  for (const hash of missingNonChangelogCommits) {
    const commit = commitInfoCache.get(hash) ?? (await readCommitInfo(projectRoot, hash))
    if (shouldHideFromSubject(commit.subject)) {
      const entry: ChangelogRegistryEntry = {
        refs: [shortHash(commit.hash)],
        hide: true,
      }
      registry.entries.push(entry)
      addedEntries.push(entry)
      continue
    }
    const entry: ChangelogRegistryEntry = {
      refs: [shortHash(commit.hash)],
      hide: false,
      descriptionMd: draftDescription(commit.subject, commit.body),
    }
    registry.entries.push(entry)
    addedEntries.push(entry)
  }

  if (addedEntries.length > 0 || removedStaleRefCount > 0 || removedEmptyEntryCount > 0) {
    await writeRegistry(projectRoot, registry, resolvedConfig)
  }

  return {
    addedEntries,
    removedStaleRefCount,
    removedEmptyEntryCount,
    skippedChangelogOnlyCount,
    skippedIgnoredCount,
    skippedOptOutCount,
    anchorHash,
  }
}
