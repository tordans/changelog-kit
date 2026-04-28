import type { ChangelogKitResolvedConfig } from './config'
import { normalizePathForGit, resolveConfig } from './config'
import { listCommitChangedPaths, readCommitInfo } from './git'

const CHANGELOG_OPTOUT_PATTERN = /\b(?:no[-\s]+changelog|hide\s+changelog)\b/i

export function isChangelogOptOutText(text: string): boolean {
  return CHANGELOG_OPTOUT_PATTERN.test(text)
}

export async function isChangelogOptOutCommit(projectRoot: string, ref: string): Promise<boolean> {
  const commit = await readCommitInfo(projectRoot, ref)
  const combined = `${commit.subject}\n${commit.body}`
  return isChangelogOptOutText(combined)
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
