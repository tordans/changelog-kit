import { ChangelogRegistry, ChangelogFile, ChangelogRegistryEntry } from '../schemas/index.js';
import 'zod';

type ChangelogKitConfig = {
    registryPath?: string;
    outputMarkdownPath?: string;
    outputJsonPath?: string;
    changelogOnlyPaths?: string[];
    ignoredCommitTerms?: string[];
};
type ChangelogKitResolvedConfig = {
    registryPath: string;
    outputMarkdownPath: string;
    outputJsonPath: string;
    changelogOnlyPaths: Set<string>;
    ignoredCommitTerms: string[];
};
declare const DEFAULT_REGISTRY_PATH = "changelog.registry.yaml";
declare const DEFAULT_MARKDOWN_PATH = "CHANGELOG.md";
declare const DEFAULT_JSON_PATH: string;
declare function normalizePathForGit(relPath: string): string;
declare function resolveConfig(config?: ChangelogKitConfig): ChangelogKitResolvedConfig;

declare function isChangelogOptOutText(text: string): boolean;
declare function isIgnoredByTerms(text: string, ignoredTerms: string[]): boolean;
declare function isChangelogOptOutCommit(projectRoot: string, ref: string): Promise<boolean>;
/** Prefer this when metadata is already loaded (avoids extra `git show` calls). */
declare function isChangelogOptOutFromCommit(commit: {
    subject: string;
    body: string;
}): boolean;
declare function isIgnoredCommit(projectRoot: string, ref: string, config?: ChangelogKitResolvedConfig): Promise<boolean>;
declare function isIgnoredFromCommit(commit: {
    subject: string;
    body: string;
}, config: ChangelogKitResolvedConfig): boolean;
declare function isChangelogOnlyPath(relPath: string, config?: ChangelogKitResolvedConfig): boolean;
declare function isChangelogOnlyCommit(projectRoot: string, ref: string, config?: ChangelogKitResolvedConfig): Promise<boolean>;
declare function isChangelogOnlyFromPaths(paths: string[], config: ChangelogKitResolvedConfig): boolean;
declare function monthKeyFromIsoDate(isoDate: string): string;
type CoverageSlice = {
    anchorHash: string | null;
    commitsSinceAnchor: string[];
};
declare function sliceCommitsSinceAnchor(firstParentHeadHistory: string[], registeredHashes: Set<string>): CoverageSlice;
declare function shortHash(hash: string): string;

type GitCommandOptions = {
    cwd: string;
    acceptNonZero?: boolean;
    stdin?: string | Buffer | null;
    /** Defaults to true; disable for parsers that rely on exact trailing whitespace. */
    trimOutput?: boolean;
};
declare function runGit(args: string[], options: GitCommandOptions): Promise<string>;
declare function resolveCommitRef(projectRoot: string, ref: string): Promise<{
    ref: string;
    hash: string | null;
}>;
declare function listFirstParentHeadHistory(projectRoot: string): Promise<string[]>;
type CommitInfo = {
    hash: string;
    committedAtIso: string;
    subject: string;
    body: string;
};
declare function readCommitInfo(projectRoot: string, ref: string): Promise<CommitInfo>;
/**
 * Read commit metadata for many refs in one (or a few) git invocations.
 * Keys in the returned map are full object names as reported by git (`%H`).
 */
declare function readCommitsInfoBatch(projectRoot: string, refs: Iterable<string>): Promise<Map<string, CommitInfo>>;
declare function listCommitChangedPaths(projectRoot: string, ref: string): Promise<string[]>;
/**
 * List changed paths for many refs in batched git invocations (stdin + `--no-walk`).
 * Uses marker-prefixed format lines (`CHANGELOG_KIT_MARKER:%H`) so path lines are never mistaken
 * for raw commit hashes.
 */
declare function listCommitsChangedPathsBatch(projectRoot: string, refs: Iterable<string>): Promise<Map<string, string[]>>;
/** Visible for targeted unit tests — marker-based `git log` output parser. */
declare function parseNameOnlyChunkMarkerLogStdout(stdout: string): Map<string, string[]>;

declare function readRegistry(projectRoot: string, config?: ChangelogKitResolvedConfig): Promise<ChangelogRegistry>;
declare function writeRegistry(projectRoot: string, registry: ChangelogRegistry, config?: ChangelogKitResolvedConfig): Promise<void>;

declare function buildChangelog(projectRoot: string, config?: ChangelogKitConfig): Promise<{
    payload: ChangelogFile;
    wroteJson: boolean;
}>;

type PrefillResult = {
    addedEntries: ChangelogRegistryEntry[];
    removedStaleRefCount: number;
    removedEmptyEntryCount: number;
    skippedChangelogOnlyCount: number;
    skippedIgnoredCount: number;
    skippedOptOutCount: number;
    anchorHash: string | null;
};
declare function prefillChangelog(projectRoot: string, config?: ChangelogKitConfig): Promise<PrefillResult>;

type VerifyResult = {
    checkedNonChangelogCount: number;
    skippedChangelogOnlyCount: number;
    skippedIgnoredCount: number;
    skippedOptOutCount: number;
    anchorHash: string | null;
};
declare function verifyChangelog(projectRoot: string, config?: ChangelogKitConfig): Promise<VerifyResult>;

export { type ChangelogKitConfig, type ChangelogKitResolvedConfig, type CommitInfo, type CoverageSlice, DEFAULT_JSON_PATH, DEFAULT_MARKDOWN_PATH, DEFAULT_REGISTRY_PATH, type PrefillResult, type VerifyResult, buildChangelog, isChangelogOnlyCommit, isChangelogOnlyFromPaths, isChangelogOnlyPath, isChangelogOptOutCommit, isChangelogOptOutFromCommit, isChangelogOptOutText, isIgnoredByTerms, isIgnoredCommit, isIgnoredFromCommit, listCommitChangedPaths, listCommitsChangedPathsBatch, listFirstParentHeadHistory, monthKeyFromIsoDate, normalizePathForGit, parseNameOnlyChunkMarkerLogStdout, prefillChangelog, readCommitInfo, readCommitsInfoBatch, readRegistry, resolveCommitRef, resolveConfig, runGit, shortHash, sliceCommitsSinceAnchor, verifyChangelog, writeRegistry };
