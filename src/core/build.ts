import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ChangelogFile } from '../schemas'
import { monthKeyFromIsoDate, shortHash } from './changelog'
import type { ChangelogKitConfig } from './config'
import { resolveConfig } from './config'
import { readCommitInfo, resolveCommitRef } from './git'
import { readRegistry } from './registry'

type RenderableEntry = {
  refs: string[]
  descriptionMd: string
  committedAtIso: string
  month: string
}

function normalizeMarkdownBody(markdown: string): string {
  return markdown.trim().replace(/\n{3,}/g, '\n\n')
}

function renderMarkdown(
  entriesByMonth: Map<string, RenderableEntry[]>,
  registryPath: string,
): string {
  const monthKeys = Array.from(entriesByMonth.keys()).sort((a, b) => b.localeCompare(a))
  const lines: string[] = []
  lines.push('# Changelog')
  lines.push('')
  lines.push(`Automatisch aus \`${registryPath}\` erzeugt.`)
  lines.push('')

  for (const month of monthKeys) {
    lines.push(`## ${month}`)
    lines.push('')
    const monthEntries = entriesByMonth.get(month) ?? []
    const sortedEntries = [...monthEntries].sort((a, b) =>
      b.committedAtIso.localeCompare(a.committedAtIso),
    )
    for (const entry of sortedEntries) {
      const refsText = entry.refs.map((ref) => `\`${shortHash(ref)}\``).join(', ')
      lines.push(`### ${refsText}`)
      lines.push('')
      lines.push(normalizeMarkdownBody(entry.descriptionMd))
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}

function normalizeGeneratedJsonForComparison(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as { generatedAt?: unknown } & Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    delete parsed.generatedAt
    return JSON.stringify(parsed)
  } catch {
    return null
  }
}

export async function buildChangelog(
  projectRoot: string,
  config?: ChangelogKitConfig,
): Promise<{ payload: ChangelogFile; wroteJson: boolean }> {
  const resolvedConfig = resolveConfig(config)
  const registry = await readRegistry(projectRoot, resolvedConfig)

  const renderable: RenderableEntry[] = []
  for (const entry of registry.entries) {
    if (entry.hide) continue
    const firstRef = entry.refs[0]
    const resolved = await resolveCommitRef(projectRoot, firstRef)
    if (!resolved.hash) {
      throw new Error(`Could not resolve first ref "${firstRef}" for visible changelog entry.`)
    }
    const commitInfo = await readCommitInfo(projectRoot, resolved.hash)
    renderable.push({
      refs: entry.refs,
      descriptionMd: entry.descriptionMd,
      committedAtIso: commitInfo.committedAtIso,
      month: monthKeyFromIsoDate(commitInfo.committedAtIso),
    })
  }

  const byMonth = new Map<string, RenderableEntry[]>()
  for (const entry of renderable) {
    const rows = byMonth.get(entry.month) ?? []
    rows.push(entry)
    byMonth.set(entry.month, rows)
  }

  const markdown = renderMarkdown(byMonth, resolvedConfig.registryPath)
  const changelogMdAbs = path.join(projectRoot, resolvedConfig.outputMarkdownPath)
  await writeFile(changelogMdAbs, markdown, 'utf8')

  const jsonAbs = path.join(projectRoot, resolvedConfig.outputJsonPath)
  await mkdir(path.dirname(jsonAbs), { recursive: true })
  const monthKeys = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a))
  const payload: ChangelogFile = {
    generatedAt: new Date().toISOString(),
    months: monthKeys.map((month) => {
      const entries = (byMonth.get(month) ?? [])
        .sort((a, b) => b.committedAtIso.localeCompare(a.committedAtIso))
        .map((entry) => ({
          refs: entry.refs,
          descriptionMd: normalizeMarkdownBody(entry.descriptionMd),
          committedAtIso: entry.committedAtIso,
          committedAtShort: entry.committedAtIso.slice(0, 10),
          refsDisplay: entry.refs.map((ref) => shortHash(ref)),
        }))
      return { month, entries }
    }),
  }

  const nextJsonText = `${JSON.stringify(payload, null, 2)}\n`
  let shouldWriteJson = true
  try {
    const existingJsonText = await readFile(jsonAbs, 'utf8')
    const existingNormalized = normalizeGeneratedJsonForComparison(existingJsonText)
    const nextNormalized = normalizeGeneratedJsonForComparison(nextJsonText)
    if (
      existingNormalized !== null &&
      nextNormalized !== null &&
      existingNormalized === nextNormalized
    ) {
      shouldWriteJson = false
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      throw error
    }
  }

  if (shouldWriteJson) {
    await writeFile(jsonAbs, nextJsonText, 'utf8')
  }

  return { payload, wroteJson: shouldWriteJson }
}
