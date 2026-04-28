import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { changelogRegistrySchema, type ChangelogRegistry } from '../schemas'
import type { ChangelogKitResolvedConfig } from './config'
import { resolveConfig } from './config'

export async function readRegistry(
  projectRoot: string,
  config?: ChangelogKitResolvedConfig,
): Promise<ChangelogRegistry> {
  const resolved = config ?? resolveConfig()
  const abs = path.join(projectRoot, resolved.registryPath)
  const text = await readFile(abs, 'utf8')
  const parsed = (await import('yaml')).parse(text)
  return changelogRegistrySchema.parse(parsed)
}

export async function writeRegistry(
  projectRoot: string,
  registry: ChangelogRegistry,
  config?: ChangelogKitResolvedConfig,
): Promise<void> {
  const resolved = config ?? resolveConfig()
  const abs = path.join(projectRoot, resolved.registryPath)
  await mkdir(path.dirname(abs), { recursive: true })
  const lines: string[] = ['entries:']
  for (const entry of registry.entries) {
    lines.push('  - refs:')
    for (const ref of entry.refs) {
      lines.push(`      - '${ref.replaceAll("'", "''")}'`)
    }
    if (entry.hide) {
      lines.push('    hide: true')
      continue
    }
    lines.push('    descriptionMd: |')
    for (const line of entry.descriptionMd.split('\n')) {
      lines.push(`      ${line}`)
    }
  }
  const yaml = `${lines.join('\n')}\n`
  await writeFile(abs, yaml, 'utf8')
}
