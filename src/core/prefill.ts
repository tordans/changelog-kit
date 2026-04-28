import type { ChangelogRegistryEntry } from '../schemas'
import type { ChangelogKitConfig } from './config'
import { resolveConfig } from './config'
import { isChangelogOnlyCommit, isChangelogOptOutCommit, shortHash, sliceCommitsSinceAnchor } from './changelog'
import { listFirstParentHeadHistory, readCommitInfo, resolveCommitRef } from './git'
import { readRegistry, writeRegistry } from './registry'

const HIDE_TERMS = ['chore', 'lint', 'autoformat']
const VISIBLE_HINT_TERMS = ['feature', 'improve']

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
  skippedChangelogOnlyCount: number
  skippedOptOutCount: number
  anchorHash: string | null
}

export async function prefillChangelog(
  projectRoot: string,
  config?: ChangelogKitConfig,
): Promise<PrefillResult> {
  const resolvedConfig = resolveConfig(config)
  const registry = await readRegistry(projectRoot, resolvedConfig)
  const existingRefs = registry.entries.flatMap((entry) => entry.refs)
  const registeredHashes = new Set<string>()
  for (const ref of existingRefs) {
    const resolved = await resolveCommitRef(projectRoot, ref)
    if (resolved.hash) {
      registeredHashes.add(resolved.hash)
    }
  }

  const history = await listFirstParentHeadHistory(projectRoot)
  const { anchorHash, commitsSinceAnchor } = sliceCommitsSinceAnchor(history, registeredHashes)
  const missingCommits = commitsSinceAnchor.filter((hash) => !registeredHashes.has(hash))
  const orderedMissing = [...missingCommits].reverse()
  const missingNonChangelogCommits: string[] = []
  let skippedChangelogOnlyCount = 0
  let skippedOptOutCount = 0

  for (const hash of orderedMissing) {
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

  const addedEntries: ChangelogRegistryEntry[] = []
  for (const hash of missingNonChangelogCommits) {
    const commit = await readCommitInfo(projectRoot, hash)
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

  if (addedEntries.length > 0) {
    await writeRegistry(projectRoot, registry, resolvedConfig)
  }

  return {
    addedEntries,
    skippedChangelogOnlyCount,
    skippedOptOutCount,
    anchorHash,
  }
}
