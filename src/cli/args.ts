import type { ChangelogKitConfig } from '../core'

type RawArgMap = Map<string, string[]>

const KNOWN_FLAG_KEYS = new Set([
  'cleanup',
  'prefill',
  'validate',
  'generate',
  'prefill-cleanup',
  'validate-generate',
  'non-interactive',
  'ci',
  'quiet',
  'json',
  'no-color',
  'help',
  'version',
  'project-root',
  'registry-path',
  'output-json-path',
  'output-markdown-path',
  'changelog-only-path',
  'ignore-commit-term',
])

const SINGLETON_STRING_FLAGS = new Set([
  'project-root',
  'registry-path',
  'output-json-path',
  'output-markdown-path',
])

const BOOLEAN_FLAGS = new Set([
  'cleanup',
  'prefill',
  'validate',
  'generate',
  'prefill-cleanup',
  'validate-generate',
  'non-interactive',
  'ci',
  'quiet',
  'json',
  'no-color',
  'help',
  'version',
])

function readRawArgs(argv: string[]): RawArgMap {
  const map = new Map<string, string[]>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}". Only long-form --flags are supported.`)
    }
    const key = token.slice(2)
    if (!KNOWN_FLAG_KEYS.has(key)) {
      throw new Error(`Unknown flag --${key}. Run changelog --help for usage.`)
    }
    const next = argv[i + 1]
    if (BOOLEAN_FLAGS.has(key)) {
      if (next && !next.startsWith('--')) {
        throw new Error(`Flag --${key} does not take a value; remove "${next}".`)
      }
      const list = map.get(key) ?? []
      list.push('true')
      map.set(key, list)
      continue
    }
    if (!next || next.startsWith('--')) {
      throw new Error(`Flag --${key} requires a value.`)
    }
    const list = map.get(key) ?? []
    list.push(next)
    map.set(key, list)
    i += 1
  }
  return map
}

function assertSingleton(key: string, values: string[] | undefined): void {
  if (values && values.length > 1) {
    throw new Error(`Flag --${key} was provided multiple times.`)
  }
}

function hasFlag(args: RawArgMap, key: string): boolean {
  return (args.get(key)?.length ?? 0) > 0
}

export type CliContext = {
  projectRoot: string
  config: ChangelogKitConfig
}

export function parseCliContext(argv: string[]): CliContext {
  const parsed = parseChangelogCliArgv(argv)
  return { projectRoot: parsed.projectRoot, config: parsed.config }
}

export type PhaseSelection = {
  cleanup: boolean
  prefill: boolean
  validate: boolean
  generate: boolean
}

export type RuntimeCliOptions = {
  nonInteractive: boolean
  ci: boolean
  quiet: boolean
  json: boolean
  noColor: boolean
  help: boolean
  version: boolean
}

export type ParsedChangelogCli = {
  projectRoot: string
  config: ChangelogKitConfig
  phases: PhaseSelection
  runtime: RuntimeCliOptions
}

export function resolvePhasesFromFlags(args: RawArgMap): PhaseSelection {
  const cleanup = hasFlag(args, 'cleanup') || hasFlag(args, 'prefill-cleanup')
  const prefill = hasFlag(args, 'prefill') || hasFlag(args, 'prefill-cleanup')
  const validate = hasFlag(args, 'validate') || hasFlag(args, 'validate-generate')
  const generate = hasFlag(args, 'generate') || hasFlag(args, 'validate-generate')
  return { cleanup, prefill, validate, generate }
}

export type ChangelogPhase = 'cleanup' | 'prefill' | 'validate' | 'generate'

/** Fixed pipeline order; flag order on the CLI does not change execution order. */
export function canonicalPhaseList(phases: PhaseSelection): ChangelogPhase[] {
  const order: ChangelogPhase[] = ['cleanup', 'prefill', 'validate', 'generate']
  return order.filter((p) => phases[p])
}

export function parseChangelogCliArgv(argv: string[]): ParsedChangelogCli {
  const args = readRawArgs(argv)

  for (const key of BOOLEAN_FLAGS) {
    assertSingleton(key, args.get(key))
  }

  for (const key of SINGLETON_STRING_FLAGS) {
    assertSingleton(key, args.get(key))
  }

  const projectRoot = args.get('project-root')?.at(-1) ?? process.cwd()

  const config: ChangelogKitConfig = {
    registryPath: args.get('registry-path')?.at(-1),
    outputJsonPath: args.get('output-json-path')?.at(-1),
    outputMarkdownPath: args.get('output-markdown-path')?.at(-1),
    changelogOnlyPaths: args.get('changelog-only-path'),
    ignoredCommitTerms: args.get('ignore-commit-term'),
  }

  const phases = resolvePhasesFromFlags(args)
  const runtime: RuntimeCliOptions = {
    nonInteractive: hasFlag(args, 'non-interactive'),
    ci: hasFlag(args, 'ci'),
    quiet: hasFlag(args, 'quiet'),
    json: hasFlag(args, 'json'),
    noColor: hasFlag(args, 'no-color'),
    help: hasFlag(args, 'help'),
    version: hasFlag(args, 'version'),
  }

  return { projectRoot, config, phases, runtime }
}

export function anyPhaseSelected(phases: PhaseSelection): boolean {
  return phases.cleanup || phases.prefill || phases.validate || phases.generate
}
