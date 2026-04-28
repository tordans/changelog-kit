import { z } from 'zod'

const refsSchema = z.array(z.string().trim().min(1)).min(1)

const visibleRegistryEntrySchema = z.object({
  hide: z.literal(false),
  refs: refsSchema,
  descriptionMd: z.string().trim().min(1),
})

const hiddenRegistryEntrySchema = z.object({
  hide: z.literal(true),
  refs: refsSchema,
  descriptionMd: z.never().optional(),
})

export const changelogRegistryEntrySchema = z.discriminatedUnion('hide', [
  visibleRegistryEntrySchema,
  hiddenRegistryEntrySchema,
])

const changelogRegistryEntryInputSchema = z
  .object({
    hide: z.boolean().optional(),
    refs: refsSchema,
    descriptionMd: z.string().optional(),
  })
  .transform((entry) => ({
    hide: entry.hide ?? false,
    refs: entry.refs,
    descriptionMd: entry.descriptionMd,
  }))
  .pipe(changelogRegistryEntrySchema)

export const changelogRegistrySchema = z.object({
  entries: z.array(changelogRegistryEntryInputSchema),
})

export const changelogEntrySchema = z.object({
  refs: z.array(z.string().min(1)).min(1),
  refsDisplay: z.array(z.string().min(1)).min(1),
  descriptionMd: z.string().min(1),
  committedAtIso: z.string().min(1),
  committedAtShort: z.string().min(1),
})

export const changelogFileSchema = z.object({
  generatedAt: z.string().min(1),
  months: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      entries: z.array(changelogEntrySchema),
    }),
  ),
})

export type ChangelogRegistryEntry = z.infer<typeof changelogRegistryEntrySchema>
export type ChangelogRegistry = z.infer<typeof changelogRegistrySchema>
export type ChangelogEntry = z.infer<typeof changelogEntrySchema>
export type ChangelogFile = z.infer<typeof changelogFileSchema>
