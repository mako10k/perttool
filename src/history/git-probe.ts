import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import {
  lstat,
  open,
  realpath,
  type FileHandle,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { digestDocumentBytes } from "../io/document-file.js";

export const GIT_HISTORY_PROBE_MODEL_VERSION = 1 as const;
export const ADVANCE_HISTORY_BASELINE_MODEL_VERSION = 1 as const;
export const HISTORICAL_GIT_EVIDENCE_MODEL_VERSION = 1 as const;

export const HISTORICAL_GIT_EVIDENCE_LIMITS = Object.freeze({
  inspectedCommits: 2_048,
  rawBytesPerSnapshot: 8_388_608,
  aggregateRawSnapshotBytes: 134_217_728,
});

export type GitHistoryStatus = "complete" | "incomplete" | "unavailable";

export type GitHistoryCause =
  | "no_repository"
  | "no_head"
  | "unknown_revision"
  | "untracked_target"
  | "ambiguous_path"
  | "shallow_boundary"
  | "unsupported_rename"
  | "provenance_unavailable"
  | "head_changed"
  | "target_changed";

export interface GitHistoryAvailability {
  readonly cause: GitHistoryCause;
  readonly commitId: string | null;
}

export interface PlanRevisionSnapshot {
  readonly repositorySnapshotId: string;
  readonly relativePath: string;
  readonly commitId: string;
  readonly parentCommitIds: readonly string[];
  readonly recordedAt: string | null;
  readonly sourceDigest: string | null;
  readonly source: Uint8Array | null;
}

export interface GitHistoryProbeRequest {
  readonly targetPath: string;
  readonly revision?: string;
  readonly expectedSourceDigest?: string;
  readonly provenanceMode?: "automatic" | "new_root";
}

export interface GitHistoryPredecessorEvidence {
  readonly path: string;
  readonly commitId: string;
  readonly sourceDigest: string;
  readonly source: Uint8Array;
}

export interface GitHistoryProvenanceEvidence {
  readonly modelVersion: 1;
  readonly requestedMode: "automatic" | "new_root";
  readonly effectiveMode: "automatic" | "new_root";
  readonly overrideApplied: boolean;
  readonly rootCommitId: string | null;
  readonly rootSourceDigest: string | null;
  readonly excludedPredecessors: readonly GitHistoryPredecessorEvidence[];
}

export interface GitHistoryProbeDependencies {
  readonly gitExecutable?: string;
  readonly afterSnapshots?: () => void | Promise<void>;
}

export interface GitHistoryProbeResult {
  readonly ok: true;
  readonly modelVersion: typeof GIT_HISTORY_PROBE_MODEL_VERSION;
  readonly status: GitHistoryStatus;
  readonly traversal: "first_parent";
  readonly objectFormat: "sha1" | "sha256" | null;
  readonly repositorySnapshotId: string | null;
  readonly repositoryRelativePath: string | null;
  readonly requestedRevision: string;
  readonly resolvedRevision: string | null;
  readonly headCommitId: string | null;
  readonly currentSourceDigest: string | null;
  readonly selectedSourceDigest: string | null;
  readonly inspectedCommitIds: readonly string[];
  readonly snapshots: readonly PlanRevisionSnapshot[];
  readonly availability: readonly GitHistoryAvailability[];
  readonly provenance: GitHistoryProvenanceEvidence;
}

export type GitHistoryProbeFailureKind =
  | "git_process_start"
  | "git_process_timeout"
  | "git_command_failed"
  | "malformed_git_output"
  | "filesystem_read";

export interface GitHistoryProbeFailure {
  readonly ok: false;
  readonly modelVersion: typeof GIT_HISTORY_PROBE_MODEL_VERSION;
  readonly kind: GitHistoryProbeFailureKind;
  readonly operation: string;
}

export type GitHistoryProbeOutcome =
  | GitHistoryProbeResult
  | GitHistoryProbeFailure;

export type HistoricalGitEvidenceStatus =
  | "complete"
  | "incomplete"
  | "unavailable";

export type HistoricalGitEvidenceCause =
  | "no_repository"
  | "no_head"
  | "unknown_revision"
  | "ambiguous_revision"
  | "non_commit_revision"
  | "endpoint_path_missing"
  | "lower_path_missing"
  | "lower_not_first_parent_ancestor"
  | "shallow_origin"
  | "unsupported_object_format"
  | "object_read_failed"
  | "repository_race"
  | "hard_limit"
  | "ambiguous_path"
  | "target_changed";

export type HistoricalGitEvidenceSubject =
  | "repository"
  | "endpoint"
  | "lower_boundary"
  | "target_path"
  | "inspection";

export interface HistoricalGitEvidenceCauseRecord {
  readonly cause: HistoricalGitEvidenceCause;
  readonly subject: HistoricalGitEvidenceSubject;
  readonly commitId: string | null;
  readonly limit: keyof typeof HISTORICAL_GIT_EVIDENCE_LIMITS | null;
  readonly actual: number | null;
}

export interface HistoricalGitEvidenceLimits {
  readonly inspectedCommits: number;
  readonly rawBytesPerSnapshot: number;
  readonly aggregateRawSnapshotBytes: number;
}

export interface HistoricalGitInspectionSnapshot {
  readonly modelVersion: typeof HISTORICAL_GIT_EVIDENCE_MODEL_VERSION;
  readonly objectFormat: "sha1" | "sha256";
  readonly repositoryId: string;
  readonly repositoryReadSnapshotId: string;
  readonly repositoryRelativePath: string;
  readonly commitId: string;
  readonly parentCommitIds: readonly string[];
  readonly blobId: string | null;
  readonly sourceDigest: string | null;
  readonly source: Uint8Array | null;
  readonly recordedAt: string | null;
  readonly isMergeCommit: boolean;
  readonly isEndpoint: boolean;
  readonly isLowerBoundary: boolean;
}

export interface HistoricalGitEvidenceRequest {
  readonly targetPath: string;
  readonly requestedEndpoint?: string;
  readonly lowerBoundary?: string;
  readonly expectedSourceDigest?: string;
}

export interface HistoricalGitEvidenceDependencies {
  readonly gitExecutable?: string;
  readonly afterEvidence?: () => void | Promise<void>;
  readonly limits?: Partial<HistoricalGitEvidenceLimits>;
}

export interface HistoricalGitEvidenceResult {
  readonly ok: true;
  readonly modelVersion: typeof HISTORICAL_GIT_EVIDENCE_MODEL_VERSION;
  readonly status: HistoricalGitEvidenceStatus;
  readonly ancestryProfile: "first_parent";
  readonly objectFormat: "sha1" | "sha256" | null;
  readonly repositoryId: string | null;
  readonly repositoryReadSnapshotId: string | null;
  readonly repositoryRelativePath: string | null;
  readonly requestedEndpoint: string;
  readonly resolvedEndpoint: string | null;
  readonly requestedLowerBoundary: string | null;
  readonly resolvedLowerBoundary: string | null;
  readonly oldestInspectedCommitId: string | null;
  readonly currentSourceDigest: string | null;
  readonly aggregateRawSnapshotBytes: number;
  readonly limits: HistoricalGitEvidenceLimits;
  readonly inspectedCommitIds: readonly string[];
  readonly snapshots: readonly HistoricalGitInspectionSnapshot[];
  readonly causes: readonly HistoricalGitEvidenceCauseRecord[];
}

export type HistoricalGitEvidenceOutcome =
  | HistoricalGitEvidenceResult
  | GitHistoryProbeFailure;

export type AdvanceHistoryBaselineCause =
  | "no_repository"
  | "no_head"
  | "untracked_target"
  | "ambiguous_path"
  | "unmerged_index"
  | "git_unavailable"
  | "baseline_read_failed"
  | "correspondence_missing"
  | "target_changed"
  | "head_changed"
  | "index_changed";

export interface AdvanceHistoryBaselineRequest {
  readonly targetPath: string;
  readonly expectedSourceDigest?: string;
}

export interface AdvanceHistoryBaselineDependencies {
  readonly gitExecutable?: string;
  readonly afterCapture?: () => void | Promise<void>;
}

export interface AdvanceHistoryBaselineCapture {
  readonly ok: true;
  readonly modelVersion: typeof ADVANCE_HISTORY_BASELINE_MODEL_VERSION;
  readonly status: "complete" | "unavailable";
  readonly cause: AdvanceHistoryBaselineCause | null;
  readonly operation: string | null;
  readonly objectFormat: "sha1" | "sha256" | null;
  readonly repositorySnapshotId: string | null;
  readonly repositoryRelativePath: string | null;
  readonly headCommitId: string | null;
  readonly headBlobId: string | null;
  readonly indexBlobId: string | null;
  readonly currentSourceDigest: string | null;
  readonly headSourceDigest: string | null;
  readonly indexSourceDigest: string | null;
  readonly sourceModifiedAt: string | null;
  readonly targetDevice: bigint | null;
  readonly targetInode: bigint | null;
  readonly currentSource: Uint8Array | null;
  readonly headSource: Uint8Array | null;
  readonly indexSource: Uint8Array | null;
}

export type AdvanceHistoryBaselineRecheckCause =
  | "target_changed"
  | "head_changed"
  | "index_changed"
  | "baseline_read_failed";

export interface AdvanceHistoryBaselineRecheck {
  readonly ok: boolean;
  readonly cause: AdvanceHistoryBaselineRecheckCause | null;
  readonly operation: string | null;
}

interface TargetCapture {
  readonly realPath: string;
  readonly digest: string;
  readonly device: bigint;
  readonly inode: bigint;
  readonly modifiedAt: string;
  readonly source: Uint8Array;
}

interface GitCommandSuccess {
  readonly ok: true;
  readonly stdout: Buffer;
}

interface GitCommandExit {
  readonly ok: false;
  readonly kind: "exit";
}

interface GitCommandFailure {
  readonly ok: false;
  readonly kind: "failure";
  readonly failure: GitHistoryProbeFailure;
}

type GitCommandResult =
  | GitCommandSuccess
  | GitCommandExit
  | GitCommandFailure;

const gitTimeoutMilliseconds = 30_000;
const gitMaxBufferBytes = 64 * 1024 * 1024;

const availabilityOrder = new Map<GitHistoryCause, number>([
  ["no_repository", 0],
  ["no_head", 1],
  ["unknown_revision", 2],
  ["untracked_target", 3],
  ["ambiguous_path", 4],
  ["shallow_boundary", 5],
  ["unsupported_rename", 6],
  ["provenance_unavailable", 7],
  ["head_changed", 8],
  ["target_changed", 9],
]);

function emptyProvenance(
  requestedMode: "automatic" | "new_root",
): GitHistoryProvenanceEvidence {
  return Object.freeze({
    modelVersion: 1,
    requestedMode,
    effectiveMode: "automatic",
    overrideApplied: false,
    rootCommitId: null,
    rootSourceDigest: null,
    excludedPredecessors: Object.freeze([]),
  });
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { readonly code?: unknown }).code)
    : undefined;
}

function gitEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_NAMESPACE",
  ]) {
    delete environment[name];
  }
  environment["GIT_OPTIONAL_LOCKS"] = "0";
  environment["GIT_TERMINAL_PROMPT"] = "0";
  environment["GIT_NO_LAZY_FETCH"] = "1";
  environment["GIT_NO_REPLACE_OBJECTS"] = "1";
  environment["LC_ALL"] = "C";
  return environment;
}

function runGit(
  executable: string,
  workingDirectory: string,
  operation: string,
  arguments_: readonly string[],
): GitCommandResult {
  const result = spawnSync(
    executable,
    [
      "--no-optional-locks",
      "--no-replace-objects",
      "-C",
      workingDirectory,
      ...arguments_,
    ],
    {
      encoding: null,
      env: gitEnvironment(),
      maxBuffer: gitMaxBufferBytes,
      timeout: gitTimeoutMilliseconds,
      windowsHide: true,
    },
  );
  if (result.error !== undefined) {
    return {
      ok: false,
      kind: "failure",
      failure: {
        ok: false,
        modelVersion: GIT_HISTORY_PROBE_MODEL_VERSION,
        kind:
          errorCode(result.error) === "ETIMEDOUT"
            ? "git_process_timeout"
            : "git_process_start",
        operation,
      },
    };
  }
  if (result.signal !== null) {
    return {
      ok: false,
      kind: "failure",
      failure: {
        ok: false,
        modelVersion: GIT_HISTORY_PROBE_MODEL_VERSION,
        kind: "git_process_timeout",
        operation,
      },
    };
  }
  if (result.status !== 0) return { ok: false, kind: "exit" };
  return {
    ok: true,
    stdout: Buffer.isBuffer(result.stdout)
      ? result.stdout
      : Buffer.from(result.stdout ?? ""),
  };
}

function stdoutText(
  result: GitCommandSuccess,
  operation: string,
): string | GitHistoryProbeFailure {
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(result.stdout)
      .replace(/\r?\n$/, "");
  } catch {
    return {
      ok: false,
      modelVersion: GIT_HISTORY_PROBE_MODEL_VERSION,
      kind: "malformed_git_output",
      operation,
    };
  }
}

function malformed(operation: string): GitHistoryProbeFailure {
  return {
    ok: false,
    modelVersion: GIT_HISTORY_PROBE_MODEL_VERSION,
    kind: "malformed_git_output",
    operation,
  };
}

function commandFailure(operation: string): GitHistoryProbeFailure {
  return {
    ok: false,
    modelVersion: GIT_HISTORY_PROBE_MODEL_VERSION,
    kind: "git_command_failed",
    operation,
  };
}

function fileFailure(operation: string): GitHistoryProbeFailure {
  return {
    ok: false,
    modelVersion: GIT_HISTORY_PROBE_MODEL_VERSION,
    kind: "filesystem_read",
    operation,
  };
}

async function captureTarget(path: string): Promise<
  | { readonly ok: true; readonly capture: TargetCapture }
  | { readonly ok: false; readonly ambiguous: true }
  | { readonly ok: false; readonly failure: GitHistoryProbeFailure }
> {
  let pathStat;
  try {
    pathStat = await lstat(path, { bigint: true });
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return { ok: false, ambiguous: true };
    }
    return { ok: false, failure: fileFailure("target_lstat") };
  }
  if (pathStat.isSymbolicLink() || !pathStat.isFile()) {
    return { ok: false, ambiguous: true };
  }

  let handle: FileHandle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (errorCode(error) === "ELOOP" || errorCode(error) === "ENOENT") {
      return { ok: false, ambiguous: true };
    }
    return { ok: false, failure: fileFailure("target_open") };
  }

  try {
    const openedStat = await handle.stat({ bigint: true });
    if (
      !openedStat.isFile() ||
      openedStat.dev !== pathStat.dev ||
      openedStat.ino !== pathStat.ino
    ) {
      return { ok: false, ambiguous: true };
    }
    const [bytes, resolvedPath] = await Promise.all([
      handle.readFile(),
      realpath(path),
    ]);
    return {
      ok: true,
      capture: {
        realPath: resolvedPath,
        digest: digestDocumentBytes(bytes),
        device: openedStat.dev,
        inode: openedStat.ino,
        modifiedAt: new Date(
          Number(openedStat.mtimeNs / 1_000_000n),
        ).toISOString(),
        source: new Uint8Array(bytes),
      },
    };
  } catch {
    return { ok: false, failure: fileFailure("target_read") };
  } finally {
    await handle.close();
  }
}

function availability(
  causes: readonly GitHistoryAvailability[],
): readonly GitHistoryAvailability[] {
  return Object.freeze(
    [...causes].sort((left, right) => {
      const causeOrder =
        availabilityOrder.get(left.cause)! -
        availabilityOrder.get(right.cause)!;
      if (causeOrder !== 0) return causeOrder;
      return (left.commitId ?? "").localeCompare(right.commitId ?? "", "en");
    }),
  );
}

function unavailable(
  requestedRevision: string,
  cause: GitHistoryCause,
  fields: Partial<
    Pick<
      GitHistoryProbeResult,
      | "objectFormat"
      | "repositorySnapshotId"
      | "repositoryRelativePath"
      | "resolvedRevision"
      | "headCommitId"
      | "currentSourceDigest"
      | "selectedSourceDigest"
      | "inspectedCommitIds"
      | "snapshots"
      | "provenance"
    >
  >,
): GitHistoryProbeResult {
  return {
    ok: true,
    modelVersion: GIT_HISTORY_PROBE_MODEL_VERSION,
    status: "unavailable",
    traversal: "first_parent",
    objectFormat: nullable(fields.objectFormat),
    repositorySnapshotId: nullable(fields.repositorySnapshotId),
    repositoryRelativePath: nullable(fields.repositoryRelativePath),
    requestedRevision,
    resolvedRevision: nullable(fields.resolvedRevision),
    headCommitId: nullable(fields.headCommitId),
    currentSourceDigest: nullable(fields.currentSourceDigest),
    selectedSourceDigest: nullable(fields.selectedSourceDigest),
    inspectedCommitIds: arrayValue(fields.inspectedCommitIds),
    snapshots: arrayValue(fields.snapshots),
    availability: availability([{ cause, commitId: null }]),
    provenance: fields.provenance ?? emptyProvenance("automatic"),
  };
}

function nullable<Value>(value: Value | undefined): Value | null {
  return value === undefined ? null : value;
}

function arrayValue<Value>(value: readonly Value[] | undefined): readonly Value[] {
  return value === undefined ? [] : value;
}

function commitId(
  value: string,
  objectFormat: "sha1" | "sha256",
): boolean {
  const length = objectFormat === "sha1" ? 40 : 64;
  return new RegExp(`^[0-9a-f]{${length}}$`).test(value);
}

function decodeGitPath(value: Buffer): string | null {
  try {
    const path = new TextDecoder("utf-8", { fatal: true }).decode(value);
    return path === "" || /[\u0000\r\n]/.test(path) ? null : path;
  } catch {
    return null;
  }
}

interface RenameCandidate {
  readonly oldPath: string;
  readonly newPath: string;
}

function renameCandidates(
  value: Buffer,
  selectedPath: string,
): readonly RenameCandidate[] | null {
  if (value.length === 0) return Object.freeze([]);
  const fields = value.subarray(0, value.at(-1) === 0 ? -1 : value.length)
    .toString("latin1").split("\u0000").map((field) =>
      Buffer.from(field, "latin1")
    );
  const result: RenameCandidate[] = [];
  for (let index = 0; index < fields.length;) {
    const record = consumeDiffRecord(fields, index, selectedPath);
    if (record === null) return null;
    index = record.nextIndex;
    if (record.candidate !== null) result.push(record.candidate);
  }
  return Object.freeze(result);
}

interface DiffRecord {
  readonly nextIndex: number;
  readonly candidate: RenameCandidate | null;
}

function consumeDiffRecord(
  fields: readonly Buffer[],
  index: number,
  selectedPath: string,
): DiffRecord | null {
  const statusField = fields[index];
  if (statusField === undefined) return null;
  const status = statusField.toString("ascii");
  if (!/^[A-Z][0-9]*$/.test(status)) return null;
  if (!status.startsWith("R") && !status.startsWith("C")) {
    const path = fields[index + 1];
    return path !== undefined && decodeGitPath(path) !== null
      ? { nextIndex: index + 2, candidate: null }
      : null;
  }
  const oldPath = fields[index + 1];
  const newPath = fields[index + 2];
  if (oldPath === undefined || newPath === undefined) return null;
  const oldText = decodeGitPath(oldPath);
  const newText = decodeGitPath(newPath);
  if (oldText === null || newText === null) return null;
  const candidate = status.startsWith("R") && newText === selectedPath
    ? { oldPath: oldText, newPath: newText }
    : null;
  return { nextIndex: index + 3, candidate };
}

interface SnapshotCollectionRequest {
  readonly executable: string;
  readonly repositoryRoot: string;
  readonly repositorySnapshotId: string;
  readonly relativePath: string;
  readonly objectFormat: "sha1" | "sha256";
  readonly inspectedCommitIds: readonly string[];
}

