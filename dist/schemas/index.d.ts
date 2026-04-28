import { z } from 'zod';

declare const changelogRegistryEntrySchema: z.ZodDiscriminatedUnion<"hide", [z.ZodObject<{
    hide: z.ZodLiteral<false>;
    refs: z.ZodArray<z.ZodString, "many">;
    descriptionMd: z.ZodString;
}, "strip", z.ZodTypeAny, {
    hide: false;
    refs: string[];
    descriptionMd: string;
}, {
    hide: false;
    refs: string[];
    descriptionMd: string;
}>, z.ZodObject<{
    hide: z.ZodLiteral<true>;
    refs: z.ZodArray<z.ZodString, "many">;
    descriptionMd: z.ZodOptional<z.ZodNever>;
}, "strip", z.ZodTypeAny, {
    hide: true;
    refs: string[];
    descriptionMd?: undefined;
}, {
    hide: true;
    refs: string[];
    descriptionMd?: undefined;
}>]>;
declare const changelogRegistrySchema: z.ZodObject<{
    entries: z.ZodArray<z.ZodPipeline<z.ZodEffects<z.ZodObject<{
        hide: z.ZodOptional<z.ZodBoolean>;
        refs: z.ZodArray<z.ZodString, "many">;
        descriptionMd: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        refs: string[];
        hide?: boolean | undefined;
        descriptionMd?: string | undefined;
    }, {
        refs: string[];
        hide?: boolean | undefined;
        descriptionMd?: string | undefined;
    }>, {
        hide: boolean;
        refs: string[];
        descriptionMd: string | undefined;
    }, {
        refs: string[];
        hide?: boolean | undefined;
        descriptionMd?: string | undefined;
    }>, z.ZodDiscriminatedUnion<"hide", [z.ZodObject<{
        hide: z.ZodLiteral<false>;
        refs: z.ZodArray<z.ZodString, "many">;
        descriptionMd: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        hide: false;
        refs: string[];
        descriptionMd: string;
    }, {
        hide: false;
        refs: string[];
        descriptionMd: string;
    }>, z.ZodObject<{
        hide: z.ZodLiteral<true>;
        refs: z.ZodArray<z.ZodString, "many">;
        descriptionMd: z.ZodOptional<z.ZodNever>;
    }, "strip", z.ZodTypeAny, {
        hide: true;
        refs: string[];
        descriptionMd?: undefined;
    }, {
        hide: true;
        refs: string[];
        descriptionMd?: undefined;
    }>]>>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: ({
        hide: false;
        refs: string[];
        descriptionMd: string;
    } | {
        hide: true;
        refs: string[];
        descriptionMd?: undefined;
    })[];
}, {
    entries: {
        refs: string[];
        hide?: boolean | undefined;
        descriptionMd?: string | undefined;
    }[];
}>;
declare const changelogEntrySchema: z.ZodObject<{
    refs: z.ZodArray<z.ZodString, "many">;
    refsDisplay: z.ZodArray<z.ZodString, "many">;
    descriptionMd: z.ZodString;
    committedAtIso: z.ZodString;
    committedAtShort: z.ZodString;
}, "strip", z.ZodTypeAny, {
    committedAtIso: string;
    refs: string[];
    descriptionMd: string;
    refsDisplay: string[];
    committedAtShort: string;
}, {
    committedAtIso: string;
    refs: string[];
    descriptionMd: string;
    refsDisplay: string[];
    committedAtShort: string;
}>;
declare const changelogFileSchema: z.ZodObject<{
    generatedAt: z.ZodString;
    months: z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        entries: z.ZodArray<z.ZodObject<{
            refs: z.ZodArray<z.ZodString, "many">;
            refsDisplay: z.ZodArray<z.ZodString, "many">;
            descriptionMd: z.ZodString;
            committedAtIso: z.ZodString;
            committedAtShort: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            committedAtIso: string;
            refs: string[];
            descriptionMd: string;
            refsDisplay: string[];
            committedAtShort: string;
        }, {
            committedAtIso: string;
            refs: string[];
            descriptionMd: string;
            refsDisplay: string[];
            committedAtShort: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entries: {
            committedAtIso: string;
            refs: string[];
            descriptionMd: string;
            refsDisplay: string[];
            committedAtShort: string;
        }[];
        month: string;
    }, {
        entries: {
            committedAtIso: string;
            refs: string[];
            descriptionMd: string;
            refsDisplay: string[];
            committedAtShort: string;
        }[];
        month: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    generatedAt: string;
    months: {
        entries: {
            committedAtIso: string;
            refs: string[];
            descriptionMd: string;
            refsDisplay: string[];
            committedAtShort: string;
        }[];
        month: string;
    }[];
}, {
    generatedAt: string;
    months: {
        entries: {
            committedAtIso: string;
            refs: string[];
            descriptionMd: string;
            refsDisplay: string[];
            committedAtShort: string;
        }[];
        month: string;
    }[];
}>;
type ChangelogRegistryEntry = z.infer<typeof changelogRegistryEntrySchema>;
type ChangelogRegistry = z.infer<typeof changelogRegistrySchema>;
type ChangelogEntry = z.infer<typeof changelogEntrySchema>;
type ChangelogFile = z.infer<typeof changelogFileSchema>;

export { type ChangelogEntry, type ChangelogFile, type ChangelogRegistry, type ChangelogRegistryEntry, changelogEntrySchema, changelogFileSchema, changelogRegistryEntrySchema, changelogRegistrySchema };
