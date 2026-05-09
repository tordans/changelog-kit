import type { ChangelogRegistry } from '../schemas'
import type { ChangelogKitConfig } from './config'
import { resolveConfig } from './config'
import { readRegistry, writeRegistry } from './registry'

export type RemapPair = { oldHash: string; newHash: string }

export type RegistryRemapStats = {
  remappedRefCount: number
  touchedEntryCount: number
}

function isHexOid(token: string): boolean {
  return token.length > 0 && /^[0-9a-f]+$/i.test(token)
}

/**
 * Parses `git` post-rewrite stdin: each line is `<old-oid> <new-oid>` with an optional third column (ignored).
 * Invalid lines are skipped; warnings describe skipped lines for logging.
 */
export function parsePostRewriteStdin(text: string): { pairs: RemapPair[]; warnings: string[] } {
  const pairs: RemapPair[] = []
  const warnings: string[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? ''
    if (!line) continue
    const parts = line.split(/\s+/).filter(Boolean)
    const oldRaw = parts[0]
    const newRaw = parts[1]
    if (!oldRaw || !newRaw) {
      warnings.push(`post-rewrite line ${i + 1}: expected two oid tokens, skipping`)
      continue
    }
    if (!isHexOid(oldRaw) || !isHexOid(newRaw)) {
      warnings.push(`post-rewrite line ${i + 1}: non-hex oid token(s), skipping`)
      continue
    }
    pairs.push({
      oldHash: oldRaw.toLowerCase(),
      newHash: newRaw.toLowerCase(),
    })
  }
  return { pairs, warnings }
}

function remapSingleRef(ref: string, pairs: RemapPair[]): string | null {
  for (const { oldHash, newHash } of pairs) {
    if (!oldHash.startsWith(ref)) continue
    const newPrefix = newHash.slice(0, ref.length)
    if (ref === newPrefix) return null
    return newPrefix
  }
  return null
}

function dedupeRefsInOrder(refs: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of refs) {
    if (seen.has(r)) continue
    seen.add(r)
    out.push(r)
  }
  return out
}

/**
 * Rewrites registry `refs` using post-rewrite oid pairs: for each ref, if some `oldHash` starts with that ref
 * (prefix match for short or full stored refs), replace with `newHash` truncated to the same length.
 * Dedupes refs per entry after substitution (squash collapse). Mutates `registry` in place.
 */
export function remapRegistryRefs(
  registry: ChangelogRegistry,
  pairs: RemapPair[],
): RegistryRemapStats {
  let remappedRefCount = 0
  let touchedEntryCount = 0

  for (const entry of registry.entries) {
    const prevRefs = [...entry.refs]
    const nextRefs = entry.refs.map((ref) => {
      const mapped = remapSingleRef(ref, pairs)
      if (mapped == null) return ref
      remappedRefCount += 1
      return mapped
    })
    entry.refs = dedupeRefsInOrder(nextRefs)
    const changed =
      prevRefs.length !== entry.refs.length || prevRefs.some((r, idx) => r !== entry.refs[idx])
    if (changed) touchedEntryCount += 1
  }

  return { remappedRefCount, touchedEntryCount }
}

/**
 * Reads the registry, applies ref remaps from post-rewrite pairs, and persists only when refs changed.
 */
export async function runRegistryRemapAndPersist(
  projectRoot: string,
  pairs: RemapPair[],
  config?: ChangelogKitConfig,
): Promise<RegistryRemapStats> {
  const resolvedConfig = resolveConfig(config)
  const registry = await readRegistry(projectRoot, resolvedConfig)
  const stats = remapRegistryRefs(registry, pairs)
  if (stats.remappedRefCount > 0) {
    await writeRegistry(projectRoot, registry, resolvedConfig)
  }
  return stats
}
