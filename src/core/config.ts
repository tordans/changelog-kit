import path from 'node:path'

export type ChangelogKitConfig = {
  registryPath?: string
  outputMarkdownPath?: string
  outputJsonPath?: string
  changelogOnlyPaths?: string[]
}

export type ChangelogKitResolvedConfig = {
  registryPath: string
  outputMarkdownPath: string
  outputJsonPath: string
  changelogOnlyPaths: Set<string>
}

export const DEFAULT_REGISTRY_PATH = 'registry.yaml'
export const DEFAULT_MARKDOWN_PATH = 'CHANGELOG.md'
export const DEFAULT_JSON_PATH = path.join('public', 'changelog.gen.json')

export function normalizePathForGit(relPath: string): string {
  return relPath.replace(/\\/g, '/')
}

export function resolveConfig(config?: ChangelogKitConfig): ChangelogKitResolvedConfig {
  const registryPath = config?.registryPath ?? DEFAULT_REGISTRY_PATH
  const outputMarkdownPath = config?.outputMarkdownPath ?? DEFAULT_MARKDOWN_PATH
  const outputJsonPath = config?.outputJsonPath ?? DEFAULT_JSON_PATH
  const changelogOnlyPaths = new Set<string>(
    (config?.changelogOnlyPaths ?? [registryPath, outputMarkdownPath, outputJsonPath]).map(
      normalizePathForGit,
    ),
  )
  return {
    registryPath,
    outputMarkdownPath,
    outputJsonPath,
    changelogOnlyPaths,
  }
}
