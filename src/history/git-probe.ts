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

export type GitHistoryStatus = "complete" | "incomplete" | "unavailable";

export type GitHistoryCause =
  | "no_repository"
  | "no_head"
  | "unknown_revision"
  | "untracked_target"
  | "ambiguous_path"
  | "shallow_boundary"
  | "unsupported_rename"
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

interface TargetCapture {
  readonly realPath: string;
  readonly digest: string;
  readonly device: bigint;
  readonly inode: bigint;
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
  ["head_changed", 7],
  ["target_changed", 8],
]);

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
    >
  > = {},
): GitHistoryProbeResult {
  return {
    ok: true,
    modelVersion: GIT_HISTORY_PROBE_MODEL_VERSION,
    status: "unavailable",
    traversal: "first_parent",
    objectFormat: fields.objectFormat ?? null,
    repositorySnapshotId: fields.repositorySnapshotId ?? null,
    repositoryRelativePath: fields.repositoryRelativePath ?? null,
    requestedRevision,
    resolvedRevision: fields.resolvedRevision ?? null,
    headCommitId: fields.headCommitId ?? null,
    currentSourceDigest: fields.currentSourceDigest ?? null,
    selectedSourceDigest: fields.selectedSourceDigest ?? null,
    inspectedCommitIds: fields.inspectedCommitIds ?? [],
    snapshots: fields.snapshots ?? [],
    availability: availability([{ cause, commitId: null }]),
  };
}

function commitId(
  value: string,
  objectFormat: "sha1" | "sha256",
): boolean {
  const length = objectFormat === "sha1" ? 40 : 64;
  return new RegExp(`^[0-9a-f]{${length}}$`).test(value);
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
  const executable = dependencies.gitExecutable ?? "git";
  const targetPath = resolve(request.targetPath);
  const initialTarget = await captureTarget(targetPath);
  if (!initialTarget.ok) {
    if ("ambiguous" in initialTarget) {
      return unavailable(requestedRevision, "ambiguous_path");
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

  const snapshots: PlanRevisionSnapshot[] = [];
  for (const inspectedCommitId of inspectedCommitIds) {
    const metadataCommand = runGit(
      executable,
      repositoryRoot,
      "commit_metadata",
      [
        "show",
        "-s",
        "--format=%P%x00%cI",
        inspectedCommitId,
      ],
    );
    if (!metadataCommand.ok) {
      return metadataCommand.kind === "failure"
        ? metadataCommand.failure
        : commandFailure("commit_metadata");
    }
    const metadataText = stdoutText(metadataCommand, "commit_metadata");
    if (typeof metadataText !== "string") return metadataText;
    const separatorIndex = metadataText.indexOf("\0");
    if (separatorIndex === -1) return malformed("commit_metadata");
    const parentText = metadataText.slice(0, separatorIndex).trim();
    const recordedAtText = metadataText.slice(separatorIndex + 1).trim();
    const parentCommitIds = parentText === ""
      ? []
      : parentText.split(" ");
    if (
      parentCommitIds.some((id) => !commitId(id, objectFormat)) ||
      (
        recordedAtText !== "" &&
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(
          recordedAtText,
        )
      )
    ) {
      return malformed("commit_metadata");
    }

    const existsCommand = runGit(
      executable,
      repositoryRoot,
      "snapshot_exists",
      [
        "ls-tree",
        "-z",
        "--name-only",
        inspectedCommitId,
        "--",
        relativePath,
      ],
    );
    if (!existsCommand.ok) {
      return existsCommand.kind === "failure"
        ? existsCommand.failure
        : commandFailure("snapshot_exists");
    }
    let source: Uint8Array | null = null;
    let sourceDigest: string | null = null;
    if (existsCommand.stdout.length > 0) {
      if (
        !existsCommand.stdout.equals(
          Buffer.from(`${relativePath}\0`, "utf8"),
        )
      ) {
        return malformed("snapshot_exists");
      }
      const sourceCommand = runGit(
        executable,
        repositoryRoot,
        "snapshot_source",
        ["cat-file", "blob", `${inspectedCommitId}:${relativePath}`],
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
      repositorySnapshotId,
      relativePath,
      commitId: inspectedCommitId,
      parentCommitIds: Object.freeze(parentCommitIds),
      recordedAt: recordedAtText === "" ? null : recordedAtText,
      sourceDigest,
      source,
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
  if (/(?:^|\n)R\d+\t/.test(renameText)) {
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
  };
}
