#!/usr/bin/env node
import path2 from 'path';
import { spawn } from 'child_process';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { z } from 'zod';

var DEFAULT_REGISTRY_PATH = "changelog.registry.yaml";
var DEFAULT_MARKDOWN_PATH = "CHANGELOG.md";
var DEFAULT_JSON_PATH = path2.join("public", "changelog.gen.json");
function normalizePathForGit(relPath) {
  return relPath.replace(/\\/g, "/");
}
function resolveConfig(config) {
  const registryPath = config?.registryPath ?? DEFAULT_REGISTRY_PATH;
  const outputMarkdownPath = config?.outputMarkdownPath ?? DEFAULT_MARKDOWN_PATH;
  const outputJsonPath = config?.outputJsonPath ?? DEFAULT_JSON_PATH;
  const changelogOnlyPaths = new Set(
    (config?.changelogOnlyPaths ?? [registryPath, outputMarkdownPath, outputJsonPath]).map(
      normalizePathForGit
    )
  );
  const ignoredCommitTerms = Array.from(
    new Set(
      (config?.ignoredCommitTerms ?? []).map((term) => term.trim().toLowerCase()).filter(Boolean)
    )
  );
  return {
    registryPath,
    outputMarkdownPath,
    outputJsonPath,
    changelogOnlyPaths,
    ignoredCommitTerms
  };
}
var GIT_BATCH_CHUNK_SIZE = 128;
async function runGit(args, options) {
  const proc = spawn("git", args, {
    cwd: options.cwd,
    stdio: options.stdin != null ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"]
  });
  const childIn = proc.stdin;
  const childOut = proc.stdout;
  const childErr = proc.stderr;
  if (!childOut || !childErr) {
    throw new Error("git spawn failed: missing stdio pipes");
  }
  if (options.stdin != null) {
    if (!childIn) {
      throw new Error("git spawn failed: stdin not available");
    }
    childIn.write(options.stdin);
    childIn.end();
  }
  const stdoutChunks = [];
  const stderrChunks = [];
  childOut.on("data", (chunk) => stdoutChunks.push(chunk));
  childErr.on("data", (chunk) => stderrChunks.push(chunk));
  const code = await new Promise((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (exitCode) => resolve(exitCode ?? 1));
  });
  const stdoutRaw = Buffer.concat(stdoutChunks).toString("utf8");
  const stdout = options.trimOutput === false ? stdoutRaw : stdoutRaw.trim();
  const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
  if (code !== 0 && !options.acceptNonZero) {
    throw new Error(`git ${args.join(" ")} failed (${code})${stderr ? `: ${stderr}` : ""}`);
  }
  return stdout;
}
async function resolveCommitRef(projectRoot, ref) {
  const raw = await runGit(["rev-parse", "--verify", `${ref}^{commit}`], {
    cwd: projectRoot,
    acceptNonZero: true
  });
  if (!raw) return { ref, hash: null };
  const hash = raw.split("\n")[0]?.trim() ?? "";
  return { ref, hash: hash || null };
}
async function listFirstParentHeadHistory(projectRoot) {
  const out = await runGit(["rev-list", "--first-parent", "HEAD"], { cwd: projectRoot });
  if (!out) return [];
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}
async function readCommitInfo(projectRoot, ref) {
  const fmt = "%H%x00%cI%x00%s%x00%b";
  const out = await runGit(["show", "-s", `--format=${fmt}`, "--no-patch", ref], {
    cwd: projectRoot
  });
  const [hash = "", committedAtIso = "", subject = "", body = ""] = out.split("\0");
  if (!hash || !committedAtIso || !subject) {
    throw new Error(`Could not parse commit metadata for ref "${ref}".`);
  }
  return { hash, committedAtIso, subject, body: body.trim() };
}
var COMMIT_METADATA_PRETTY = "%H%x00%cI%x00%s%x00%b%x00";
function parseNullDelimitedCommitBatch(stdout) {
  const segments = stdout.split("\0");
  const commits = [];
  let i = 0;
  while (i < segments.length) {
    while (i < segments.length && segments[i] === "") {
      i += 1;
    }
    if (i >= segments.length) break;
    const hash = segments[i++] ?? "";
    const committedAtIso = segments[i++] ?? "";
    const subject = segments[i++] ?? "";
    const body = (segments[i++] ?? "").trim();
    if (!hash || !committedAtIso || !subject) {
      throw new Error("Could not parse batched commit metadata (unexpected git output).");
    }
    commits.push({ hash, committedAtIso, subject, body });
  }
  return commits;
}
async function readCommitsInfoBatch(projectRoot, refs) {
  const uniq = [...new Set(refs)].filter(Boolean);
  const result = /* @__PURE__ */ new Map();
  if (uniq.length === 0) return result;
  for (let offset = 0; offset < uniq.length; offset += GIT_BATCH_CHUNK_SIZE) {
    const chunk = uniq.slice(offset, offset + GIT_BATCH_CHUNK_SIZE);
    const stdin = `${chunk.join("\n")}
`;
    const out = await runGit(
      [
        "-c",
        "core.quotepath=false",
        "log",
        "--stdin",
        "--no-walk=sorted",
        "-z",
        `--pretty=format:${COMMIT_METADATA_PRETTY}`
      ],
      { cwd: projectRoot, stdin, trimOutput: false }
    );
    for (const info of parseNullDelimitedCommitBatch(out)) {
      result.set(info.hash, info);
    }
  }
  return result;
}
var CHANGELOG_MARKER_PREFIX = "CHANGELOG_KIT_MARKER:";
async function listCommitChangedPaths(projectRoot, ref) {
  const out = await runGit(["show", "--name-only", "--pretty=format:", "--no-renames", ref], {
    cwd: projectRoot
  });
  if (!out) return [];
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}
async function listCommitsChangedPathsBatch(projectRoot, refs) {
  const uniq = [...new Set(refs)].filter(Boolean);
  const result = /* @__PURE__ */ new Map();
  if (uniq.length === 0) return result;
  for (let offset = 0; offset < uniq.length; offset += GIT_BATCH_CHUNK_SIZE) {
    const chunk = uniq.slice(offset, offset + GIT_BATCH_CHUNK_SIZE);
    const stdin = `${chunk.join("\n")}
`;
    const stdout = await runGit(
      [
        "-c",
        "core.quotepath=false",
        "log",
        "--stdin",
        "--no-walk=sorted",
        `--format=${CHANGELOG_MARKER_PREFIX}%H`,
        "--name-only"
      ],
      { cwd: projectRoot, stdin }
    );
    parseNameOnlyChunkMarkerLogStdout(stdout).forEach((paths, hash) => {
      result.set(hash, paths);
    });
  }
  return result;
}
function parseNameOnlyChunkMarkerLogStdout(stdout) {
  const lines = stdout.split(/\r?\n/);
  const map = /* @__PURE__ */ new Map();
  let currentHash = null;
  let bucket = [];
  const prefix = CHANGELOG_MARKER_PREFIX;
  const flush = () => {
    if (!currentHash) return;
    map.set(currentHash, bucket);
    currentHash = null;
    bucket = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith(prefix)) {
      flush();
      currentHash = line.slice(prefix.length);
      bucket = [];
      continue;
    }
    if (!currentHash) {
      continue;
    }
    if (line.trim() === "" && bucket.length === 0) {
      continue;
    }
    bucket.push(line.trim());
  }
  flush();
  return map;
}

