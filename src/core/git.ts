import { spawn } from 'node:child_process'

type GitCommandOptions = {
  cwd: string
  acceptNonZero?: boolean
}

export async function runGit(args: string[], options: GitCommandOptions): Promise<string> {
  const proc = spawn('git', args, {
    cwd: options.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []
  proc.stdout.on('data', (chunk) => stdoutChunks.push(chunk))
  proc.stderr.on('data', (chunk) => stderrChunks.push(chunk))

  const code = await new Promise<number>((resolve, reject) => {
    proc.on('error', reject)
    proc.on('close', (exitCode) => resolve(exitCode ?? 1))
  })

  const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim()
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
