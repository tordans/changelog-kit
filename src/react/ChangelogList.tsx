import type { ChangelogFile } from '../schemas'

export type ChangelogListLabels = {
  empty: string
}

export type ChangelogListProps = {
  data: ChangelogFile
  commitUrl: (ref: string) => string
  labels?: Partial<ChangelogListLabels>
  className?: string
}

type ChangelogRow = {
  month: string
  showMonth: boolean
  refs: string[]
  refsDisplay: string[]
  descriptionMd: string
}

const DEFAULT_LABELS: ChangelogListLabels = {
  empty: 'No changelog entries.',
}

function toRows(data: ChangelogFile): ChangelogRow[] {
  return data.months.flatMap((monthBlock) =>
    monthBlock.entries.map((entry, index) => ({
      month: monthBlock.month,
      showMonth: index === 0,
      refs: entry.refs,
      refsDisplay: entry.refsDisplay,
      descriptionMd: entry.descriptionMd,
    })),
  )
}

export function ChangelogList({ data, commitUrl, labels, className }: ChangelogListProps) {
  const copy = { ...DEFAULT_LABELS, ...labels }
  const rows = toRows(data)

  if (rows.length === 0) {
    return <p className={className}>{copy.empty}</p>
  }

  return (
    <div className={className}>
      <dl className="divide-y divide-zinc-800 border-t border-zinc-800">
        {rows.map(({ month, showMonth, refs, refsDisplay, descriptionMd }) => (
          <div key={`${month}-${refs.join(',')}`} className="py-6 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm/6 font-medium text-zinc-100">
              {showMonth ? month : <span className="sr-only">{month}</span>}
            </dt>
            <dd className="mt-1 text-sm/6 text-zinc-300 sm:col-span-2 sm:mt-0">
              <div className="space-y-2 text-sm text-zinc-200">
                {descriptionMd
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, index) => (
                    <p key={`${refs.join(',')}-${index}`}>{line}</p>
                  ))}
              </div>
              <p className="mt-1 text-xs text-emerald-300">
                {refsDisplay.map((ref, index) => (
                  <span key={`${refs.join(',')}-${ref}`}>
                    {index > 0 ? ', ' : null}
                    <a
                      href={commitUrl(refs[index] ?? ref)}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-300"
                    >
                      {`\`${ref}\``}
                    </a>
                  </span>
                ))}
              </p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
