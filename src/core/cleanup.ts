import type { ChangelogRegistry } from '../schemas'
import type { ChangelogKitConfig } from './config'
import { resolveConfig } from './config'
import { listFirstParentHeadHistory, resolveCommitRef } from './git'
import { readRegistry, writeRegistry } from './registry'

export type ResolveCommitRef = (ref: string) => Promise<{ ref: string; hash: string | null }>

export type RegistryCleanupStats = {
  removedStaleRefCount: number
  removedEmptyEntryCount: number
}

/**
 * Removes refs that do not resolve or are outside first-parent HEAD history,
 * then drops entries with no refs. Mutates `registry` in place.
 */
export async function cleanupRegistryStaleRefs(
  projectRoot: string,
  registry: ChangelogRegistry,
  historySet: Set<string>,
  resolveRef: ResolveCommitRef,
): Promise<RegistryCleanupStats> {
  let removedStaleRefCount = 0
  const entryCountBeforeCleanup = registry.entries.length
  const cleanedEntries = await Promise.all(
    registry.entries.map(async (entry) => {
      const keepRefs: string[] = []
      for (const ref of entry.refs) {
        const resolved = await resolveRef(ref)
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
  return { removedStaleRefCount, removedEmptyEntryCount }
}

/**
 * Reads the registry, applies stale-ref / empty-entry cleanup, and persists when needed.
 */
export async function runRegistryCleanupAndPersist(
  projectRoot: string,
  config?: ChangelogKitConfig,
): Promise<RegistryCleanupStats> {
  const resolvedConfig = resolveConfig(config)
  const registry = await readRegistry(projectRoot, resolvedConfig)
  const history = await listFirstParentHeadHistory(projectRoot)
  const historySet = new Set(history)
  const refResolveCache = new Map<string, { ref: string; hash: string | null }>()
  const resolveRefCached: ResolveCommitRef = async (ref: string) => {
    const hit = refResolveCache.get(ref)
    if (hit) return hit
    const r = await resolveCommitRef(projectRoot, ref)
    refResolveCache.set(ref, r)
    return r
  }
  const stats = await cleanupRegistryStaleRefs(projectRoot, registry, historySet, resolveRefCached)
  if (stats.removedStaleRefCount > 0 || stats.removedEmptyEntryCount > 0) {
    await writeRegistry(projectRoot, registry, resolvedConfig)
  }
  return stats
}