function collectHistorySnapshots(
  request: SnapshotCollectionRequest,
): { readonly ok: true; readonly snapshots: readonly PlanRevisionSnapshot[] }
  | GitHistoryProbeFailure {
  const snapshots: PlanRevisionSnapshot[] = [];
  for (const inspectedCommitId of request.inspectedCommitIds) {
    const metadataCommand = runGit(
      request.executable, request.repositoryRoot, "commit_metadata",
      ["show", "-s", "--format=%P%x00%cI", inspectedCommitId],
    );
    if (!metadataCommand.ok) {
      return metadataCommand.kind === "failure"
        ? metadataCommand.failure
        : commandFailure("commit_metadata");
    }
    const metadataText = stdoutText(metadataCommand, "commit_metadata");
    if (typeof metadataText !== "string") return metadataText;
    const metadata = parseGitCommitMetadata(metadataText, request.objectFormat);
    if (metadata === null) return malformed("commit_metadata");
    const exists = runGit(
      request.executable, request.repositoryRoot, "snapshot_exists",
      ["ls-tree", "-z", "--name-only", inspectedCommitId, "--", request.relativePath],
    );
    if (!exists.ok) {
      return exists.kind === "failure"
        ? exists.failure
        : commandFailure("snapshot_exists");
    }
    let source: Uint8Array | null = null;
    let sourceDigest: string | null = null;
    if (exists.stdout.length > 0) {
      if (!exists.stdout.equals(Buffer.from(`${request.relativePath}\0`, "utf8"))) {
        return malformed("snapshot_exists");
      }
      const sourceCommand = runGit(
        request.executable, request.repositoryRoot, "snapshot_source",
        ["cat-file", "blob", `${inspectedCommitId}:${request.relativePath}`],
      );
      if (!sourceCommand.ok) {
        return sourceCommand.kind === "failure"
          ? sourceCommand.failure
          : commandFailure("snapshot_source");
      }
      source = new Uint8Array(sourceCommand.stdout);
      sourceDigest = digestDocumentBytes(source);
    }
    snapshots.push({
      repositorySnapshotId: request.repositorySnapshotId,
      relativePath: request.relativePath,
      commitId: inspectedCommitId,
      parentCommitIds: metadata.parentCommitIds,
      recordedAt: metadata.recordedAt,
      sourceDigest,
      source,
    });
  }
  return { ok: true, snapshots: Object.freeze(snapshots) };
}

function treeBlobId(
  value: Buffer,
  expectedPath: string,
  objectFormat: "sha1" | "sha256",
): string | null {
  const fields = value.subarray(0, value.at(-1) === 0 ? -1 : value.length)
    .toString("latin1").split("\u0000").map((field) =>
      Buffer.from(field, "latin1")
    );
  if (fields.length !== 1) return null;
  const separator = fields[0]!.indexOf(0x09);
  if (separator < 0) return null;
  const metadata = fields[0]!.subarray(0, separator).toString("ascii");
  const path = decodeGitPath(fields[0]!.subarray(separator + 1));
  const match = /^[0-7]{6} blob ([0-9a-f]+)$/.exec(metadata);
  return path === expectedPath && match !== null && commitId(match[1]!, objectFormat)
    ? match[1]!
    : null;
}

function probeNewRootProvenance(
  executable: string,
  repositoryRoot: string,
  relativePath: string,
  objectFormat: "sha1" | "sha256",
  snapshots: readonly PlanRevisionSnapshot[],
): GitHistoryProvenanceEvidence | null {
  const root = snapshots[0];
  if (root === undefined || root.source === null || root.sourceDigest === null) {
    return null;
  }
  if (root.parentCommitIds.length !== 1) return null;
  const parentCommitId = root.parentCommitIds[0]!;
  const diff = runGit(executable, repositoryRoot, "provenance_root_diff", [
    "diff-tree", "-r", "--name-status", "-z", "-M",
    parentCommitId, root.commitId,
  ]);
  if (!diff.ok) return null;
  const candidates = renameCandidates(diff.stdout, relativePath);
  if (candidates === null || candidates.length !== 1) return null;
  const predecessorPath = candidates[0]!.oldPath;
  const tree = runGit(executable, repositoryRoot, "provenance_predecessor_tree", [
    "ls-tree", "-z", parentCommitId, "--", predecessorPath,
  ]);
  if (!tree.ok) return null;
  const blobId = treeBlobId(tree.stdout, predecessorPath, objectFormat);
  if (blobId === null) return null;
  const source = runGit(executable, repositoryRoot, "provenance_predecessor_source", [
    "cat-file", "blob", blobId,
  ]);
  if (!source.ok) return null;
  const predecessorSource = new Uint8Array(source.stdout);
  return Object.freeze({
    modelVersion: 1,
    requestedMode: "new_root",
    effectiveMode: "new_root",
    overrideApplied: true,
    rootCommitId: root.commitId,
    rootSourceDigest: root.sourceDigest,
    excludedPredecessors: Object.freeze([Object.freeze({
      path: predecessorPath,
      commitId: parentCommitId,
      sourceDigest: digestDocumentBytes(predecessorSource),
      source: predecessorSource,
    })]),
  });
}

export function parseGitCommitMetadata(
  value: string,
  objectFormat: "sha1" | "sha256",
): {
  readonly parentCommitIds: readonly string[];
  readonly recordedAt: string | null;
} | null {
  const separatorIndex = value.indexOf("\0");
  if (separatorIndex === -1) return null;
  const parentText = value.slice(0, separatorIndex).trim();
  const recordedAtText = value.slice(separatorIndex + 1).trim();
  const parentCommitIds = parentText === ""
    ? []
    : parentText.split(" ");
  if (
    parentCommitIds.some((id) => !commitId(id, objectFormat)) ||
    (
      recordedAtText !== "" &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(
        recordedAtText,
      )
    )
  ) {
    return null;
  }
  return Object.freeze({
    parentCommitIds: Object.freeze(parentCommitIds),
    recordedAt: recordedAtText === "" ? null : recordedAtText,
  });
}

function normalizeRepositoryPath(
  repositoryRoot: string,
  targetPath: string,
): string | null {
  const path = relative(repositoryRoot, targetPath);
  if (
    path === "" ||
    isAbsolute(path) ||
    path === ".." ||
    path.startsWith(`..${sep}`)
  ) {
    return null;
  }
  const portable = sep === "/" ? path : path.split(sep).join("/");
  if (
    portable.startsWith("/") ||
    portable.split("/").some((part) => part === "" || part === "..") ||
    /[\u0000\r\n]/.test(portable)
  ) {
    return null;
  }
  return portable;
}

function sameTarget(
  left: TargetCapture,
  right: TargetCapture,
): boolean {
  return (
    left.realPath === right.realPath &&
    left.digest === right.digest &&
    left.device === right.device &&
    left.inode === right.inode
  );
}

