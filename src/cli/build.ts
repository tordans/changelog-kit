import { buildChangelog, resolveConfig } from '../core'
import { parseCliContext } from './args'

async function main() {
  const { projectRoot, config } = parseCliContext(process.argv.slice(2))
  const resolved = resolveConfig(config)
  const { wroteJson } = await buildChangelog(projectRoot, config)
  console.info(
    wroteJson
      ? `[changelog-kit:build] Wrote ${resolved.outputMarkdownPath} and ${resolved.outputJsonPath}.`
      : `[changelog-kit:build] Wrote ${resolved.outputMarkdownPath}; kept ${resolved.outputJsonPath} unchanged (timestamp-only diff).`,
  )
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
