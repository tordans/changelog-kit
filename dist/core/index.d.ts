import { ChangelogRegistry, ChangelogFile, ChangelogRegistryEntry } from '../schemas/index.js';
import 'zod';

type ChangelogKitConfig = {
    registryPath?: string;
    outputMarkdownPath?: string;
    outputJsonPath?: string;
    changelogOnlyPaths?: string[];
};
type ChangelogKitResolvedConfig = {
    registryPath: string;
    outputMarkdownPath: string;
    outputJsonPath: string;
    changelogOnlyPaths: Set<string>;
};
declare const DEFAULT_REGISTRY_PATH = "registry.yaml";
declare const DEFAULT_MARKDOWN_PATH = "CHANGELOG.md";
declare const DEFAULT_JSON_PATH: string;
declare function normalizePathForGit(relPath: string): string;
declare function resolveConfig(config?: ChangelogKitConfig): ChangelogKitResolvedConfig;

declare function isChangelogOptOutText(text: string): boolean;
declare function isChangelogOptOutCommit(projectRoot: string, ref: string): Promise<boolean>;
declare function isChangelogOnlyPath(relPath: string, config?: ChangelogKitResolvedConfig): boolean;
declare function isChangelogOnlyCommit(projectRoot: string, ref: string, config?: ChangelogKitResolvedConfig): Promise<boolean>;
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
declare function listCommitChangedPaths(projectRoot: string, ref: string): Promise<string[]>;

declare function readRegistry(projectRoot: string, config?: ChangelogKitResolvedConfig): Promise<ChangelogRegistry>;
declare function writeRegistry(projectRoot: string, registry: ChangelogRegistry, config?: ChangelogKitResolvedConfig): Promise<void>;

declare function buildChangelog(projectRoot: string, config?: ChangelogKitConfig): Promise<{
    payload: ChangelogFile;
    wroteJson: boolean;
}>;

type PrefillResult = {
    addedEntries: ChangelogRegistryEntry[];
    skippedChangelogOnlyCount: number;
    skippedOptOutCount: number;
    anchorHash: string | null;
};
declare function prefillChangelog(projectRoot: string, config?: ChangelogKitConfig): Promise<PrefillResult>;

type VerifyResult = {
    checkedNonChangelogCount: number;
    skippedChangelogOnlyCount: number;
    skippedOptOutCount: number;
    anchorHash: string | null;
};
declare function verifyChangelog(projectRoot: string, config?: ChangelogKitConfig): Promise<VerifyResult>;

export { type ChangelogKitConfig, type ChangelogKitResolvedConfig, type CommitInfo, type CoverageSlice, DEFAULT_JSON_PATH, DEFAULT_MARKDOWN_PATH, DEFAULT_REGISTRY_PATH, type PrefillResult, type VerifyResult, buildChangelog, isChangelogOnlyCommit, isChangelogOnlyPath, isChangelogOptOutCommit, isChangelogOptOutText, listCommitChangedPaths, listFirstParentHeadHistory, monthKeyFromIsoDate, normalizePathForGit, prefillChangelog, readCommitInfo, readRegistry, resolveCommitRef, resolveConfig, runGit, shortHash, sliceCommitsSinceAnchor, verifyChangelog, writeRegistry };
