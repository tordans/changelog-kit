import { describe, expect, test } from 'bun:test'

import { canonicalPhaseList, parseChangelogCliArgv } from './args'

describe('parseChangelogCliArgv', () => {
  test('canonical phase order is independent of argv order', () => {
    const a = parseChangelogCliArgv(['--validate', '--cleanup'])
    expect(canonicalPhaseList(a.phases)).toEqual(['cleanup', 'validate'])
    const b = parseChangelogCliArgv(['--generate', '--validate', '--prefill', '--cleanup'])
    expect(canonicalPhaseList(b.phases)).toEqual(['cleanup', 'prefill', 'validate', 'generate'])
  })

  test('aliases expand to the expected phases', () => {
    const p = parseChangelogCliArgv(['--prefill-cleanup'])
    expect(p.phases.cleanup).toBe(true)
    expect(p.phases.prefill).toBe(true)
    const v = parseChangelogCliArgv(['--validate-generate'])
    expect(v.phases.validate).toBe(true)
    expect(v.phases.generate).toBe(true)
  })

  test('unknown flag throws', () => {
    expect(() => parseChangelogCliArgv(['--not-a-real-flag'])).toThrow(/Unknown flag/)
  })

  test('boolean flag must not take a value', () => {
    expect(() => parseChangelogCliArgv(['--cleanup', 'oops'])).toThrow(/does not take a value/)
  })

  test('--remap-refs is recognized as a boolean runtime flag', () => {
    const p = parseChangelogCliArgv(['--remap-refs', '--project-root', '/tmp'])
    expect(p.runtime.remapRefs).toBe(true)
    expect(p.projectRoot).toBe('/tmp')
  })
})
