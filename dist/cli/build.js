#!/usr/bin/env node
import { parseCliContext, resolveConfig, buildChangelog } from '../chunk-3ZRK5GL6.js';

// src/cli/build.ts
async function main() {
  const { projectRoot, config } = parseCliContext(process.argv.slice(2));
  const resolved = resolveConfig(config);
  const { wroteJson } = await buildChangelog(projectRoot, config);
  console.info(
    wroteJson ? `[changelog-kit:build] Wrote ${resolved.outputMarkdownPath} and ${resolved.outputJsonPath}.` : `[changelog-kit:build] Wrote ${resolved.outputMarkdownPath}; kept ${resolved.outputJsonPath} unchanged (timestamp-only diff).`
  );
}
void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
//# sourceMappingURL=build.js.map
//# sourceMappingURL=build.js.map