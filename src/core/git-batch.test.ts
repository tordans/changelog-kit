import { describe, expect, test } from 'bun:test'

import { parseNameOnlyChunkMarkerLogStdout } from './git'

describe('parseNameOnlyChunkMarkerLogStdout', () => {
  test('parses padded marker blocks and disambiguates files that look like hashes', () => {
    const h1 = 'a'.repeat(40)
    const h2 = 'b'.repeat(40)
    const stdout = [
      `CHANGELOG_KIT_MARKER:${h1}`,
      '',
      'src/a.ts',
      `CHANGELOG_KIT_MARKER:${h2}`,
      '',
      'CHANGELOG_KIT_MARKER_NOT_A_COMMIT.txt',
      h1,
    ].join('\n')

    const map = parseNameOnlyChunkMarkerLogStdout(stdout)
    expect(map.get(h1)).toEqual(['src/a.ts'])
    expect(map.get(h2)).toEqual(['CHANGELOG_KIT_MARKER_NOT_A_COMMIT.txt', h1])
  })
})
