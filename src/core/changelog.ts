import type { ChangelogKitResolvedConfig } from './config'
import { normalizePathForGit, resolveConfig } from './config'
import { listCommitChangedPaths, readCommitInfo } from './git'

const CHANGELOG_OPTOUT_PATTERN = /\b(?:no[-\s]+changelog|hide\s+changelog)\b/i

export function isChangelogOptOutText(text: string): boolean {
  return CHANGELOG_OPTOUT_PATTERN.test(text)
}

export function isIgnoredByTerms(text: string, ignoredTerms: string[]): boolean {
  if (ignoredTerms.length === 0) return false
  const lower = text.toLowerCase()
  return ignoredTerms.some((term) => lower.includes(term))
}

export async function isChangelogOptOutCommit(projectRoot: string, ref: string): Promise<boolean> {
  const commit = await readCommitInfo(projectRoot, ref)
  return isChangelogOptOutFromCommit(commit)
}

/** Prefer this when metadata is already loaded (avoids extra `git show` calls). */
export function isChangelogOptOutFromCommit(commit: { subject: string; body: string }): boolean {
  const combined = `${commit.subject}\n${commit.body}`
  return isChangelogOptOutText(combined)
}

export async function isIgnoredCommit(
  projectRoot: string,
  ref: string,
  config?: ChangelogKitResolvedConfig,
): Promise<boolean> {
  const resolved = config ?? resolveConfig()
  const commit = await readCommitInfo(projectRoot, ref)
  return isIgnoredFromCommit(commit, resolved)
}

export function isIgnoredFromCommit(
  commit: { subject: string; body: string },
  config: ChangelogKitResolvedConfig,
): boolean {
  if (config.ignoredCommitTerms.length === 0) return false
  const combined = `${commit.subject}\n${commit.body}`
  return isIgnoredByTerms(combined, config.ignoredCommitTerms)
}

export function isChangelogOnlyPath(relPath: string, config?: ChangelogKitResolvedConfig): boolean {
  const resolved = config ?? resolveConfig()
  return resolved.changelogOnlyPaths.has(normalizePathForGit(relPath))
}

export async function isChangelogOnlyCommit(
  projectRoot: string,
  ref: string,
  config?: ChangelogKitResolvedConfig,
): Promise<boolean> {
  const paths = await listCommitChangedPaths(projectRoot, ref)
  return isChangelogOnlyFromPaths(paths, config ?? resolveConfig())
}

export function isChangelogOnlyFromPaths(
  paths: string[],
  config: ChangelogKitResolvedConfig,
): boolean {
  if (paths.length === 0) return false
  return paths.every((p) => isChangelogOnlyPath(p, config))
}

export function monthKeyFromIsoDate(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.valueOf())) {
    throw new Error(`Invalid ISO date "${isoDate}".`)
  }
  return isoDate.slice(0, 7)
}

export type CoverageSlice = {
  anchorHash: string | null
  commitsSinceAnchor: string[]
}

export function sliceCommitsSinceAnchor(
  firstParentHeadHistory: string[],
  registeredHashes: Set<string>,
): CoverageSlice {
  const anchorIndex = firstParentHeadHistory.findIndex((hash) => registeredHashes.has(hash))
  if (anchorIndex === -1) {
    return {
      anchorHash: null,
      commitsSinceAnchor: firstParentHeadHistory,
    }
  }
  return {
    anchorHash: firstParentHeadHistory[anchorIndex] ?? null,
    commitsSinceAnchor: firstParentHeadHistory.slice(0, anchorIndex),
  }
}

export function shortHash(hash: string): string {
  return hash.slice(0, 7)
}
