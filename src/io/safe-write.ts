import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  link,
  lstat,
  open,
  rename,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { checkDocument } from "../application/check.js";
import type { Diagnostic } from "../model/diagnostics.js";
import {
  digestDocumentBytes,
  readDocumentFile,
} from "./document-file.js";

export type SafeWriteConflictReason =
  | "expected_digest_mismatch"
  | "source_changed"
  | "symlink"
  | "not_regular_file"
  | "target_exists";

export class SafeWriteConflictError extends Error {
  constructor(
    readonly reason: SafeWriteConflictReason,
    message: string,
  ) {
    super(message);
    this.name = "SafeWriteConflictError";
  }
}

export type SafeWriteVerificationReason =
  | "invalid_candidate"
  | "post_write_digest_mismatch"
  | "post_write_invalid";

export class SafeWriteVerificationError extends Error {
  constructor(
    readonly reason: SafeWriteVerificationReason,
    message: string,
    readonly diagnostics: readonly Diagnostic[] = [],
  ) {
    super(message);
    this.name = "SafeWriteVerificationError";
  }
}

export interface ReplaceDocumentOptions {
  readonly initialDigest: string;
  readonly expectedDigest?: string;
}

export interface CreateDocumentOptions {
  readonly mode?: number;
}

export interface DocumentWriteResult {
  readonly mode: "in_place" | "out";
  readonly target: string;
  readonly digest: string;
  readonly bytesWritten: number;
  readonly written: boolean;
}

interface WritableSource {
  readonly digest: string;
  readonly mode: number;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { readonly code?: unknown }).code)
    : undefined;
}

async function writableSource(path: string): Promise<WritableSource> {
  const pathStat = await lstat(path);
  if (pathStat.isSymbolicLink()) {
    throw new SafeWriteConflictError("symlink", `symlink inputへのwriteは拒否されました: ${path}`);
  }
  if (!pathStat.isFile()) {
    throw new SafeWriteConflictError(
      "not_regular_file",
      `regular file以外へのwriteは拒否されました: ${path}`,
    );
  }

  let handle: FileHandle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (errorCode(error) === "ELOOP") {
      throw new SafeWriteConflictError(
        "symlink",
        `symlink inputへのwriteは拒否されました: ${path}`,
      );
    }
    throw error;
  }
  try {
    const openedStat = await handle.stat();
    if (!openedStat.isFile()) {
      throw new SafeWriteConflictError(
        "not_regular_file",
        `regular file以外へのwriteは拒否されました: ${path}`,
      );
    }
    if (openedStat.dev !== pathStat.dev || openedStat.ino !== pathStat.ino) {
      throw new SafeWriteConflictError(
        "source_changed",
        `document pathがread中に置き換えられました: ${path}`,
      );
    }
    const bytes = await handle.readFile();
    return {
      digest: digestDocumentBytes(bytes),
      mode: openedStat.mode & 0o7777,
    };
  } finally {
    await handle.close();
  }
}

async function currentWritableSource(path: string): Promise<WritableSource> {
  try {
    return await writableSource(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new SafeWriteConflictError(
        "source_changed",
        `documentが初回read後に削除されました: ${path}`,
      );
    }
    throw error;
  }
}

function validateCandidate(candidateText: string): Buffer {
  const checked = checkDocument(candidateText);
  if (!checked.ok) {
    throw new SafeWriteVerificationError(
      "invalid_candidate",
      "safe-write candidateがdocument検査に失敗しました",
      checked.diagnostics,
    );
  }
  return Buffer.from(candidateText, "utf8");
}

async function exclusiveTemporary(
  target: string,
  mode: number,
): Promise<{ readonly path: string; readonly handle: FileHandle }> {
  const directory = dirname(target);
  const stem = basename(target);
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const token = randomBytes(12).toString("hex");
    const temporaryPath = join(directory, `.${stem}.perttool-${process.pid}-${token}.tmp`);
    try {
      const handle = await open(
        temporaryPath,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        mode,
      );
      return { path: temporaryPath, handle };
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
    }
  }
  throw new Error(`exclusive temporary fileを作成できませんでした: ${target}`);
}

async function writeAndSyncTemporary(
  target: string,
  bytes: Buffer,
  mode: number,
): Promise<string> {
  const temporary = await exclusiveTemporary(target, mode);
  try {
    await temporary.handle.writeFile(bytes);
    await temporary.handle.chmod(mode);
    await temporary.handle.sync();
    await temporary.handle.close();
  } catch (error) {
    await temporary.handle.close().catch(() => undefined);
    await unlink(temporary.path).catch(() => undefined);
    throw error;
  }
  return temporary.path;
}

