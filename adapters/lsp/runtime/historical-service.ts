import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { documentOffsetToPosition } from "perttool/core";
import {
  inspectTargetHistoricalGraphFile,
  targetHistoricalGraphResultToJson,
} from "../../../src/application/target-historical-graph.js";
import { probeHistoricalGitEvidence } from "../../../src/history/git-probe.js";
import type {
  HistoricalApplicationInspectionV1,
  HistoricalEditorApplicationV1,
  HistoricalGraphEditorProjectionV1,
  HistoricalGraphViewParamsV1,
  HistoricalSourceBindingV1,
} from "../src/protocol.js";

const semanticKeys = [
  "model",
  "model_version",
  "transition_model_version",
  "status",
  "request",
  "evidence",
  "effective_checkpoint_id",
  "selected_snapshot_commit_id",
  "checkpoints",
  "snapshot",
  "lineage",
  "timeline",
  "analysis",
  "source_bindings",
  "causes",
  "limits",
] as const;

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function within(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." && !path.isAbsolute(relative);
}

async function resolveLocalTarget(
  documentUri: string,
  workspaceFolderUris: readonly string[],
): Promise<{ readonly targetPath: string } | null> {
  let target: string;
  try {
    const parsed = new URL(documentUri);
    if (parsed.protocol !== "file:") return null;
    target = path.resolve(fileURLToPath(parsed));
  } catch {
    return null;
  }
  if (path.extname(target) !== ".pert") return null;
  let targetStat;
  let targetReal: string;
  try {
    targetStat = await lstat(target);
    targetReal = await realpath(target);
  } catch {
    return null;
  }
  if (!targetStat.isFile() || targetStat.isSymbolicLink() || targetReal !== target) {
    return null;
  }
  const roots: string[] = [];
  for (const rootUri of workspaceFolderUris) {
    try {
      const parsed = new URL(rootUri);
      if (parsed.protocol !== "file:") continue;
      roots.push(await realpath(fileURLToPath(parsed)));
    } catch {
      continue;
    }
  }
  if (roots.filter((root) => within(root, target)).length !== 1) return null;
  return Object.freeze({ targetPath: target });
}

function semanticProjection(
  value: Readonly<Record<string, unknown>>,
): HistoricalGraphEditorProjectionV1 | null {
  const projection: Record<string, unknown> = {};
  for (const key of semanticKeys) {
    if (!(key in value)) return null;
    projection[key] = value[key];
  }
  if (
    projection["model"] !== "Perttool.HistoricalDagModel.v1" ||
    projection["model_version"] !== 1 ||
    projection["transition_model_version"] !== 1 ||
    !["complete", "incomplete", "unavailable"].includes(
      String(projection["status"]),
    ) ||
    !record(projection["request"]) ||
    !record(projection["evidence"]) ||
    !Array.isArray(projection["checkpoints"]) ||
    !record(projection["analysis"]) ||
    !Array.isArray(projection["source_bindings"]) ||
    !Array.isArray(projection["causes"]) ||
    !record(projection["limits"])
  ) {
    return null;
  }
  return Object.freeze(projection) as unknown as HistoricalGraphEditorProjectionV1;
}

async function inspect(
  targetPath: string,
  request: HistoricalGraphViewParamsV1,
  expectedSourceDigest: `sha256:${string}`,
): Promise<HistoricalApplicationInspectionV1> {
  const result = await inspectTargetHistoricalGraphFile({
    targetPath,
    requestedEndpoint: request.requestedEndpoint,
    ...(request.lowerBoundary === null
      ? {}
      : { lowerBoundary: request.lowerBoundary }),
    ancestryProfile: request.ancestryProfile,
    view: request.view,
    ...(request.snapshotCommitId === null
      ? {}
      : { snapshotCommitId: request.snapshotCommitId }),
    analysisMode: request.analysisMode,
    expectedSourceDigest,
  }, { probe: probeHistoricalGitEvidence });
  const projected = targetHistoricalGraphResultToJson(result);
  return Object.freeze({
    projection: semanticProjection(projected),
    diagnostics: Object.freeze(result.diagnostics.map((diagnostic) =>
      Object.freeze({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
      })
    )),
    diagnosticsTruncated: result.diagnosticsTruncated,
  });
}

function git(
  repositoryRoot: string,
  args: readonly string[],
  encoding: "utf8" | "buffer" = "utf8",
): string | Buffer | null {
  const result = spawnSync("git", ["-C", repositoryRoot, ...args], {
    encoding: encoding === "utf8" ? "utf8" : null,
    maxBuffer: 8_388_608 + 65_536,
    shell: false,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 30_000,
  });
  if (result.error !== undefined || result.status !== 0) return null;
  if (encoding === "buffer") return Buffer.from(result.stdout as Buffer);
  return String(result.stdout).replace(/\r?\n$/u, "");
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function loadSource(
  targetPath: string,
  binding: HistoricalSourceBindingV1,
): Promise<{
  readonly text: string;
  readonly range: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
} | null> {
  let targetReal: string;
  try {
    const targetStat = await lstat(targetPath);
    targetReal = await realpath(targetPath);
    if (
      !targetStat.isFile() || targetStat.isSymbolicLink() ||
      targetReal !== path.resolve(targetPath)
    ) return null;
  } catch {
    return null;
  }
  const rootText = git(path.dirname(targetReal), [
    "rev-parse",
    "--path-format=absolute",
    "--show-toplevel",
  ]);
  if (typeof rootText !== "string") return null;
  let repositoryRoot: string;
  let commonDirectory: string;
  try {
    repositoryRoot = await realpath(rootText);
    const commonText = git(repositoryRoot, [
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]);
    if (typeof commonText !== "string") return null;
    commonDirectory = await realpath(commonText);
  } catch {
    return null;
  }
  const relativePath = path.relative(repositoryRoot, targetReal).split(path.sep).join("/");
  if (
    relativePath !== binding.repository_relative_path ||
    `git-repository:${sha256(Buffer.from(commonDirectory, "utf8"))}` !==
      binding.repository_id
  ) return null;
  const tree = git(repositoryRoot, [
    "ls-tree",
    "-z",
    binding.commit_id,
    "--",
    binding.repository_relative_path,
  ]);
  const expectedTreeSuffix =
    ` blob ${binding.blob_id}\t${binding.repository_relative_path}\u0000`;
  if (
    typeof tree !== "string" ||
    !(tree === `100644${expectedTreeSuffix}` ||
      tree === `100755${expectedTreeSuffix}`)
  ) return null;
  if (git(repositoryRoot, ["cat-file", "-t", binding.blob_id]) !== "blob") {
    return null;
  }
  const bytes = git(
    repositoryRoot,
    ["cat-file", "blob", binding.blob_id],
    "buffer",
  );
  if (!(bytes instanceof Buffer) || bytes.length > 8_388_608) return null;
  if (sha256(bytes) !== binding.source_digest) return null;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return null;
  }
  const start = documentOffsetToPosition(text, binding.range.start.offset);
  const end = documentOffsetToPosition(text, binding.range.end.offset);
  if (
    start === null || end === null ||
    start.line !== binding.range.start.line ||
    start.character !== binding.range.start.column ||
    end.line !== binding.range.end.line ||
    end.character !== binding.range.end.column ||
    binding.range.start.offset > binding.range.end.offset
  ) return null;
  return Object.freeze({ text, range: Object.freeze({ start, end }) });
}

export function createHistoricalEditorApplication(): HistoricalEditorApplicationV1 {
  return Object.freeze({ resolveLocalTarget, inspect, loadSource });
}
