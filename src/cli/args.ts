import type { ChangelogKitConfig } from '../core'

type RawArgMap = Map<string, string[]>

function readRawArgs(argv: string[]): RawArgMap {
  const map = new Map<string, string[]>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      continue
    }
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      const list = map.get(key) ?? []
      list.push('true')
      map.set(key, list)
      continue
    }
    const list = map.get(key) ?? []
    list.push(next)
    map.set(key, list)
    i += 1
  }
  return map
}

export type CliContext = {
  projectRoot: string
  config: ChangelogKitConfig
}

export function parseCliContext(argv: string[]): CliContext {
  const args = readRawArgs(argv)
  const projectRoot = args.get('project-root')?.at(-1) ?? process.cwd()

  const config: ChangelogKitConfig = {
    registryPath: args.get('registry-path')?.at(-1),
    outputJsonPath: args.get('output-json-path')?.at(-1),
    outputMarkdownPath: args.get('output-markdown-path')?.at(-1),
    changelogOnlyPaths: args.get('changelog-only-path'),
  }

  return { projectRoot, config }
}
