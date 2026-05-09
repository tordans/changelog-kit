import { spawn } from 'node:child_process'

type GitCommandOptions = {
  cwd: string
  acceptNonZero?: boolean
  stdin?: string | Buffer | null
  /** Defaults to true; disable for parsers that rely on exact trailing whitespace. */
  trimOutput?: boolean
}

/** Keep argv small and stdin-friendly (ARG_MAX stays safe). */
const GIT_BATCH_CHUNK_SIZE = 128

export async function runGit(args: string[], options: GitCommandOptions): Promise<string> {
  const proc = spawn('git', args, {
    cwd: options.cwd,
    stdio: options.stdin != null ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  })

  const childIn = proc.stdin
  const childOut = proc.stdout
  const childErr = proc.stderr
  if (!childOut || !childErr) {
    throw new Error('git spawn failed: missing stdio pipes')
  }
  if (options.stdin != null) {
    if (!childIn) {
      throw new Error('git spawn failed: stdin not available')
    }
    childIn.write(options.stdin)
    childIn.end()
  }

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []
  childOut.on('data', (chunk) => stdoutChunks.push(chunk))
  childErr.on('data', (chunk) => stderrChunks.push(chunk))

  const code = await new Promise<number>((resolve, reject) => {
    proc.on('error', reject)
    proc.on('close', (exitCode) => resolve(exitCode ?? 1))
  })

  const stdoutRaw = Buffer.concat(stdoutChunks).toString('utf8')
  const stdout = options.trimOutput === false ? stdoutRaw : stdoutRaw.trim()
  const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()
  if (code !== 0 && !options.acceptNonZero) {
    throw new Error(`git ${args.join(' ')} failed (${code})${stderr ? `: ${stderr}` : ''}`)
  }
  return stdout
}

export async function resolveCommitRef(
  projectRoot: string,
  ref: string,
): Promise<{ ref: string; hash: string | null }> {
  const raw = await runGit(['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd: projectRoot,
    acceptNonZero: true,
  })
  if (!raw) return { ref, hash: null }
  const hash = raw.split('\n')[0]?.trim() ?? ''
  return { ref, hash: hash || null }
}

export async function listFirstParentHeadHistory(projectRoot: string): Promise<string[]> {
  const out = await runGit(['rev-list', '--first-parent', 'HEAD'], { cwd: projectRoot })
  if (!out) return []
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export type CommitInfo = {
  hash: string
  committedAtIso: string
  subject: string
  body: string
}

export async function readCommitInfo(projectRoot: string, ref: string): Promise<CommitInfo> {
  const fmt = '%H%x00%cI%x00%s%x00%b'
  const out = await runGit(['show', '-s', `--format=${fmt}`, '--no-patch', ref], {
    cwd: projectRoot,
  })
  const [hash = '', committedAtIso = '', subject = '', body = ''] = out.split('\u0000')
  if (!hash || !committedAtIso || !subject) {
    throw new Error(`Could not parse commit metadata for ref "${ref}".`)
  }
  return { hash, committedAtIso, subject, body: body.trim() }
}

const COMMIT_METADATA_PRETTY = '%H%x00%cI%x00%s%x00%b%x00'

function parseNullDelimitedCommitBatch(stdout: string): CommitInfo[] {
  const segments = stdout.split('\u0000')
  const commits: CommitInfo[] = []
  let i = 0
  while (i < segments.length) {
    while (i < segments.length && segments[i] === '') {
      i += 1
    }
    if (i >= segments.length) break
    const hash = segments[i++] ?? ''
    const committedAtIso = segments[i++] ?? ''
    const subject = segments[i++] ?? ''
    const body = (segments[i++] ?? '').trim()
    if (!hash || !committedAtIso || !subject) {
      throw new Error('Could not parse batched commit metadata (unexpected git output).')
    }
    commits.push({ hash, committedAtIso, subject, body })
  }
  return commits
}

/**
 * Read commit metadata for many refs in one (or a few) git invocations.
 * Keys in the returned map are full object names as reported by git (`%H`).
 */
export async function readCommitsInfoBatch(
  projectRoot: string,
  refs: Iterable<string>,
): Promise<Map<string, CommitInfo>> {
  const uniq = [...new Set(refs)].filter(Boolean)
  const result = new Map<string, CommitInfo>()
  if (uniq.length === 0) return result

  for (let offset = 0; offset < uniq.length; offset += GIT_BATCH_CHUNK_SIZE) {
    const chunk = uniq.slice(offset, offset + GIT_BATCH_CHUNK_SIZE)
    const stdin = `${chunk.join('\n')}\n`
    const out = await runGit(
      [
        '-c',
        'core.quotepath=false',
        'log',
        '--stdin',
        '--no-walk=sorted',
        '-z',
        `--pretty=format:${COMMIT_METADATA_PRETTY}`,
      ],
      { cwd: projectRoot, stdin, trimOutput: false },
    )
    for (const info of parseNullDelimitedCommitBatch(out)) {
      result.set(info.hash, info)
    }
  }
  return result
}

const CHANGELOG_MARKER_PREFIX = 'CHANGELOG_KIT_MARKER:'

export async function listCommitChangedPaths(projectRoot: string, ref: string): Promise<string[]> {
  const out = await runGit(['show', '--name-only', '--pretty=format:', '--no-renames', ref], {
    cwd: projectRoot,
  })
  if (!out) return []
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * List changed paths for many refs in batched git invocations (stdin + `--no-walk`).
 * Uses marker-prefixed format lines (`CHANGELOG_KIT_MARKER:%H`) so path lines are never mistaken
 * for raw commit hashes.
 */
export async function listCommitsChangedPathsBatch(
  projectRoot: string,
  refs: Iterable<string>,
): Promise<Map<string, string[]>> {
  const uniq = [...new Set(refs)].filter(Boolean)
  const result = new Map<string, string[]>()
  if (uniq.length === 0) return result

  for (let offset = 0; offset < uniq.length; offset += GIT_BATCH_CHUNK_SIZE) {
    const chunk = uniq.slice(offset, offset + GIT_BATCH_CHUNK_SIZE)
    const stdin = `${chunk.join('\n')}\n`
    const stdout = await runGit(
      [
        '-c',
        'core.quotepath=false',
        'log',
        '--stdin',
        '--no-walk=sorted',
        `--format=${CHANGELOG_MARKER_PREFIX}%H`,
        '--name-only',
      ],
      { cwd: projectRoot, stdin },
    )
    parseNameOnlyChunkMarkerLogStdout(stdout).forEach((paths, hash) => {
      result.set(hash, paths)
    })
  }

  return result
}

/** Visible for targeted unit tests — marker-based `git log` output parser. */
export function parseNameOnlyChunkMarkerLogStdout(stdout: string): Map<string, string[]> {
  const lines = stdout.split(/\r?\n/)
  const map = new Map<string, string[]>()
  let currentHash: string | null = null
  let bucket: string[] = []
  const prefix = CHANGELOG_MARKER_PREFIX

  const flush = (): void => {
    if (!currentHash) return
    map.set(currentHash, bucket)
    currentHash = null
    bucket = []
  }

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    if (line.startsWith(prefix)) {
      flush()
      currentHash = line.slice(prefix.length)
      bucket = []
      continue
    }
    if (!currentHash) {
      continue
    }
    // `git log` emits a blank line after each marker before the first path.
    if (line.trim() === '' && bucket.length === 0) {
      continue
    }
    bucket.push(line.trim())
  }
  flush()
  return map
}