// src/core/changelog.ts
var CHANGELOG_OPTOUT_PATTERN = /\b(?:no[-\s]+changelog|hide\s+changelog)\b/i;
function isChangelogOptOutText(text) {
  return CHANGELOG_OPTOUT_PATTERN.test(text);
}
function isIgnoredByTerms(text, ignoredTerms) {
  if (ignoredTerms.length === 0) return false;
  const lower = text.toLowerCase();
  return ignoredTerms.some((term) => lower.includes(term));
}
async function isChangelogOptOutCommit(projectRoot, ref) {
  const commit = await readCommitInfo(projectRoot, ref);
  return isChangelogOptOutFromCommit(commit);
}
function isChangelogOptOutFromCommit(commit) {
  const combined = `${commit.subject}
${commit.body}`;
  return isChangelogOptOutText(combined);
}
async function isIgnoredCommit(projectRoot, ref, config) {
  const resolved = config ?? resolveConfig();
  const commit = await readCommitInfo(projectRoot, ref);
  return isIgnoredFromCommit(commit, resolved);
}
function isIgnoredFromCommit(commit, config) {
  if (config.ignoredCommitTerms.length === 0) return false;
  const combined = `${commit.subject}
${commit.body}`;
  return isIgnoredByTerms(combined, config.ignoredCommitTerms);
}
function isChangelogOnlyPath(relPath, config) {
  const resolved = config ?? resolveConfig();
  return resolved.changelogOnlyPaths.has(normalizePathForGit(relPath));
}
async function isChangelogOnlyCommit(projectRoot, ref, config) {
  const paths = await listCommitChangedPaths(projectRoot, ref);
  return isChangelogOnlyFromPaths(paths, config ?? resolveConfig());
}
function isChangelogOnlyFromPaths(paths, config) {
  if (paths.length === 0) return false;
  return paths.every((p) => isChangelogOnlyPath(p, config));
}
function monthKeyFromIsoDate(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.valueOf())) {
    throw new Error(`Invalid ISO date "${isoDate}".`);
  }
  return isoDate.slice(0, 7);
}
function sliceCommitsSinceAnchor(firstParentHeadHistory, registeredHashes) {
  const anchorIndex = firstParentHeadHistory.findIndex((hash) => registeredHashes.has(hash));
  if (anchorIndex === -1) {
    return {
      anchorHash: null,
      commitsSinceAnchor: firstParentHeadHistory
    };
  }
  return {
    anchorHash: firstParentHeadHistory[anchorIndex] ?? null,
    commitsSinceAnchor: firstParentHeadHistory.slice(0, anchorIndex)
  };
}
function shortHash(hash) {
  return hash.slice(0, 7);
}
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
z.object({
  generatedAt: z.string().min(1),
  months: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      entries: z.array(changelogEntrySchema)
    })
  )
});

