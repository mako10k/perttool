import assert from "node:assert/strict";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createDocumentFile,
  documentContentFromBytes,
  readDocumentFile,
  replaceDocumentFile,
  SafeWriteConflictError,
  SafeWriteVerificationError,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const minimalText = readFileSync(path.join(root, "docs/examples/minimal.pert"), "utf8");

function candidate(title) {
  return minimalText.replace('title "作業する"', `title "${title}"`);
}

function workspace(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-safe-write-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function temporaryFiles(directory) {
  return readdirSync(directory).filter((name) => name.includes(".perttool-") && name.endsWith(".tmp"));
}

test("document file reader preserves BOM bytes and raw SHA-256 identity", async () => {
  const bytes = Buffer.from(`\uFEFF${minimalText}`, "utf8");
  const content = documentContentFromBytes(bytes);
  assert.deepEqual(content.bytes, bytes);
  assert.equal(content.text.startsWith("\uFEFFproject MINIMAL:"), true);

  const directory = mkdtempSync(path.join(tmpdir(), "perttool-document-read-"));
  try {
    const source = path.join(directory, "plan.pert");
    writeFileSync(source, bytes);
    assert.deepEqual(await readDocumentFile(source), content);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("in-place safe write preserves mode, atomically replaces, and verifies the candidate", async (t) => {
  const directory = workspace(t);
  const source = path.join(directory, "plan.pert");
  writeFileSync(source, minimalText, { mode: 0o640 });
  chmodSync(source, 0o640);
  const before = await readDocumentFile(source);
  const beforeInode = statSync(source).ino;
  const updated = candidate("safe write");

  const result = await replaceDocumentFile(source, updated, {
    initialDigest: before.digest,
    expectedDigest: before.digest,
  });

  assert.deepEqual(result, {
    mode: "in_place",
    target: source,
    digest: (await readDocumentFile(source)).digest,
    bytesWritten: Buffer.byteLength(updated),
  });
  assert.equal(readFileSync(source, "utf8"), updated);
  assert.equal(statSync(source).mode & 0o777, 0o640);
  assert.notEqual(statSync(source).ino, beforeInode);
  assert.deepEqual(temporaryFiles(directory), []);
});

test("in-place safe write rejects stale digests, changed sources, symlinks, and invalid candidates", async (t) => {
  const directory = workspace(t);
  const source = path.join(directory, "plan.pert");
  writeFileSync(source, minimalText);
  const initial = await readDocumentFile(source);

  await assert.rejects(
    replaceDocumentFile(source, candidate("expected mismatch"), {
      initialDigest: initial.digest,
      expectedDigest: `sha256:${"0".repeat(64)}`,
    }),
    (error) => error instanceof SafeWriteConflictError &&
      error.reason === "expected_digest_mismatch",
  );
  assert.equal(readFileSync(source, "utf8"), minimalText);

  const external = candidate("external change");
  writeFileSync(source, external);
  await assert.rejects(
    replaceDocumentFile(source, candidate("stale candidate"), {
      initialDigest: initial.digest,
    }),
    (error) => error instanceof SafeWriteConflictError && error.reason === "source_changed",
  );
  assert.equal(readFileSync(source, "utf8"), external);

  const removed = path.join(directory, "removed.pert");
  writeFileSync(removed, minimalText);
  const removedInitial = await readDocumentFile(removed);
  unlinkSync(removed);
  await assert.rejects(
    replaceDocumentFile(removed, candidate("removed candidate"), {
      initialDigest: removedInitial.digest,
    }),
    (error) => error instanceof SafeWriteConflictError && error.reason === "source_changed",
  );

  const symlink = path.join(directory, "link.pert");
  symlinkSync(path.basename(source), symlink);
  const linked = await readDocumentFile(symlink);
  await assert.rejects(
    replaceDocumentFile(symlink, candidate("symlink candidate"), {
      initialDigest: linked.digest,
    }),
    (error) => error instanceof SafeWriteConflictError && error.reason === "symlink",
  );
  assert.equal(lstatSync(symlink).isSymbolicLink(), true);

  await assert.rejects(
    replaceDocumentFile(directory, candidate("directory candidate"), {
      initialDigest: linked.digest,
    }),
    (error) => error instanceof SafeWriteConflictError &&
      error.reason === "not_regular_file",
  );

  await assert.rejects(
    replaceDocumentFile(source, "project INVALID:\n  title \"invalid\"\n", {
      initialDigest: (await readDocumentFile(source)).digest,
    }),
    (error) => error instanceof SafeWriteVerificationError &&
      error.reason === "invalid_candidate" &&
      error.diagnostics.length > 0,
  );
  assert.equal(readFileSync(source, "utf8"), external);
  assert.deepEqual(temporaryFiles(directory), []);
});

test("out safe write creates once, rejects existing paths and symlinks, and cleans temporary files", async (t) => {
  const directory = workspace(t);
  const output = path.join(directory, "output.pert");
  const created = candidate("created output");
  const result = await createDocumentFile(output, created, { mode: 0o600 });
  assert.equal(result.mode, "out");
  assert.equal(readFileSync(output, "utf8"), created);
  assert.equal(statSync(output).mode & 0o777, 0o600);

  await assert.rejects(
    createDocumentFile(output, candidate("must not overwrite")),
    (error) => error instanceof SafeWriteConflictError && error.reason === "target_exists",
  );
  assert.equal(readFileSync(output, "utf8"), created);

  const symlink = path.join(directory, "output-link.pert");
  symlinkSync(path.basename(output), symlink);
  await assert.rejects(
    createDocumentFile(symlink, candidate("must not follow")),
    (error) => error instanceof SafeWriteConflictError && error.reason === "symlink",
  );
  assert.equal(lstatSync(symlink).isSymbolicLink(), true);
  assert.deepEqual(temporaryFiles(directory), []);
});

test("concurrent out writers never overwrite the winning target", async (t) => {
  const directory = workspace(t);
  const output = path.join(directory, "race.pert");
  const candidates = [candidate("writer one"), candidate("writer two")];
  const settled = await Promise.allSettled(
    candidates.map((text) => createDocumentFile(output, text)),
  );
  assert.equal(settled.filter(({ status }) => status === "fulfilled").length, 1);
  const rejected = settled.find(({ status }) => status === "rejected");
  assert.equal(rejected.status, "rejected");
  assert.ok(rejected.reason instanceof SafeWriteConflictError);
  assert.equal(rejected.reason.reason, "target_exists");
  assert.ok(candidates.includes(readFileSync(output, "utf8")));
  assert.deepEqual(temporaryFiles(directory), []);
});