export async function probeGitHistory(
  request: GitHistoryProbeRequest,
  dependencies: GitHistoryProbeDependencies = {},
): Promise<GitHistoryProbeOutcome> {
  const requestedRevision = request.revision ?? "HEAD";
  const requestedProvenanceMode = request.provenanceMode ?? "automatic";
  const initialProvenance = emptyProvenance(requestedProvenanceMode);
  const executable = dependencies.gitExecutable ?? "git";
  const targetPath = resolve(request.targetPath);
  const initialTarget = await captureTarget(targetPath);
  if (!initialTarget.ok) {
    if ("ambiguous" in initialTarget) {
      return unavailable(requestedRevision, "ambiguous_path", {
        provenance: initialProvenance,
      });
    }
    return initialTarget.failure;
  }

  const repositoryCommand = runGit(
    executable,
    dirname(initialTarget.capture.realPath),
    "repository_root",
    ["rev-parse", "--path-format=absolute", "--show-toplevel"],
  );
  if (!repositoryCommand.ok) {
    if (repositoryCommand.kind === "failure") {
      return repositoryCommand.failure;
    }
    return unavailable(requestedRevision, "no_repository", {
      currentSourceDigest: initialTarget.capture.digest,
      provenance: initialProvenance,
    });
  }
  const repositoryText = stdoutText(repositoryCommand, "repository_root");
  if (typeof repositoryText !== "string") return repositoryText;

  let repositoryRoot: string;
  try {
    repositoryRoot = await realpath(repositoryText);
  } catch {
    return commandFailure("repository_root");
  }
  const relativePath = normalizeRepositoryPath(
    repositoryRoot,
    initialTarget.capture.realPath,
  );
  if (relativePath === null) {
    return unavailable(requestedRevision, "ambiguous_path", {
      currentSourceDigest: initialTarget.capture.digest,
      provenance: initialProvenance,
    });
  }

  const headCommand = runGit(
    executable,
    repositoryRoot,
    "resolve_head",
    ["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"],
  );
  if (!headCommand.ok) {
    if (headCommand.kind === "failure") return headCommand.failure;
    return unavailable(requestedRevision, "no_head", {
      repositoryRelativePath: relativePath,
      currentSourceDigest: initialTarget.capture.digest,
      provenance: initialProvenance,
    });
  }

  const formatCommand = runGit(
    executable,
    repositoryRoot,
    "object_format",
    ["rev-parse", "--show-object-format=storage"],
  );
  if (!formatCommand.ok) {
    return formatCommand.kind === "failure"
      ? formatCommand.failure
      : commandFailure("object_format");
  }
  const formatText = stdoutText(formatCommand, "object_format");
  if (typeof formatText !== "string") return formatText;
  if (formatText !== "sha1" && formatText !== "sha256") {
    return malformed("object_format");
  }
  const objectFormat = formatText;

  const headText = stdoutText(headCommand, "resolve_head");
  if (typeof headText !== "string") return headText;
  if (!commitId(headText, objectFormat)) return malformed("resolve_head");
  const initialHead = headText;

  const revisionCommand = runGit(
    executable,
    repositoryRoot,
    "resolve_revision",
    [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${requestedRevision}^{commit}`,
    ],
  );
  if (!revisionCommand.ok) {
    if (revisionCommand.kind === "failure") return revisionCommand.failure;
    return unavailable(requestedRevision, "unknown_revision", {
      objectFormat,
      repositoryRelativePath: relativePath,
      headCommitId: initialHead,
      currentSourceDigest: initialTarget.capture.digest,
      provenance: initialProvenance,
    });
  }
  const revisionText = stdoutText(revisionCommand, "resolve_revision");
  if (typeof revisionText !== "string") return revisionText;
  if (!commitId(revisionText, objectFormat)) {
    return malformed("resolve_revision");
  }
  const resolvedRevision = revisionText;
  const repositorySnapshotId =
    `git:${objectFormat}:${resolvedRevision}`;

  if (
    request.expectedSourceDigest !== undefined &&
    request.expectedSourceDigest !== initialTarget.capture.digest
  ) {
    return unavailable(requestedRevision, "target_changed", {
      objectFormat,
      repositorySnapshotId,
      repositoryRelativePath: relativePath,
      resolvedRevision,
      headCommitId: initialHead,
      currentSourceDigest: initialTarget.capture.digest,
      provenance: initialProvenance,
    });
  }

  const trackedCommand = runGit(
    executable,
    repositoryRoot,
    "selected_target",
    [
      "ls-tree",
      "-z",
      "--name-only",
      resolvedRevision,
      "--",
      relativePath,
    ],
  );
  if (!trackedCommand.ok) {
    if (trackedCommand.kind === "failure") return trackedCommand.failure;
    return commandFailure("selected_target");
  }
  if (trackedCommand.stdout.length === 0) {
    return unavailable(requestedRevision, "untracked_target", {
      objectFormat,
      repositorySnapshotId,
      repositoryRelativePath: relativePath,
      resolvedRevision,
      headCommitId: initialHead,
      currentSourceDigest: initialTarget.capture.digest,
      provenance: initialProvenance,
    });
  }
  if (
    !trackedCommand.stdout.equals(
      Buffer.from(`${relativePath}\0`, "utf8"),
    )
  ) {
    return unavailable(requestedRevision, "ambiguous_path", {
      objectFormat,
      repositorySnapshotId,
      repositoryRelativePath: relativePath,
      resolvedRevision,
      headCommitId: initialHead,
      currentSourceDigest: initialTarget.capture.digest,
      provenance: initialProvenance,
    });
  }

  const commitsCommand = runGit(
    executable,
    repositoryRoot,
    "first_parent_commits",
    [
      "rev-list",
      "--first-parent",
      "--reverse",
      resolvedRevision,
      "--",
      relativePath,
    ],
  );
  if (!commitsCommand.ok) {
    return commitsCommand.kind === "failure"
      ? commitsCommand.failure
      : commandFailure("first_parent_commits");
  }
  const commitsText = stdoutText(commitsCommand, "first_parent_commits");
  if (typeof commitsText !== "string") return commitsText;
  const inspectedCommitIds = commitsText === ""
    ? []
    : commitsText.split("\n");
  if (
    inspectedCommitIds.length === 0 ||
    inspectedCommitIds.some((id) => !commitId(id, objectFormat)) ||
    new Set(inspectedCommitIds).size !== inspectedCommitIds.length
  ) {
    return malformed("first_parent_commits");
  }

  const snapshotCollection = collectHistorySnapshots({
    executable,
    repositoryRoot,
    repositorySnapshotId,
    relativePath,
    objectFormat,
    inspectedCommitIds,
  });
  if (!snapshotCollection.ok) return snapshotCollection;
  const snapshots = snapshotCollection.snapshots;

  const provenance = requestedProvenanceMode === "new_root"
    ? probeNewRootProvenance(
        executable, repositoryRoot, relativePath, objectFormat, snapshots,
      )
    : initialProvenance;
  if (provenance === null) {
    return unavailable(requestedRevision, "provenance_unavailable", {
      objectFormat,
      repositorySnapshotId,
      repositoryRelativePath: relativePath,
      resolvedRevision,
      headCommitId: initialHead,
      currentSourceDigest: initialTarget.capture.digest,
      selectedSourceDigest: snapshots.at(-1)?.sourceDigest ?? null,
      inspectedCommitIds,
      snapshots,
      provenance: initialProvenance,
    });
  }

  const renameCommand = runGit(
    executable,
    repositoryRoot,
    "rename_detection",
    [
      "log",
      "--first-parent",
      "--follow",
      "--format=",
      "--name-status",
      "-M",
      resolvedRevision,
      "--",
      relativePath,
    ],
  );
  if (!renameCommand.ok) {
    return renameCommand.kind === "failure"
      ? renameCommand.failure
      : commandFailure("rename_detection");
  }
  const renameText = renameCommand.stdout.toString("latin1");

  const shallowCommand = runGit(
    executable,
    repositoryRoot,
    "shallow_detection",
    ["rev-parse", "--is-shallow-repository"],
  );
  if (!shallowCommand.ok) {
    return shallowCommand.kind === "failure"
      ? shallowCommand.failure
      : commandFailure("shallow_detection");
  }
  const shallowText = stdoutText(shallowCommand, "shallow_detection");
  if (typeof shallowText !== "string") return shallowText;
  if (shallowText !== "true" && shallowText !== "false") {
    return malformed("shallow_detection");
  }

  if (dependencies.afterSnapshots !== undefined) {
    await dependencies.afterSnapshots();
  }

  const finalHeadCommand = runGit(
    executable,
    repositoryRoot,
    "recheck_head",
    ["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"],
  );
  if (!finalHeadCommand.ok) {
    if (finalHeadCommand.kind === "failure") return finalHeadCommand.failure;
    return unavailable(requestedRevision, "head_changed", {
      objectFormat,
      repositorySnapshotId,
      repositoryRelativePath: relativePath,
      resolvedRevision,
      headCommitId: initialHead,
      currentSourceDigest: initialTarget.capture.digest,
      selectedSourceDigest: snapshots.at(-1)?.sourceDigest ?? null,
      inspectedCommitIds,
      snapshots,
      provenance,
    });
  }
  const finalHeadText = stdoutText(finalHeadCommand, "recheck_head");
  if (typeof finalHeadText !== "string") return finalHeadText;
  if (!commitId(finalHeadText, objectFormat)) {
    return malformed("recheck_head");
  }

  const finalTarget = await captureTarget(targetPath);
  const raceCauses: GitHistoryAvailability[] = [];
  if (
    finalHeadText !== initialHead
  ) {
    raceCauses.push({ cause: "head_changed", commitId: finalHeadText });
  }
  if (
    !finalTarget.ok ||
    !sameTarget(initialTarget.capture, finalTarget.capture)
  ) {
    raceCauses.push({ cause: "target_changed", commitId: null });
  }

  const incompleteCauses: GitHistoryAvailability[] = [];
  if (shallowText === "true") {
    incompleteCauses.push({
      cause: "shallow_boundary",
      commitId: inspectedCommitIds[0] ?? null,
    });
  }
  if (
    requestedProvenanceMode === "automatic" &&
    /(?:^|\n)R\d+\t/.test(renameText)
  ) {
    incompleteCauses.push({
      cause: "unsupported_rename",
      commitId: null,
    });
  }
  const allCauses = availability([
    ...incompleteCauses,
    ...raceCauses,
  ]);
  const status: GitHistoryStatus =
    raceCauses.length > 0
      ? "unavailable"
      : incompleteCauses.length > 0
        ? "incomplete"
        : "complete";

  return {
    ok: true,
    modelVersion: GIT_HISTORY_PROBE_MODEL_VERSION,
    status,
    traversal: "first_parent",
    objectFormat,
    repositorySnapshotId,
    repositoryRelativePath: relativePath,
    requestedRevision,
    resolvedRevision,
    headCommitId: initialHead,
    currentSourceDigest: initialTarget.capture.digest,
    selectedSourceDigest: snapshots.at(-1)?.sourceDigest ?? null,
    inspectedCommitIds: Object.freeze(inspectedCommitIds),
    snapshots: Object.freeze(snapshots),
    availability: allCauses,
    provenance,
  };
}

type HistoricalResolvedRevision =
  | { readonly ok: true; readonly commitId: string }
  | {
      readonly ok: false;
      readonly cause:
        | "unknown_revision"
        | "ambiguous_revision"
        | "non_commit_revision";
    }
  | { readonly ok: false; readonly failure: GitHistoryProbeFailure };

type HistoricalTreeEntry =
  | { readonly kind: "missing" }
  | {
      readonly kind: "object";
      readonly mode: string;
      readonly objectType: string;
      readonly objectId: string;
    };

interface PendingHistoricalSnapshot {
  readonly commitId: string;
  readonly parentCommitIds: readonly string[];
  readonly blobId: string | null;
  readonly sourceDigest: string | null;
  readonly source: Uint8Array | null;
  readonly recordedAt: string | null;
  readonly isEndpoint: boolean;
  readonly isLowerBoundary: boolean;
}

function historicalLimits(
  overrides: Partial<HistoricalGitEvidenceLimits> | undefined,
): HistoricalGitEvidenceLimits {
  function select(
    name: keyof HistoricalGitEvidenceLimits,
  ): number {
    const value = overrides?.[name] ?? HISTORICAL_GIT_EVIDENCE_LIMITS[name];
    return Number.isSafeInteger(value) && value > 0
      ? value
      : HISTORICAL_GIT_EVIDENCE_LIMITS[name];
  }
  return Object.freeze({
    inspectedCommits: select("inspectedCommits"),
    rawBytesPerSnapshot: select("rawBytesPerSnapshot"),
    aggregateRawSnapshotBytes: select("aggregateRawSnapshotBytes"),
  });
}

function historicalCause(
  cause: HistoricalGitEvidenceCause,
  subject: HistoricalGitEvidenceSubject,
  options: {
    readonly commitId?: string | null;
    readonly limit?: keyof HistoricalGitEvidenceLimits | null;
    readonly actual?: number | null;
  } = {},
): HistoricalGitEvidenceCauseRecord {
  return Object.freeze({
    cause,
    subject,
    commitId: options.commitId ?? null,
    limit: options.limit ?? null,
    actual: options.actual ?? null,
  });
}

interface HistoricalResultFields {
  readonly objectFormat?: "sha1" | "sha256" | null;
  readonly repositoryId?: string | null;
  readonly repositoryReadSnapshotId?: string | null;
  readonly repositoryRelativePath?: string | null;
  readonly resolvedEndpoint?: string | null;
  readonly resolvedLowerBoundary?: string | null;
  readonly oldestInspectedCommitId?: string | null;
  readonly currentSourceDigest?: string | null;
  readonly aggregateRawSnapshotBytes?: number;
  readonly inspectedCommitIds?: readonly string[];
  readonly snapshots?: readonly HistoricalGitInspectionSnapshot[];
}

function historicalEvidenceResult(
  request: HistoricalGitEvidenceRequest,
  limits: HistoricalGitEvidenceLimits,
  status: HistoricalGitEvidenceStatus,
  causes: readonly HistoricalGitEvidenceCauseRecord[],
  fields: HistoricalResultFields = {},
): HistoricalGitEvidenceResult {
  return Object.freeze({
    ok: true,
    modelVersion: HISTORICAL_GIT_EVIDENCE_MODEL_VERSION,
    status,
    ancestryProfile: "first_parent",
    objectFormat: fields.objectFormat ?? null,
    repositoryId: fields.repositoryId ?? null,
    repositoryReadSnapshotId: fields.repositoryReadSnapshotId ?? null,
    repositoryRelativePath: fields.repositoryRelativePath ?? null,
    requestedEndpoint: request.requestedEndpoint ?? "HEAD",
    resolvedEndpoint: fields.resolvedEndpoint ?? null,
    requestedLowerBoundary: request.lowerBoundary ?? null,
    resolvedLowerBoundary: fields.resolvedLowerBoundary ?? null,
    oldestInspectedCommitId: fields.oldestInspectedCommitId ?? null,
    currentSourceDigest: fields.currentSourceDigest ?? null,
    aggregateRawSnapshotBytes: fields.aggregateRawSnapshotBytes ?? 0,
    limits,
    inspectedCommitIds: Object.freeze([
      ...(fields.inspectedCommitIds ?? []),
    ]),
    snapshots: Object.freeze([...(fields.snapshots ?? [])]),
    causes: Object.freeze([...causes]),
  });
}

function parseHistoricalCommitList(
  result: GitCommandSuccess,
  operation: string,
  objectFormat: "sha1" | "sha256",
): string[] | GitHistoryProbeFailure {
  const text = stdoutText(result, operation);
  if (typeof text !== "string") return text;
  const values = text === "" ? [] : text.split("\n");
  if (
    values.some((value) => !commitId(value, objectFormat)) ||
    new Set(values).size !== values.length
  ) {
    return malformed(operation);
  }
  return values;
}

function resolveHistoricalRevision(
  executable: string,
  repositoryRoot: string,
  spelling: string,
  objectFormat: "sha1" | "sha256",
  operation: string,
): HistoricalResolvedRevision {
  const commitCommand = runGit(
    executable,
    repositoryRoot,
    operation,
    [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${spelling}^{commit}`,
    ],
  );
  if (commitCommand.ok) {
    const text = stdoutText(commitCommand, operation);
    if (typeof text !== "string") return { ok: false, failure: text };
    if (!commitId(text, objectFormat)) {
      return { ok: false, failure: malformed(operation) };
    }
    return { ok: true, commitId: text };
  }
  if (commitCommand.kind === "failure") {
    return { ok: false, failure: commitCommand.failure };
  }

  if (/^[0-9a-fA-F]{4,64}$/.test(spelling)) {
    const disambiguate = runGit(
      executable,
      repositoryRoot,
      `${operation}_disambiguate`,
      ["rev-parse", `--disambiguate=${spelling.toLowerCase()}`],
    );
    if (!disambiguate.ok) {
      if (disambiguate.kind === "failure") {
        return { ok: false, failure: disambiguate.failure };
      }
    } else {
      const candidates = parseHistoricalCommitList(
        disambiguate,
        `${operation}_disambiguate`,
        objectFormat,
      );
      if (!Array.isArray(candidates)) {
        return { ok: false, failure: candidates };
      }
      if (candidates.length > 1) {
        return { ok: false, cause: "ambiguous_revision" };
      }
    }
  }

  const objectCommand = runGit(
    executable,
    repositoryRoot,
    `${operation}_object`,
    [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${spelling}^{object}`,
    ],
  );
  if (!objectCommand.ok) {
    return objectCommand.kind === "failure"
      ? { ok: false, failure: objectCommand.failure }
      : { ok: false, cause: "unknown_revision" };
  }
  const objectText = stdoutText(objectCommand, `${operation}_object`);
  if (typeof objectText !== "string") {
    return { ok: false, failure: objectText };
  }
  if (!commitId(objectText, objectFormat)) {
    return { ok: false, failure: malformed(`${operation}_object`) };
  }
  return { ok: false, cause: "non_commit_revision" };
}

function readHistoricalTreeEntry(
  executable: string,
  repositoryRoot: string,
  commit: string,
  relativePath: string,
  objectFormat: "sha1" | "sha256",
  operation: string,
): HistoricalTreeEntry | GitHistoryProbeFailure {
  const command = runGit(
    executable,
    repositoryRoot,
    operation,
    ["ls-tree", "-z", commit, "--", relativePath],
  );
  if (!command.ok) {
    return command.kind === "failure"
      ? command.failure
      : commandFailure(operation);
  }
  if (command.stdout.length === 0) return { kind: "missing" };
  const text = stdoutText(command, operation);
  if (typeof text !== "string") return text;
  const match = /^([0-7]{6}) ([a-z]+) ([0-9a-f]+)\t([^\u0000]+)\u0000?$/.exec(
    text,
  );
  if (
    match === null ||
    match[4] !== relativePath ||
    !commitId(match[3]!, objectFormat)
  ) {
    return malformed(operation);
  }
  return Object.freeze({
    kind: "object",
    mode: match[1]!,
    objectType: match[2]!,
    objectId: match[3]!,
  });
}

function regularHistoricalBlob(entry: HistoricalTreeEntry): boolean {
  return entry.kind === "object" &&
    entry.objectType === "blob" &&
    (entry.mode === "100644" || entry.mode === "100755");
}

function repositoryIdentity(commonDirectory: string): string {
  const digest = digestDocumentBytes(Buffer.from(commonDirectory, "utf8"));
  return `git-repository:${digest}`;
}

export async function probeHistoricalGitEvidence(
  request: HistoricalGitEvidenceRequest,
  dependencies: HistoricalGitEvidenceDependencies = {},
): Promise<HistoricalGitEvidenceOutcome> {
  const limits = historicalLimits(dependencies.limits);
  const requestedEndpoint = request.requestedEndpoint ?? "HEAD";
  const executable = dependencies.gitExecutable ?? "git";
  const targetPath = resolve(request.targetPath);
  const initialTarget = await captureTarget(targetPath);
  if (!initialTarget.ok) {
    if ("ambiguous" in initialTarget) {
      return historicalEvidenceResult(
        request,
        limits,
        "unavailable",
        [historicalCause("ambiguous_path", "target_path")],
      );
    }
    return initialTarget.failure;
  }

  const repositoryCommand = runGit(
    executable,
    dirname(initialTarget.capture.realPath),
    "historical_repository_root",
    ["rev-parse", "--path-format=absolute", "--show-toplevel"],
  );
  if (!repositoryCommand.ok) {
    if (repositoryCommand.kind === "failure") {
      return repositoryCommand.failure;
    }
    return historicalEvidenceResult(
      request,
      limits,
      "unavailable",
      [historicalCause("no_repository", "repository")],
      { currentSourceDigest: initialTarget.capture.digest },
    );
  }
  const repositoryText = stdoutText(
    repositoryCommand,
    "historical_repository_root",
  );
  if (typeof repositoryText !== "string") return repositoryText;

  let repositoryRoot: string;
  try {
    repositoryRoot = await realpath(repositoryText);
  } catch {
    return commandFailure("historical_repository_root");
  }
  const relativePath = normalizeRepositoryPath(
    repositoryRoot,
    initialTarget.capture.realPath,
  );
  if (relativePath === null) {
    return historicalEvidenceResult(
      request,
      limits,
      "unavailable",
      [historicalCause("ambiguous_path", "target_path")],
      { currentSourceDigest: initialTarget.capture.digest },
    );
  }

  const headCommand = runGit(
    executable,
    repositoryRoot,
    "historical_resolve_head",
    ["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"],
  );
  if (!headCommand.ok) {
    if (headCommand.kind === "failure") return headCommand.failure;
    return historicalEvidenceResult(
      request,
      limits,
      "unavailable",
      [historicalCause("no_head", "repository")],
      {
        repositoryRelativePath: relativePath,
        currentSourceDigest: initialTarget.capture.digest,
      },
    );
  }

  const formatCommand = runGit(
    executable,
    repositoryRoot,
    "historical_object_format",
    ["rev-parse", "--show-object-format=storage"],
  );
  if (!formatCommand.ok) {
    return formatCommand.kind === "failure"
      ? formatCommand.failure
      : commandFailure("historical_object_format");
  }
  const formatText = stdoutText(
    formatCommand,
    "historical_object_format",
  );
  if (typeof formatText !== "string") return formatText;
  if (formatText !== "sha1" && formatText !== "sha256") {
    return historicalEvidenceResult(
      request,
      limits,
      "unavailable",
      [historicalCause("unsupported_object_format", "repository")],
      {
        repositoryRelativePath: relativePath,
        currentSourceDigest: initialTarget.capture.digest,
      },
    );
  }
  const objectFormat = formatText;

  const commonCommand = runGit(
    executable,
    repositoryRoot,
    "historical_common_directory",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  );
  if (!commonCommand.ok) {
    return commonCommand.kind === "failure"
      ? commonCommand.failure
      : commandFailure("historical_common_directory");
  }
  const commonText = stdoutText(
    commonCommand,
    "historical_common_directory",
  );
  if (typeof commonText !== "string") return commonText;
  let commonDirectory: string;
  try {
    commonDirectory = await realpath(commonText);
  } catch {
    return commandFailure("historical_common_directory");
  }
  const repositoryId = repositoryIdentity(commonDirectory);
  const baseFields: HistoricalResultFields = {
    objectFormat,
    repositoryId,
    repositoryRelativePath: relativePath,
    currentSourceDigest: initialTarget.capture.digest,
  };

  if (
    request.expectedSourceDigest !== undefined &&
    request.expectedSourceDigest !== initialTarget.capture.digest
  ) {
    return historicalEvidenceResult(
      request,
      limits,
      "unavailable",
      [historicalCause("target_changed", "target_path")],
      baseFields,
    );
  }

  const endpoint = resolveHistoricalRevision(
    executable,
    repositoryRoot,
    requestedEndpoint,
    objectFormat,
    "historical_resolve_endpoint",
  );
  if (!endpoint.ok) {
    if ("failure" in endpoint) return endpoint.failure;
    return historicalEvidenceResult(
      request,
      limits,
      "unavailable",
      [historicalCause(endpoint.cause, "endpoint")],
      baseFields,
    );
  }
  const resolvedEndpoint = endpoint.commitId;
  const endpointFields: HistoricalResultFields = {
    ...baseFields,
    resolvedEndpoint,
  };

  const entryCache = new Map<string, HistoricalTreeEntry>();
  const endpointEntry = readHistoricalTreeEntry(
    executable,
    repositoryRoot,
    resolvedEndpoint,
    relativePath,
    objectFormat,
    "historical_endpoint_tree",
  );
  if ("ok" in endpointEntry) return endpointEntry;
  entryCache.set(resolvedEndpoint, endpointEntry);
  if (!regularHistoricalBlob(endpointEntry)) {
    return historicalEvidenceResult(
      request,
      limits,
      "unavailable",
      [
        historicalCause("endpoint_path_missing", "endpoint", {
          commitId: resolvedEndpoint,
        }),
      ],
      endpointFields,
    );
  }

  const shallowCommand = runGit(
    executable,
    repositoryRoot,
    "historical_shallow_state",
    ["rev-parse", "--is-shallow-repository"],
  );
  if (!shallowCommand.ok) {
    return shallowCommand.kind === "failure"
      ? shallowCommand.failure
      : commandFailure("historical_shallow_state");
  }
  const shallowText = stdoutText(
    shallowCommand,
    "historical_shallow_state",
  );
  if (typeof shallowText !== "string") return shallowText;
  if (shallowText !== "true" && shallowText !== "false") {
    return malformed("historical_shallow_state");
  }
  const shallow = shallowText === "true";

  const laneCommand = runGit(
    executable,
    repositoryRoot,
    "historical_first_parent_lane",
    ["rev-list", "--first-parent", "--reverse", resolvedEndpoint],
  );
  if (!laneCommand.ok) {
    return laneCommand.kind === "failure"
      ? laneCommand.failure
      : commandFailure("historical_first_parent_lane");
  }
  const lane = parseHistoricalCommitList(
    laneCommand,
    "historical_first_parent_lane",
    objectFormat,
  );
  if (!Array.isArray(lane)) return lane;
  if (lane.length === 0 || lane.at(-1) !== resolvedEndpoint) {
    return malformed("historical_first_parent_lane");
  }
  const laneOrder = new Map(lane.map((id, index) => [id, index]));

  let resolvedLowerBoundary: string | null = null;
  let lowerIndex = 0;
  if (request.lowerBoundary !== undefined) {
    const lower = resolveHistoricalRevision(
      executable,
      repositoryRoot,
      request.lowerBoundary,
      objectFormat,
      "historical_resolve_lower",
    );
    if (!lower.ok) {
      if ("failure" in lower) return lower.failure;
      return historicalEvidenceResult(
        request,
        limits,
        "unavailable",
        [historicalCause(lower.cause, "lower_boundary")],
        endpointFields,
      );
    }
    resolvedLowerBoundary = lower.commitId;
    const index = laneOrder.get(resolvedLowerBoundary);
    if (index === undefined) {
      return historicalEvidenceResult(
        request,
        limits,
        "unavailable",
        [
          historicalCause(
            shallow
              ? "shallow_origin"
              : "lower_not_first_parent_ancestor",
            "lower_boundary",
            { commitId: resolvedLowerBoundary },
          ),
        ],
        { ...endpointFields, resolvedLowerBoundary },
      );
    }
    lowerIndex = index;
    const lowerEntry = resolvedLowerBoundary === resolvedEndpoint
      ? endpointEntry
      : readHistoricalTreeEntry(
          executable,
          repositoryRoot,
          resolvedLowerBoundary,
          relativePath,
          objectFormat,
          "historical_lower_tree",
        );
    if ("ok" in lowerEntry) return lowerEntry;
    entryCache.set(resolvedLowerBoundary, lowerEntry);
    if (!regularHistoricalBlob(lowerEntry)) {
      return historicalEvidenceResult(
        request,
        limits,
        "unavailable",
        [
          historicalCause("lower_path_missing", "lower_boundary", {
            commitId: resolvedLowerBoundary,
          }),
        ],
        { ...endpointFields, resolvedLowerBoundary },
      );
    }
  }

  const changesCommand = runGit(
    executable,
    repositoryRoot,
    "historical_path_changes",
    [
      "rev-list",
      "--first-parent",
      "--full-history",
      "--reverse",
      resolvedEndpoint,
      "--",
      relativePath,
    ],
  );
  if (!changesCommand.ok) {
    return changesCommand.kind === "failure"
      ? changesCommand.failure
      : commandFailure("historical_path_changes");
  }
  const pathChanges = parseHistoricalCommitList(
    changesCommand,
    "historical_path_changes",
    objectFormat,
  );
  if (!Array.isArray(pathChanges)) return pathChanges;
  if (pathChanges.some((id) => !laneOrder.has(id))) {
    return malformed("historical_path_changes");
  }

  const selected = new Set<string>();
  if (resolvedLowerBoundary !== null) selected.add(resolvedLowerBoundary);
  for (const id of pathChanges) {
    const index = laneOrder.get(id)!;
    if (index >= lowerIndex) selected.add(id);
  }
  selected.add(resolvedEndpoint);
  const inspectedCommitIds = [...selected].sort(
    (left, right) => laneOrder.get(left)! - laneOrder.get(right)!,
  );
  if (inspectedCommitIds.length > limits.inspectedCommits) {
    return historicalEvidenceResult(
      request,
      limits,
      "unavailable",
      [
        historicalCause("hard_limit", "inspection", {
          limit: "inspectedCommits",
          actual: inspectedCommitIds.length,
        }),
      ],
      { ...endpointFields, resolvedLowerBoundary },
    );
  }

  const pending: PendingHistoricalSnapshot[] = [];
  let aggregateRawSnapshotBytes = 0;
  for (const inspectedCommitId of inspectedCommitIds) {
    const metadataCommand = runGit(
      executable,
      repositoryRoot,
      "historical_commit_metadata",
      ["show", "-s", "--format=%P%x00%cI", inspectedCommitId],
    );
    if (!metadataCommand.ok) {
      return metadataCommand.kind === "failure"
        ? metadataCommand.failure
        : historicalEvidenceResult(
            request,
            limits,
            "unavailable",
            [
              historicalCause("object_read_failed", "inspection", {
                commitId: inspectedCommitId,
              }),
            ],
            { ...endpointFields, resolvedLowerBoundary },
          );
    }
    const metadataText = stdoutText(
      metadataCommand,
      "historical_commit_metadata",
    );
    if (typeof metadataText !== "string") return metadataText;
    const metadata = parseGitCommitMetadata(metadataText, objectFormat);
    if (metadata === null) return malformed("historical_commit_metadata");

    let entry = entryCache.get(inspectedCommitId);
    if (entry === undefined) {
      const read = readHistoricalTreeEntry(
        executable,
        repositoryRoot,
        inspectedCommitId,
        relativePath,
        objectFormat,
        "historical_snapshot_tree",
      );
      if ("ok" in read) return read;
      entry = read;
      entryCache.set(inspectedCommitId, entry);
    }

    let blobId: string | null = null;
    let source: Uint8Array | null = null;
    let sourceDigest: string | null = null;
    if (entry.kind === "object" && entry.objectType === "blob") {
      blobId = entry.objectId;
      const sourceCommand = runGit(
        executable,
        repositoryRoot,
        "historical_snapshot_blob",
        ["cat-file", "blob", blobId],
      );
      if (!sourceCommand.ok) {
        return sourceCommand.kind === "failure"
          ? sourceCommand.failure
          : historicalEvidenceResult(
              request,
              limits,
              "unavailable",
              [
                historicalCause("object_read_failed", "inspection", {
                  commitId: inspectedCommitId,
                }),
              ],
              { ...endpointFields, resolvedLowerBoundary },
            );
      }
      if (sourceCommand.stdout.length > limits.rawBytesPerSnapshot) {
        return historicalEvidenceResult(
          request,
          limits,
          "unavailable",
          [
            historicalCause("hard_limit", "inspection", {
              commitId: inspectedCommitId,
              limit: "rawBytesPerSnapshot",
              actual: sourceCommand.stdout.length,
            }),
          ],
          { ...endpointFields, resolvedLowerBoundary },
        );
      }
      const nextAggregate =
        aggregateRawSnapshotBytes + sourceCommand.stdout.length;
      if (nextAggregate > limits.aggregateRawSnapshotBytes) {
        return historicalEvidenceResult(
          request,
          limits,
          "unavailable",
          [
            historicalCause("hard_limit", "inspection", {
              commitId: inspectedCommitId,
              limit: "aggregateRawSnapshotBytes",
              actual: nextAggregate,
            }),
          ],
          { ...endpointFields, resolvedLowerBoundary },
        );
      }
      aggregateRawSnapshotBytes = nextAggregate;
      source = new Uint8Array(sourceCommand.stdout);
      sourceDigest = digestDocumentBytes(source);
    }

    pending.push(Object.freeze({
      commitId: inspectedCommitId,
      parentCommitIds: Object.freeze([...metadata.parentCommitIds]),
      blobId,
      sourceDigest,
      source,
      recordedAt: metadata.recordedAt,
      isEndpoint: inspectedCommitId === resolvedEndpoint,
      isLowerBoundary: inspectedCommitId === resolvedLowerBoundary,
    }));
  }

  const readSnapshotDigest = digestDocumentBytes(Buffer.from(JSON.stringify({
    model: "Perttool.HistoricalGitEvidence.v1",
    objectFormat,
    repositoryId,
    repositoryRelativePath: relativePath,
    resolvedEndpoint,
    resolvedLowerBoundary,
    snapshots: pending.map((snapshot) => ({
      commitId: snapshot.commitId,
      parentCommitIds: snapshot.parentCommitIds,
      blobId: snapshot.blobId,
      sourceDigest: snapshot.sourceDigest,
    })),
  }), "utf8"));
  const repositoryReadSnapshotId = `git-read:${readSnapshotDigest}`;

  if (dependencies.afterEvidence !== undefined) {
    await dependencies.afterEvidence();
  }

  const finalEndpoint = resolveHistoricalRevision(
    executable,
    repositoryRoot,
    requestedEndpoint,
    objectFormat,
    "historical_recheck_endpoint",
  );
  if (!finalEndpoint.ok) {
    if ("failure" in finalEndpoint) return finalEndpoint.failure;
    return historicalEvidenceResult(
      request,
      limits,
      "unavailable",
      [historicalCause("repository_race", "endpoint")],
      { ...endpointFields, resolvedLowerBoundary },
    );
  }
  let finalLowerCommit: string | null = null;
  if (request.lowerBoundary !== undefined) {
    const finalLower = resolveHistoricalRevision(
      executable,
      repositoryRoot,
      request.lowerBoundary,
      objectFormat,
      "historical_recheck_lower",
    );
    if (!finalLower.ok) {
      if ("failure" in finalLower) return finalLower.failure;
      return historicalEvidenceResult(
        request,
        limits,
        "unavailable",
        [historicalCause("repository_race", "lower_boundary")],
        { ...endpointFields, resolvedLowerBoundary },
      );
    }
    finalLowerCommit = finalLower.commitId;
  }
  const finalTarget = await captureTarget(targetPath);
  let finalCommonDirectory: string | null = null;
  try {
    finalCommonDirectory = await realpath(commonText);
  } catch {
    finalCommonDirectory = null;
  }
  if (
    finalEndpoint.commitId !== resolvedEndpoint ||
    finalLowerCommit !== resolvedLowerBoundary ||
    finalCommonDirectory !== commonDirectory ||
    !finalTarget.ok ||
    !sameTarget(initialTarget.capture, finalTarget.capture)
  ) {
    return historicalEvidenceResult(
      request,
      limits,
      "unavailable",
      [historicalCause("repository_race", "repository")],
      { ...endpointFields, resolvedLowerBoundary },
    );
  }

  const snapshots = pending.map((snapshot) => Object.freeze({
    modelVersion: HISTORICAL_GIT_EVIDENCE_MODEL_VERSION,
    objectFormat,
    repositoryId,
    repositoryReadSnapshotId,
    repositoryRelativePath: relativePath,
    commitId: snapshot.commitId,
    parentCommitIds: snapshot.parentCommitIds,
    blobId: snapshot.blobId,
    sourceDigest: snapshot.sourceDigest,
    source: snapshot.source,
    recordedAt: snapshot.recordedAt,
    isMergeCommit: snapshot.parentCommitIds.length > 1,
    isEndpoint: snapshot.isEndpoint,
    isLowerBoundary: snapshot.isLowerBoundary,
  } satisfies HistoricalGitInspectionSnapshot));
  const causes = shallow && resolvedLowerBoundary === null
    ? [
        historicalCause("shallow_origin", "repository", {
          commitId: inspectedCommitIds[0] ?? null,
        }),
      ]
    : [];

  return historicalEvidenceResult(
    request,
    limits,
    causes.length === 0 ? "complete" : "incomplete",
    causes,
    {
      ...endpointFields,
      repositoryReadSnapshotId,
      resolvedLowerBoundary,
      oldestInspectedCommitId: inspectedCommitIds[0] ?? null,
      aggregateRawSnapshotBytes,
      inspectedCommitIds,
      snapshots,
    },
  );
}

type BaselineFields = Partial<
  Omit<
    AdvanceHistoryBaselineCapture,
    "ok" | "modelVersion" | "status" | "cause" | "operation"
  >
>;

function unavailableAdvanceBaseline(
  cause: AdvanceHistoryBaselineCause,
  operation: string | null,
  fields: BaselineFields = {},
): AdvanceHistoryBaselineCapture {
  return {
    ok: true,
    modelVersion: ADVANCE_HISTORY_BASELINE_MODEL_VERSION,
    status: "unavailable",
    cause,
    operation,
    objectFormat: fields.objectFormat ?? null,
    repositorySnapshotId: fields.repositorySnapshotId ?? null,
    repositoryRelativePath: fields.repositoryRelativePath ?? null,
    headCommitId: fields.headCommitId ?? null,
    headBlobId: fields.headBlobId ?? null,
    indexBlobId: fields.indexBlobId ?? null,
    currentSourceDigest: fields.currentSourceDigest ?? null,
    headSourceDigest: fields.headSourceDigest ?? null,
    indexSourceDigest: fields.indexSourceDigest ?? null,
    sourceModifiedAt: fields.sourceModifiedAt ?? null,
    targetDevice: fields.targetDevice ?? null,
    targetInode: fields.targetInode ?? null,
    currentSource: fields.currentSource ?? null,
    headSource: fields.headSource ?? null,
    indexSource: fields.indexSource ?? null,
  };
}

function baselineCommandCause(
  result: GitCommandResult,
  operation: string,
  fields: BaselineFields,
): AdvanceHistoryBaselineCapture {
  return unavailableAdvanceBaseline(
    "git_unavailable",
    !result.ok && result.kind === "failure"
      ? result.failure.operation
      : operation,
    fields,
  );
}

type TreeBlobParse =
  | { readonly kind: "ok"; readonly blobId: string }
  | { readonly kind: "missing" }
  | { readonly kind: "ambiguous" };

function parseTreeBlob(
  bytes: Buffer,
  relativePath: string,
  objectFormat: "sha1" | "sha256",
): TreeBlobParse {
  if (bytes.length === 0) return { kind: "missing" };
  const tab = bytes.indexOf(0x09);
  if (
    tab === -1 ||
    !bytes.subarray(tab + 1).equals(Buffer.from(`${relativePath}\0`, "utf8"))
  ) {
    return { kind: "ambiguous" };
  }
  const header = bytes.subarray(0, tab).toString("ascii").split(" ");
  if (
    header.length !== 3 ||
    (header[0] !== "100644" && header[0] !== "100755") ||
    header[1] !== "blob" ||
    !commitId(header[2]!, objectFormat)
  ) {
    return { kind: "ambiguous" };
  }
  return { kind: "ok", blobId: header[2]! };
}

type IndexBlobParse =
  | { readonly kind: "ok"; readonly blobId: string }
  | { readonly kind: "missing" }
  | { readonly kind: "unmerged" }
  | { readonly kind: "ambiguous" };

function parseIndexBlob(
  bytes: Buffer,
  relativePath: string,
  objectFormat: "sha1" | "sha256",
): IndexBlobParse {
  if (bytes.length === 0) return { kind: "missing" };
  const records = bytes.toString("latin1").split("\0");
  if (records.at(-1) !== "") return { kind: "ambiguous" };
  records.pop();
  if (records.length !== 1) return { kind: "unmerged" };
  const record = Buffer.from(records[0]!, "latin1");
  const tab = record.indexOf(0x09);
  if (
    tab === -1 ||
    !record.subarray(tab + 1).equals(Buffer.from(relativePath, "utf8"))
  ) {
    return { kind: "ambiguous" };
  }
  const header = record.subarray(0, tab).toString("ascii").split(" ");
  if (header.length !== 3) return { kind: "ambiguous" };
  if (header[2] !== "0") return { kind: "unmerged" };
  if (
    (header[0] !== "100644" && header[0] !== "100755") ||
    !commitId(header[1]!, objectFormat)
  ) {
    return { kind: "ambiguous" };
  }
  return { kind: "ok", blobId: header[1]! };
}

export async function captureAdvanceHistoryBaseline(
  request: AdvanceHistoryBaselineRequest,
  dependencies: AdvanceHistoryBaselineDependencies = {},
): Promise<AdvanceHistoryBaselineCapture> {
  const executable = dependencies.gitExecutable ?? "git";
  const targetPath = resolve(request.targetPath);
  const initialTarget = await captureTarget(targetPath);
  if (!initialTarget.ok) {
    return unavailableAdvanceBaseline(
      "ambiguous" in initialTarget
        ? "ambiguous_path"
        : "baseline_read_failed",
      "ambiguous" in initialTarget
        ? "target_capture"
        : initialTarget.failure.operation,
    );
  }
  const targetFields: BaselineFields = {
    currentSourceDigest: initialTarget.capture.digest,
    sourceModifiedAt: initialTarget.capture.modifiedAt,
    targetDevice: initialTarget.capture.device,
    targetInode: initialTarget.capture.inode,
    currentSource: initialTarget.capture.source,
  };
  if (
    request.expectedSourceDigest !== undefined &&
    request.expectedSourceDigest !== initialTarget.capture.digest
  ) {
    return unavailableAdvanceBaseline(
      "target_changed",
      "expected_source",
      targetFields,
    );
  }

  const repositoryCommand = runGit(
    executable,
    dirname(initialTarget.capture.realPath),
    "advance_repository_root",
    ["rev-parse", "--path-format=absolute", "--show-toplevel"],
  );
  if (!repositoryCommand.ok) {
    if (repositoryCommand.kind === "exit") {
      return unavailableAdvanceBaseline(
        "no_repository",
        "advance_repository_root",
        targetFields,
      );
    }
    return baselineCommandCause(
      repositoryCommand,
      "advance_repository_root",
      targetFields,
    );
  }
  const repositoryText = stdoutText(
    repositoryCommand,
    "advance_repository_root",
  );
  if (typeof repositoryText !== "string") {
    return unavailableAdvanceBaseline(
      "git_unavailable",
      repositoryText.operation,
      targetFields,
    );
  }

  let repositoryRoot: string;
  try {
    repositoryRoot = await realpath(repositoryText);
  } catch {
    return unavailableAdvanceBaseline(
      "baseline_read_failed",
      "advance_repository_root",
      targetFields,
    );
  }
  const relativePath = normalizeRepositoryPath(
    repositoryRoot,
    initialTarget.capture.realPath,
  );
  if (relativePath === null) {
    return unavailableAdvanceBaseline(
      "ambiguous_path",
      "advance_repository_path",
      targetFields,
    );
  }
  const pathFields: BaselineFields = {
    ...targetFields,
    repositoryRelativePath: relativePath,
  };

  const headCommand = runGit(
    executable,
    repositoryRoot,
    "advance_resolve_head",
    ["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"],
  );
  if (!headCommand.ok) {
    if (headCommand.kind === "exit") {
      return unavailableAdvanceBaseline(
        "no_head",
        "advance_resolve_head",
        pathFields,
      );
    }
    return baselineCommandCause(
      headCommand,
      "advance_resolve_head",
      pathFields,
    );
  }

  const formatCommand = runGit(
    executable,
    repositoryRoot,
    "advance_object_format",
    ["rev-parse", "--show-object-format=storage"],
  );
  if (!formatCommand.ok) {
    return baselineCommandCause(
      formatCommand,
      "advance_object_format",
      pathFields,
    );
  }
  const formatText = stdoutText(formatCommand, "advance_object_format");
  if (
    typeof formatText !== "string" ||
    (formatText !== "sha1" && formatText !== "sha256")
  ) {
    return unavailableAdvanceBaseline(
      "git_unavailable",
      typeof formatText === "string"
        ? "advance_object_format"
        : formatText.operation,
      pathFields,
    );
  }
  const objectFormat = formatText;
  const headText = stdoutText(headCommand, "advance_resolve_head");
  if (
    typeof headText !== "string" ||
    !commitId(headText, objectFormat)
  ) {
    return unavailableAdvanceBaseline(
      "git_unavailable",
      typeof headText === "string"
        ? "advance_resolve_head"
        : headText.operation,
      { ...pathFields, objectFormat },
    );
  }
  const headCommitId = headText;
  const headFields: BaselineFields = {
    ...pathFields,
    objectFormat,
    headCommitId,
  };

  const treeCommand = runGit(
    executable,
    repositoryRoot,
    "advance_head_entry",
    ["ls-tree", "-z", headCommitId, "--", relativePath],
  );
  if (!treeCommand.ok) {
    return baselineCommandCause(
      treeCommand,
      "advance_head_entry",
      headFields,
    );
  }
  const treeBlob = parseTreeBlob(
    treeCommand.stdout,
    relativePath,
    objectFormat,
  );
  if (treeBlob.kind !== "ok") {
    return unavailableAdvanceBaseline(
      treeBlob.kind === "missing"
        ? "untracked_target"
        : "ambiguous_path",
      "advance_head_entry",
      headFields,
    );
  }
  const headBlobId = treeBlob.blobId;
  const headBlobFields: BaselineFields = {
    ...headFields,
    headBlobId,
  };

  const indexCommand = runGit(
    executable,
    repositoryRoot,
    "advance_index_entry",
    ["ls-files", "--stage", "-z", "--", relativePath],
  );
  if (!indexCommand.ok) {
    return baselineCommandCause(
      indexCommand,
      "advance_index_entry",
      headBlobFields,
    );
  }
  const indexBlob = parseIndexBlob(
    indexCommand.stdout,
    relativePath,
    objectFormat,
  );
  if (indexBlob.kind !== "ok") {
    return unavailableAdvanceBaseline(
      indexBlob.kind === "unmerged"
        ? "unmerged_index"
        : indexBlob.kind === "missing"
          ? "correspondence_missing"
          : "ambiguous_path",
      "advance_index_entry",
      headBlobFields,
    );
  }
  const indexBlobId = indexBlob.blobId;
  const blobFields: BaselineFields = {
    ...headBlobFields,
    indexBlobId,
  };

  const headSourceCommand = runGit(
    executable,
    repositoryRoot,
    "advance_head_source",
    ["cat-file", "blob", headBlobId],
  );
  if (!headSourceCommand.ok) {
    return baselineCommandCause(
      headSourceCommand,
      "advance_head_source",
      blobFields,
    );
  }
  const indexSourceCommand = runGit(
    executable,
    repositoryRoot,
    "advance_index_source",
    ["cat-file", "blob", indexBlobId],
  );
  if (!indexSourceCommand.ok) {
    return baselineCommandCause(
      indexSourceCommand,
      "advance_index_source",
      blobFields,
    );
  }
  const headSource = new Uint8Array(headSourceCommand.stdout);
  const indexSource = new Uint8Array(indexSourceCommand.stdout);
  const headSourceDigest = digestDocumentBytes(headSource);
  const indexSourceDigest = digestDocumentBytes(indexSource);
  const repositorySnapshotId =
    `git:${objectFormat}:${headCommitId}:index:${indexBlobId}`;
  const completeFields: BaselineFields = {
    ...blobFields,
    repositorySnapshotId,
    headSourceDigest,
    indexSourceDigest,
    headSource,
    indexSource,
  };

  if (dependencies.afterCapture !== undefined) {
    await dependencies.afterCapture();
  }

  const finalHeadCommand = runGit(
    executable,
    repositoryRoot,
    "advance_recheck_head",
    ["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"],
  );
  if (!finalHeadCommand.ok) {
    if (finalHeadCommand.kind === "failure") {
      return baselineCommandCause(
        finalHeadCommand,
        "advance_recheck_head",
        completeFields,
      );
    }
    return unavailableAdvanceBaseline(
      "head_changed",
      "advance_recheck_head",
      completeFields,
    );
  }
  const finalHeadText = stdoutText(
    finalHeadCommand,
    "advance_recheck_head",
  );
  if (
    typeof finalHeadText !== "string" ||
    finalHeadText !== headCommitId
  ) {
    return unavailableAdvanceBaseline(
      "head_changed",
      "advance_recheck_head",
      completeFields,
    );
  }

  const finalIndexCommand = runGit(
    executable,
    repositoryRoot,
    "advance_recheck_index",
    ["ls-files", "--stage", "-z", "--", relativePath],
  );
  if (!finalIndexCommand.ok) {
    if (finalIndexCommand.kind === "failure") {
      return baselineCommandCause(
        finalIndexCommand,
        "advance_recheck_index",
        completeFields,
      );
    }
    return unavailableAdvanceBaseline(
      "index_changed",
      "advance_recheck_index",
      completeFields,
    );
  }
  const finalIndex = parseIndexBlob(
    finalIndexCommand.stdout,
    relativePath,
    objectFormat,
  );
  if (
    finalIndex.kind !== "ok" ||
    finalIndex.blobId !== indexBlobId
  ) {
    return unavailableAdvanceBaseline(
      "index_changed",
      "advance_recheck_index",
      completeFields,
    );
  }

  const finalTarget = await captureTarget(targetPath);
  if (
    !finalTarget.ok ||
    !sameTarget(initialTarget.capture, finalTarget.capture)
  ) {
    return unavailableAdvanceBaseline(
      "target_changed",
      "advance_recheck_target",
      completeFields,
    );
  }

  return {
    ok: true,
    modelVersion: ADVANCE_HISTORY_BASELINE_MODEL_VERSION,
    status: "complete",
    cause: null,
    operation: null,
    objectFormat,
    repositorySnapshotId,
    repositoryRelativePath: relativePath,
    headCommitId,
    headBlobId,
    indexBlobId,
    currentSourceDigest: initialTarget.capture.digest,
    headSourceDigest,
    indexSourceDigest,
    sourceModifiedAt: initialTarget.capture.modifiedAt,
    targetDevice: initialTarget.capture.device,
    targetInode: initialTarget.capture.inode,
    currentSource: initialTarget.capture.source,
    headSource,
    indexSource,
  };
}

export async function recheckAdvanceHistoryBaseline(
  baseline: AdvanceHistoryBaselineCapture,
  targetPath: string,
  dependencies: AdvanceHistoryBaselineDependencies = {},
): Promise<AdvanceHistoryBaselineRecheck> {
  if (
    baseline.status !== "complete" ||
    baseline.currentSourceDigest === null ||
    baseline.objectFormat === null ||
    baseline.repositorySnapshotId === null ||
    baseline.repositoryRelativePath === null ||
    baseline.headCommitId === null ||
    baseline.headBlobId === null ||
    baseline.indexBlobId === null ||
    baseline.targetDevice === null ||
    baseline.targetInode === null
  ) {
    return Object.freeze({
      ok: false,
      cause: "baseline_read_failed",
      operation: "advance_recheck_baseline",
    });
  }
  const current = await captureAdvanceHistoryBaseline(
    {
      targetPath,
      expectedSourceDigest: baseline.currentSourceDigest,
    },
    dependencies,
  );
  if (current.status !== "complete") {
    const cause =
      current.cause === "target_changed"
        ? "target_changed"
        : current.cause === "head_changed"
          ? "head_changed"
          : current.cause === "index_changed"
            ? "index_changed"
            : "baseline_read_failed";
    return Object.freeze({
      ok: false,
      cause,
      operation: current.operation,
    });
  }
  if (
    current.targetDevice !== baseline.targetDevice ||
    current.targetInode !== baseline.targetInode
  ) {
    return Object.freeze({
      ok: false,
      cause: "target_changed",
      operation: "advance_recheck_target",
    });
  }
  if (
    current.objectFormat !== baseline.objectFormat ||
    current.repositoryRelativePath !== baseline.repositoryRelativePath ||
    current.headCommitId !== baseline.headCommitId ||
    current.headBlobId !== baseline.headBlobId
  ) {
    return Object.freeze({
      ok: false,
      cause: "head_changed",
      operation: "advance_recheck_head",
    });
  }
  if (
    current.repositorySnapshotId !== baseline.repositorySnapshotId ||
    current.indexBlobId !== baseline.indexBlobId
  ) {
    return Object.freeze({
      ok: false,
      cause: "index_changed",
      operation: "advance_recheck_index",
    });
  }
  return Object.freeze({
    ok: true,
    cause: null,
    operation: null,
  });
}
