import { describe, expect, test } from 'bun:test'

import {
  isChangelogOnlyFromPaths,
  isChangelogOptOutFromCommit,
  isIgnoredFromCommit,
} from './changelog'
import { resolveConfig } from './config'

describe('prefill filter predicates (unchanged semantics)', () => {
  test('changelog-only is evaluated first in prefill (paths-only registry change)', () => {
    const cfg = resolveConfig({
      registryPath: 'changelog.registry.yaml',
      changelogOnlyPaths: ['changelog.registry.yaml'],
    })
    const paths = ['changelog.registry.yaml']
    expect(isChangelogOnlyFromPaths(paths, cfg)).toBe(true)
    const commit = { subject: 'docs: no changelog', body: '' }
    expect(isChangelogOptOutFromCommit(commit)).toBe(true)
    expect(isIgnoredFromCommit(commit, cfg)).toBe(false)
  })

  test('ignored terms use subject+body', () => {
    const cfg = resolveConfig({ ignoredCommitTerms: ['wip'] })
    expect(isIgnoredFromCommit({ subject: 'fix', body: 'still a wip note' }, cfg)).toBe(true)
  })
})
