import { z } from 'zod';

// src/schemas/changelog.ts
var refsSchema = z.array(z.string().trim().min(1)).min(1);
var visibleRegistryEntrySchema = z.object({
  hide: z.literal(false),
  refs: refsSchema,
  descriptionMd: z.string().trim().min(1)
});
var hiddenRegistryEntrySchema = z.object({
  hide: z.literal(true),
  refs: refsSchema,
  descriptionMd: z.never().optional()
});
var changelogRegistryEntrySchema = z.discriminatedUnion("hide", [
  visibleRegistryEntrySchema,
  hiddenRegistryEntrySchema
]);
var changelogRegistryEntryInputSchema = z.object({
  hide: z.boolean().optional(),
  refs: refsSchema,
  descriptionMd: z.string().optional()
}).transform((entry) => ({
  hide: entry.hide ?? false,
  refs: entry.refs,
  descriptionMd: entry.descriptionMd
})).pipe(changelogRegistryEntrySchema);
var changelogRegistrySchema = z.object({
  entries: z.array(changelogRegistryEntryInputSchema)
});
var changelogEntrySchema = z.object({
  refs: z.array(z.string().min(1)).min(1),
  refsDisplay: z.array(z.string().min(1)).min(1),
  descriptionMd: z.string().min(1),
  committedAtIso: z.string().min(1),
  committedAtShort: z.string().min(1)
});
var changelogFileSchema = z.object({
  generatedAt: z.string().min(1),
  months: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      entries: z.array(changelogEntrySchema)
    })
  )
});

export { changelogEntrySchema, changelogFileSchema, changelogRegistryEntrySchema, changelogRegistrySchema };
//# sourceMappingURL=chunk-MWID7EK6.js.map
//# sourceMappingURL=chunk-MWID7EK6.js.map