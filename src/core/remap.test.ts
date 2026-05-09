import { describe, expect, test } from 'bun:test'

import { parsePostRewriteStdin, remapRegistryRefs } from './remap'

describe('parsePostRewriteStdin', () => {
  test('parses two-column lines and lowercases hex', () => {
    const { pairs, warnings } = parsePostRewriteStdin(
      'AAA0000000000000000000000000000000000001 BBB0000000000000000000000000000000000002\n',
    )
    expect(warnings).toEqual([])
    expect(pairs).toEqual([
      {
        oldHash: 'aaa0000000000000000000000000000000000001',
        newHash: 'bbb0000000000000000000000000000000000002',
      },
    ])
  })

  test('ignores optional third column', () => {
    const { pairs, warnings } = parsePostRewriteStdin(
      'aaa0000000000000000000000000000000000001 bbb0000000000000000000000000000000000002 extra\n',
    )
    expect(warnings).toEqual([])
    expect(pairs).toHaveLength(1)
  })

  test('skips non-hex lines with a warning', () => {
    const { pairs, warnings } = parsePostRewriteStdin(
      'aaa0000000000000000000000000000000000001 bbb0000000000000000000000000000000000002\nnothex deadbeef00000000000000000000000000\n',
    )
    expect(pairs).toHaveLength(1)
    expect(warnings.some((w) => /non-hex/.test(w))).toBe(true)
  })

  test('skips malformed lines', () => {
    const { pairs, warnings } = parsePostRewriteStdin('onlyone\n')
    expect(pairs).toEqual([])
    expect(warnings.length).toBeGreaterThan(0)
  })
})

describe('remapRegistryRefs', () => {
  test('replaces 7-char ref with 7-char prefix of new hash', () => {
    const registry = {
      entries: [
        {
          hide: false as const,
          refs: ['abc1234'],
          descriptionMd: 'x',
        },
      ],
    }
    const oldFull = 'abc1234000000000000000000000000000000000'
    const newFull = 'fedcba9000000000000000000000000000000000'
    remapRegistryRefs(registry, [{ oldHash: oldFull, newHash: newFull }])
    expect(registry.entries[0]?.refs).toEqual(['fedcba9'])
  })

  test('replaces full 40-char ref', () => {
    const oldFull = 'abc1234000000000000000000000000000000000'
    const newFull = 'fedcba9000000000000000000000000000000000'
    const registry = {
      entries: [
        {
          hide: false as const,
          refs: [oldFull],
          descriptionMd: 'x',
        },
      ],
    }
    remapRegistryRefs(registry, [{ oldHash: oldFull, newHash: newFull }])
    expect(registry.entries[0]?.refs).toEqual([newFull])
  })

  test('second remap with the same pairs is a no-op', () => {
    const oldFull = 'abc1234000000000000000000000000000000000'
    const newFull = 'fedcba9000000000000000000000000000000000'
    const registry = {
      entries: [
        {
          hide: false as const,
          refs: ['abc1234'],
          descriptionMd: 'x',
        },
      ],
    }
    const pairs = [{ oldHash: oldFull, newHash: newFull }]
    const first = remapRegistryRefs(registry, pairs)
    expect(first.remappedRefCount).toBe(1)
    expect(registry.entries[0]?.refs).toEqual(['fedcba9'])
    const second = remapRegistryRefs(registry, pairs)
    expect(second.remappedRefCount).toBe(0)
    expect(registry.entries[0]?.refs).toEqual(['fedcba9'])
  })

  test('squash collapse dedupes two refs to one new prefix', () => {
    const a = 'aaaaaaaa00000000000000000000000000000001'
    const b = 'bbbbbbbb00000000000000000000000000000002'
    const x = 'cccccccc00000000000000000000000000000003'
    const registry = {
      entries: [
        {
          hide: false as const,
          refs: ['aaaaaaa', 'bbbbbbb'],
          descriptionMd: 'x',
        },
      ],
    }
    remapRegistryRefs(registry, [
      { oldHash: a, newHash: x },
      { oldHash: b, newHash: x },
    ])
    expect(registry.entries[0]?.refs).toEqual(['ccccccc'])
  })

  test('leaves refs unchanged when no pair matches', () => {
    const registry = {
      entries: [
        {
          hide: false as const,
          refs: ['1111111'],
          descriptionMd: 'x',
        },
      ],
    }
    const stats = remapRegistryRefs(registry, [
      {
        oldHash: '2222222000000000000000000000000000000002',
        newHash: '3333333000000000000000000000000000000003',
      },
    ])
    expect(stats.remappedRefCount).toBe(0)
    expect(registry.entries[0]?.refs).toEqual(['1111111'])
  })
})