// src/core/registry.ts
async function readRegistry(projectRoot, config) {
  const resolved = config ?? resolveConfig();
  const abs = path2.join(projectRoot, resolved.registryPath);
  const text = await readFile(abs, "utf8");
  const parsed = (await import('yaml')).parse(text);
  return changelogRegistrySchema.parse(parsed);
}
async function writeRegistry(projectRoot, registry, config) {
  const resolved = config ?? resolveConfig();
  const abs = path2.join(projectRoot, resolved.registryPath);
  await mkdir(path2.dirname(abs), { recursive: true });
  const lines = ["entries:"];
  for (const entry of registry.entries) {
    lines.push("  - refs:");
    for (const ref of entry.refs) {
      lines.push(`      - '${ref.replaceAll("'", "''")}'`);
    }
    if (entry.hide) {
      lines.push("    hide: true");
      continue;
    }
    lines.push("    descriptionMd: |");
    for (const line of entry.descriptionMd.split("\n")) {
      lines.push(`      ${line}`);
    }
  }
  const yaml = `${lines.join("\n")}
`;
  await writeFile(abs, yaml, "utf8");
}

// src/core/build.ts
function normalizeMarkdownBody(markdown) {
  return markdown.trim().replace(/\n{3,}/g, "\n\n");
}
function renderMarkdown(entriesByMonth, registryPath) {
  const monthKeys = Array.from(entriesByMonth.keys()).sort((a, b) => b.localeCompare(a));
  const lines = [];
  lines.push("# Changelog");
  lines.push("");
  lines.push(`Automatisch aus \`${registryPath}\` erzeugt.`);
  lines.push("");
  for (const month of monthKeys) {
    lines.push(`## ${month}`);
    lines.push("");
    const monthEntries = entriesByMonth.get(month) ?? [];
    const sortedEntries = [...monthEntries].sort(
      (a, b) => b.committedAtIso.localeCompare(a.committedAtIso)
    );
    for (const entry of sortedEntries) {
      const refsText = entry.refs.map((ref) => `\`${shortHash(ref)}\``).join(", ");
      lines.push(`### ${refsText}`);
      lines.push("");
      lines.push(normalizeMarkdownBody(entry.descriptionMd));
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}
function normalizeGeneratedJsonForComparison(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    delete parsed.generatedAt;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}
async function buildChangelog(projectRoot, config) {
  const resolvedConfig = resolveConfig(config);
  const registry = await readRegistry(projectRoot, resolvedConfig);
  const renderable = [];
  for (const entry of registry.entries) {
    if (entry.hide) continue;
    const firstRef = entry.refs[0];
    const resolved = await resolveCommitRef(projectRoot, firstRef);
    if (!resolved.hash) {
      throw new Error(`Could not resolve first ref "${firstRef}" for visible changelog entry.`);
    }
    const commitInfo = await readCommitInfo(projectRoot, resolved.hash);
    renderable.push({
      refs: entry.refs,
      descriptionMd: entry.descriptionMd,
      committedAtIso: commitInfo.committedAtIso,
      month: monthKeyFromIsoDate(commitInfo.committedAtIso)
    });
  }
  const byMonth = /* @__PURE__ */ new Map();
  for (const entry of renderable) {
    const rows = byMonth.get(entry.month) ?? [];
    rows.push(entry);
    byMonth.set(entry.month, rows);
  }
  const markdown = renderMarkdown(byMonth, resolvedConfig.registryPath);
  const changelogMdAbs = path2.join(projectRoot, resolvedConfig.outputMarkdownPath);
  await writeFile(changelogMdAbs, markdown, "utf8");
  const jsonAbs = path2.join(projectRoot, resolvedConfig.outputJsonPath);
  await mkdir(path2.dirname(jsonAbs), { recursive: true });
  const monthKeys = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));
  const payload = {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    months: monthKeys.map((month) => {
      const entries = (byMonth.get(month) ?? []).sort((a, b) => b.committedAtIso.localeCompare(a.committedAtIso)).map((entry) => ({
        refs: entry.refs,
        descriptionMd: normalizeMarkdownBody(entry.descriptionMd),
        committedAtIso: entry.committedAtIso,
        committedAtShort: entry.committedAtIso.slice(0, 10),
        refsDisplay: entry.refs.map((ref) => shortHash(ref))
      }));
      return { month, entries };
    })
  };
  const nextJsonText = `${JSON.stringify(payload, null, 2)}
`;
  let shouldWriteJson = true;
  try {
    const existingJsonText = await readFile(jsonAbs, "utf8");
    const existingNormalized = normalizeGeneratedJsonForComparison(existingJsonText);
    const nextNormalized = normalizeGeneratedJsonForComparison(nextJsonText);
    if (existingNormalized !== null && nextNormalized !== null && existingNormalized === nextNormalized) {
      shouldWriteJson = false;
    }
  } catch (error) {
    const code = error.code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
  if (shouldWriteJson) {
    await writeFile(jsonAbs, nextJsonText, "utf8");
  }
  return { payload, wroteJson: shouldWriteJson };
}

// src/core/prefill.ts
var HIDE_TERMS = ["chore", "lint", "autoformat"];
var VISIBLE_HINT_TERMS = ["feature", "improve"];
var PREFILTER_BATCH_SIZE = 128;
function shouldHideFromSubject(subject) {
  const lower = subject.toLowerCase();
  const hasHiddenTerm = HIDE_TERMS.some((term) => lower.includes(term));
  const hasVisibleHint = VISIBLE_HINT_TERMS.some((term) => lower.includes(term));
  return hasHiddenTerm && !hasVisibleHint;
}
function draftDescription(subject, body) {
  const cleanSubject = subject.trim();
  const bodyParagraph = body.split("\n\n").map((part) => part.trim()).find(Boolean);
  if (!bodyParagraph) return cleanSubject;
  const firstLine = bodyParagraph.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine) return cleanSubject;
  if (firstLine.toLowerCase() === cleanSubject.toLowerCase()) return cleanSubject;
  return `${cleanSubject}
${firstLine}`;
}
async function prefillChangelog(projectRoot, config) {
  const resolvedConfig = resolveConfig(config);
  const registry = await readRegistry(projectRoot, resolvedConfig);
  const history = await listFirstParentHeadHistory(projectRoot);
  const historySet = new Set(history);
  let removedStaleRefCount = 0;
  const refResolveCache = /* @__PURE__ */ new Map();
  const resolveRefCached = async (ref) => {
    const hit = refResolveCache.get(ref);
    if (hit) return hit;
    const r = await resolveCommitRef(projectRoot, ref);
    refResolveCache.set(ref, r);
    return r;
  };
  const entryCountBeforeCleanup = registry.entries.length;
  const cleanedEntries = await Promise.all(
    registry.entries.map(async (entry) => {
      const keepRefs = [];
      for (const ref of entry.refs) {
        const resolved = await resolveRefCached(ref);
        if (!resolved.hash || !historySet.has(resolved.hash)) {
          removedStaleRefCount += 1;
          continue;
        }
        keepRefs.push(ref);
      }
      return {
        ...entry,
        refs: keepRefs
      };
    })
  );
  registry.entries = cleanedEntries.filter((entry) => entry.refs.length > 0);
  const removedEmptyEntryCount = entryCountBeforeCleanup - registry.entries.length;
  const existingRefs = registry.entries.flatMap((entry) => entry.refs);
  const registeredHashes = /* @__PURE__ */ new Set();
  for (const ref of existingRefs) {
    const resolved = await resolveRefCached(ref);
    if (resolved.hash) {
      registeredHashes.add(resolved.hash);
    }
  }
  const { anchorHash, commitsSinceAnchor } = sliceCommitsSinceAnchor(history, registeredHashes);
  const missingCommits = commitsSinceAnchor.filter((hash) => !registeredHashes.has(hash));
  const orderedMissing = [...missingCommits].reverse();
  const missingNonChangelogCommits = [];
  let skippedChangelogOnlyCount = 0;
  let skippedIgnoredCount = 0;
  let skippedOptOutCount = 0;
  const commitInfoCache = /* @__PURE__ */ new Map();
  for (let offset = 0; offset < orderedMissing.length; offset += PREFILTER_BATCH_SIZE) {
    const slice = orderedMissing.slice(offset, offset + PREFILTER_BATCH_SIZE);
    const uniq = [...new Set(slice)];
    const [pathsByHash, infoByHash] = await Promise.all([
      listCommitsChangedPathsBatch(projectRoot, uniq),
      readCommitsInfoBatch(projectRoot, uniq)
    ]);
    for (const hash of slice) {
      let paths = pathsByHash.get(hash);
      if (paths === void 0) {
        paths = await listCommitChangedPaths(projectRoot, hash);
      }
      if (isChangelogOnlyFromPaths(paths, resolvedConfig)) {
        skippedChangelogOnlyCount += 1;
        continue;
      }
      let commit = infoByHash.get(hash);
      if (!commit) {
        commit = await readCommitInfo(projectRoot, hash);
      }
      if (isIgnoredFromCommit(commit, resolvedConfig)) {
        skippedIgnoredCount += 1;
        continue;
      }
      if (isChangelogOptOutFromCommit(commit)) {
        skippedOptOutCount += 1;
        continue;
      }
      const canonicalHash = commit.hash;
      commitInfoCache.set(canonicalHash, commit);
      missingNonChangelogCommits.push(canonicalHash);
    }
  }
  const addedEntries = [];
  for (const hash of missingNonChangelogCommits) {
    const commit = commitInfoCache.get(hash) ?? await readCommitInfo(projectRoot, hash);
    if (shouldHideFromSubject(commit.subject)) {
      const entry2 = {
        refs: [shortHash(commit.hash)],
        hide: true
      };
      registry.entries.push(entry2);
      addedEntries.push(entry2);
      continue;
    }
    const entry = {
      refs: [shortHash(commit.hash)],
      hide: false,
      descriptionMd: draftDescription(commit.subject, commit.body)
    };
    registry.entries.push(entry);
    addedEntries.push(entry);
  }
  if (addedEntries.length > 0 || removedStaleRefCount > 0 || removedEmptyEntryCount > 0) {
    await writeRegistry(projectRoot, registry, resolvedConfig);
  }
  return {
    addedEntries,
    removedStaleRefCount,
    removedEmptyEntryCount,
    skippedChangelogOnlyCount,
    skippedIgnoredCount,
    skippedOptOutCount,
    anchorHash
  };
}
async function verifyChangelog(projectRoot, config) {
  const resolvedConfig = resolveConfig(config);
  const registryAbsPath = path2.join(projectRoot, resolvedConfig.registryPath);
  const registry = await readRegistry(projectRoot, resolvedConfig);
  const remediation = [
    `[changelog:verify] Registry file: ${registryAbsPath}`,
    "[changelog:verify] Next step: bun run changelog:prefill",
    "[changelog:verify] Then run: bun run changelog:verify"
  ];
  const resolvedRows = [];
  for (let entryIndex = 0; entryIndex < registry.entries.length; entryIndex += 1) {
    const entry = registry.entries[entryIndex];
    for (const ref of entry.refs) {
      const resolved = await resolveCommitRef(projectRoot, ref);
      resolvedRows.push({
        entryIndex,
        inputRef: ref,
        resolvedHash: resolved.hash
      });
    }
  }
  const invalidRefs = resolvedRows.filter((row) => row.resolvedHash === null);
  if (invalidRefs.length > 0) {
    const list = invalidRefs.map((row) => `entry #${row.entryIndex + 1}: ${row.inputRef}`).join("\n");
    throw new Error(
      ["[changelog:verify] Invalid refs found in changelog registry:", list, ...remediation].join(
        "\n"
      )
    );
  }
  const firstParentHistory = await listFirstParentHeadHistory(projectRoot);
  const historySet = new Set(firstParentHistory);
  const staleRows = resolvedRows.filter((row) => {
    if (!row.resolvedHash) return false;
    return !historySet.has(row.resolvedHash);
  });
  if (staleRows.length > 0) {
    const list = staleRows.map((row) => `entry #${row.entryIndex + 1}: ${row.inputRef}`).join("\n");
    throw new Error(
      [
        "[changelog:verify] Stale refs found in changelog registry (not in first-parent HEAD history):",
        list,
        ...remediation
      ].join("\n")
    );
  }
  const byHash = /* @__PURE__ */ new Map();
  for (const row of resolvedRows) {
    const hash = row.resolvedHash;
    if (!hash) continue;
    const list = byHash.get(hash) ?? [];
    list.push(row);
    byHash.set(hash, list);
  }
  const duplicateHashes = Array.from(byHash.entries()).filter(([, rows]) => rows.length > 1);
  if (duplicateHashes.length > 0) {
    const list = duplicateHashes.map(([hash, rows]) => {
      const locations = rows.map((row) => `entry #${row.entryIndex + 1} (${row.inputRef})`).join(", ");
      return `- ${shortHash(hash)} appears multiple times: ${locations}`;
    }).join("\n");
    throw new Error(
      [
        "[changelog:verify] Duplicate commit coverage found:",
        list,
        `[changelog:verify] Registry file: ${registryAbsPath}`
      ].join("\n")
    );
  }
  const registeredHashes = new Set(Array.from(byHash.keys()));
  const { anchorHash, commitsSinceAnchor } = sliceCommitsSinceAnchor(
    firstParentHistory,
    registeredHashes
  );
  const missingCommits = commitsSinceAnchor.filter((hash) => !registeredHashes.has(hash));
  const missingNonChangelogCommits = [];
  let skippedChangelogOnlyCount = 0;
  let skippedIgnoredCount = 0;
  let skippedOptOutCount = 0;
  for (const hash of missingCommits) {
    if (await isChangelogOnlyCommit(projectRoot, hash, resolvedConfig)) {
      skippedChangelogOnlyCount += 1;
      continue;
    }
    if (await isIgnoredCommit(projectRoot, hash, resolvedConfig)) {
      skippedIgnoredCount += 1;
      continue;
    }
    if (await isChangelogOptOutCommit(projectRoot, hash)) {
      skippedOptOutCount += 1;
      continue;
    }
    missingNonChangelogCommits.push(hash);
  }
  if (missingNonChangelogCommits.length > 0) {
    const commits = await Promise.all(
      missingNonChangelogCommits.map(async (hash) => {
        const commit = await readCommitInfo(projectRoot, hash);
        return `${shortHash(hash)} ${commit.subject}`;
      })
    );
    const anchorLine = anchorHash ? `[changelog:verify] Anchor commit: ${shortHash(anchorHash)}.` : "[changelog:verify] No anchor commit found in registry; checked from HEAD back.";
    throw new Error(
      [
        "[changelog:verify] Missing commits in changelog registry:",
        ...commits.map((line) => `- ${line}`),
        anchorLine,
        ...remediation
      ].join("\n")
    );
  }
  const checkedCount = commitsSinceAnchor.length;
  return {
    checkedNonChangelogCount: checkedCount - skippedChangelogOnlyCount - skippedIgnoredCount - skippedOptOutCount,
    skippedChangelogOnlyCount,
    skippedIgnoredCount,
    skippedOptOutCount,
    anchorHash
  };
}

// src/cli/args.ts
function readRawArgs(argv) {
  const map = /* @__PURE__ */ new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      const list2 = map.get(key) ?? [];
      list2.push("true");
      map.set(key, list2);
      continue;
    }
    const list = map.get(key) ?? [];
    list.push(next);
    map.set(key, list);
    i += 1;
  }
  return map;
}
function parseCliContext(argv) {
  const args = readRawArgs(argv);
  const projectRoot = args.get("project-root")?.at(-1) ?? process.cwd();
  const config = {
    registryPath: args.get("registry-path")?.at(-1),
    outputJsonPath: args.get("output-json-path")?.at(-1),
    outputMarkdownPath: args.get("output-markdown-path")?.at(-1),
    changelogOnlyPaths: args.get("changelog-only-path"),
    ignoredCommitTerms: args.get("ignore-commit-term")
  };
  return { projectRoot, config };
}

export { buildChangelog, parseCliContext, prefillChangelog, resolveConfig, shortHash, verifyChangelog };
//# sourceMappingURL=chunk-3ZRK5GL6.js.map
//# sourceMappingURL=chunk-3ZRK5GL6.js.map