async function syncParentDirectory(target: string): Promise<void> {
  let handle: FileHandle;
  try {
    handle = await open(dirname(target), constants.O_RDONLY);
  } catch (error) {
    if (["EACCES", "EISDIR", "ENOTSUP"].includes(errorCode(error) ?? "")) return;
    throw error;
  }
  try {
    await handle.sync();
  } catch (error) {
    if (!["EINVAL", "ENOTSUP", "EOPNOTSUPP"].includes(errorCode(error) ?? "")) {
      throw error;
    }
  } finally {
    await handle.close();
  }
}

async function verifyWrittenDocument(
  target: string,
  candidateDigest: string,
): Promise<void> {
  const written = await readDocumentFile(target);
  if (written.digest !== candidateDigest) {
    throw new SafeWriteVerificationError(
      "post_write_digest_mismatch",
      `written document digestがcandidateと一致しません: ${target}`,
    );
  }
  const checked = checkDocument(written.text);
  if (!checked.ok) {
    throw new SafeWriteVerificationError(
      "post_write_invalid",
      `written documentが再検査に失敗しました: ${target}`,
      checked.diagnostics,
    );
  }
}

export async function replaceDocumentFile(
  target: string,
  candidateText: string,
  options: ReplaceDocumentOptions,
): Promise<DocumentWriteResult> {
  const candidateBytes = validateCandidate(candidateText);
  const candidateDigest = digestDocumentBytes(candidateBytes);
  if (
    options.expectedDigest !== undefined &&
    options.expectedDigest !== options.initialDigest
  ) {
    throw new SafeWriteConflictError(
      "expected_digest_mismatch",
      "--expect-digestがinitial document digestと一致しません",
    );
  }

  const beforeWrite = await currentWritableSource(target);
  if (beforeWrite.digest !== options.initialDigest) {
    throw new SafeWriteConflictError(
      "source_changed",
      `documentが初回read後に変更されました: ${target}`,
    );
  }

  if (candidateDigest === options.initialDigest) {
    return {
      mode: "in_place",
      target,
      digest: candidateDigest,
      bytesWritten: 0,
      written: false,
    };
  }

  const temporaryPath = await writeAndSyncTemporary(
    target,
    candidateBytes,
    beforeWrite.mode,
  );
  let renamed = false;
  try {
    const beforeRename = await currentWritableSource(target);
    if (beforeRename.digest !== options.initialDigest) {
      throw new SafeWriteConflictError(
        "source_changed",
        `documentがcommit直前に変更されました: ${target}`,
      );
    }
    await rename(temporaryPath, target);
    renamed = true;
    await syncParentDirectory(target);
    await verifyWrittenDocument(target, candidateDigest);
  } finally {
    if (!renamed) await unlink(temporaryPath).catch(() => undefined);
  }

  return {
    mode: "in_place",
    target,
    digest: candidateDigest,
    bytesWritten: candidateBytes.byteLength,
    written: true,
  };
}

async function assertTargetAbsent(target: string): Promise<void> {
  try {
    const targetStat = await lstat(target);
    throw new SafeWriteConflictError(
      targetStat.isSymbolicLink() ? "symlink" : "target_exists",
      `--out targetは既に存在します: ${target}`,
    );
  } catch (error) {
    if (errorCode(error) === "ENOENT") return;
    throw error;
  }
}

export async function createDocumentFile(
  target: string,
  candidateText: string,
  options: CreateDocumentOptions = {},
): Promise<DocumentWriteResult> {
  const candidateBytes = validateCandidate(candidateText);
  const candidateDigest = digestDocumentBytes(candidateBytes);
  await assertTargetAbsent(target);
  const temporaryPath = await writeAndSyncTemporary(
    target,
    candidateBytes,
    options.mode ?? (0o666 & ~process.umask()),
  );
  let linked = false;
  try {
    await assertTargetAbsent(target);
    try {
      await link(temporaryPath, target);
      linked = true;
    } catch (error) {
      if (errorCode(error) === "EEXIST") {
        throw new SafeWriteConflictError(
          "target_exists",
          `--out targetがcommit前に作成されました: ${target}`,
        );
      }
      throw error;
    }
    await syncParentDirectory(target);
    await verifyWrittenDocument(target, candidateDigest);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
    if (linked) await syncParentDirectory(target);
  }

  return {
    mode: "out",
    target,
    digest: candidateDigest,
    bytesWritten: candidateBytes.byteLength,
    written: true,
  };
}
