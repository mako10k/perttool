import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  planTargetGovernanceAdvance,
  planTargetGovernanceBatchMutation,
  planTargetGovernanceMutation,
} from "../dist/application/target-governance-mutation.js";
import {
  persistTargetGovernanceResult,
} from "../dist/application/target-governance-write.js";
import {
  TARGET_GRAMMAR_4_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  SafeWriteConflictError,
} from "../dist/index.js";
import * as publicApi from "../dist/index.js";

function source({
  includeBase = true,
  work = [],
} = {}) {
  return [
    "project GOVERNED:",
    "  version 4",
    '  title "governed"',
    "  as_of 2026-07-27",
    "  duration_unit point",
    "  finish FINISH",
    "  goal_owner user",
    "  goal_delegates [llm]",
    "  dag_owner llm",
    "  dag_delegates [codex]",
    "",
    "milestone START:",
    '  title "start"',
    "  state reached",
    "",
    "milestone FINISH:",
    '  title "finish"',
    "",
    ...(includeBase
      ? [
          "task BASE START -> FINISH:",
          '  title "base"',
          "  duration 1p",
          "",
        ]
      : []),
    ...work,
  ].join("\n");
}

function goalMutation() {
  return {
    kind: "project.set",
    set: { goalOwner: "admin" },
  };
}

async function workspace(t) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "perttool-governance-write-"),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function temporaryFiles(directory) {
  return (await readdir(directory)).filter(
    (name) => name.includes(".perttool-") && name.endsWith(".tmp"),
  );
}

test("governance write enforcement remains internal to the Contract 5 target", () => {
  assert.equal("persistTargetGovernanceResult" in publicApi, false);
  assert.equal("replaceTargetGrammar4DocumentFile" in publicApi, false);
  assert.equal(
    "createTargetGrammar4DocumentFileFromSource" in publicApi,
    false,
  );
});

test("PTGOV-101 stops before expected-digest, current-source, and target checks", async (t) => {
  const directory = await workspace(t);
  const input = path.join(directory, "plan.pert");
  const original = source();
  await writeFile(input, original, "utf8");
  const denied = planTargetGovernanceMutation(
    original,
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        actor: "codex",
      },
    },
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.diagnostics[0].code, "PTGOV-101");

  const external = original.replace(
    'title "governed"',
    'title "external change"',
  );
  await writeFile(input, external, "utf8");
  const inPlace = await persistTargetGovernanceResult(
    denied,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      mode: "in_place",
      target: input,
      expectedDigest: `sha256:${"0".repeat(64)}`,
    },
  );
  assert.deepEqual(inPlace, {
    mode: "in_place",
    target: input,
    written: false,
  });
  assert.equal(await readFile(input, "utf8"), external);
  assert.deepEqual(await temporaryFiles(directory), []);

  const absentParent = path.join(directory, "absent");
  const output = path.join(absentParent, "candidate.pert");
  const out = await persistTargetGovernanceResult(
    denied,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      mode: "out",
      source: input,
      target: output,
    },
  );
  assert.deepEqual(out, {
    mode: "out",
    target: output,
    written: false,
  });
  await assert.rejects(readFile(output, "utf8"), { code: "ENOENT" });
});

test("a preview decision cannot be reused as persistent authority", async (t) => {
  const directory = await workspace(t);
  const input = path.join(directory, "plan.pert");
  const original = source();
  await writeFile(input, original, "utf8");
  const preview = planTargetGovernanceMutation(
    original,
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "preview",
        actor: "user",
      },
    },
  );
  assert.equal(preview.ok, true);
  assert.equal(preview.governance.writeAuthorized, true);
  const write = await persistTargetGovernanceResult(
    preview,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      mode: "in_place",
      target: input,
    },
  );
  assert.deepEqual(write, {
    mode: "in_place",
    target: input,
    written: false,
  });
  assert.equal(await readFile(input, "utf8"), original);
});

test("authorized and ordinary direct mutations retain atomic in-place safety", async (t) => {
  const directory = await workspace(t);
  const governedPath = path.join(directory, "governed.pert");
  const original = source();
  await writeFile(governedPath, original, "utf8");
  const governed = planTargetGovernanceMutation(
    original,
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        actor: "user",
      },
    },
  );
  assert.equal(governed.ok, true);
  const governedWrite = await persistTargetGovernanceResult(
    governed,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      mode: "in_place",
      target: governedPath,
      expectedDigest: governed.originalDigest,
    },
  );
  assert.deepEqual(governedWrite, {
    mode: "in_place",
    target: governedPath,
    written: true,
  });
  assert.equal(await readFile(governedPath, "utf8"), governed.updatedText);

  const ordinaryPath = path.join(directory, "ordinary.pert");
  await writeFile(ordinaryPath, original, "utf8");
  const ordinary = planTargetGovernanceMutation(
    original,
    {
      kind: "project.set",
      set: { title: "ordinary maintenance" },
    },
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
      },
    },
  );
  assert.equal(ordinary.ok, true);
  assert.equal(ordinary.governance.applicable, false);
  const ordinaryWrite = await persistTargetGovernanceResult(
    ordinary,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      mode: "in_place",
      target: ordinaryPath,
    },
  );
  assert.equal(ordinaryWrite.written, true);
  assert.equal(await readFile(ordinaryPath, "utf8"), ordinary.updatedText);
  assert.deepEqual(await temporaryFiles(directory), []);
});

test("authorized stale writes retain PTIO conflicts and never reuse the decision", async (t) => {
  const directory = await workspace(t);
  const input = path.join(directory, "plan.pert");
  const original = source();
  await writeFile(input, original, "utf8");
  const authorized = planTargetGovernanceMutation(
    original,
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        actor: "user",
      },
    },
  );
  await assert.rejects(
    persistTargetGovernanceResult(
      authorized,
      TARGET_GRAMMAR_4_CAPABILITY,
      {
        mode: "in_place",
        target: input,
        expectedDigest: `sha256:${"0".repeat(64)}`,
      },
    ),
    (error) =>
      error instanceof SafeWriteConflictError &&
      error.reason === "expected_digest_mismatch",
  );
  assert.equal(await readFile(input, "utf8"), original);

  const external = original.replace(
    'title "governed"',
    'title "external change"',
  );
  await writeFile(input, external, "utf8");
  await assert.rejects(
    persistTargetGovernanceResult(
      authorized,
      TARGET_GRAMMAR_4_CAPABILITY,
      {
        mode: "in_place",
        target: input,
      },
    ),
    (error) =>
      error instanceof SafeWriteConflictError &&
      error.reason === "source_changed",
  );
  assert.equal(await readFile(input, "utf8"), external);
  assert.deepEqual(await temporaryFiles(directory), []);
});

test("batch out writes and advance out conflicts use one guarded adapter", async (t) => {
  const directory = await workspace(t);
  const batchSource = path.join(directory, "batch-source.pert");
  const batchOutput = path.join(directory, "batch-output.pert");
  const original = source();
  await writeFile(batchSource, original, "utf8");
  const batch = planTargetGovernanceBatchMutation(
    original,
    {
      kind: "batch",
      mutations: [
        goalMutation(),
        {
          kind: "task.add",
          id: "WORK",
          from: "START",
          to: "FINISH",
          task: { title: "work", duration: "1p" },
        },
      ],
    },
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        actor: "codex",
        acceptedByOwner: ["user"],
      },
    },
  );
  assert.equal(batch.ok, true);
  const batchWrite = await persistTargetGovernanceResult(
    batch,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      mode: "out",
      source: batchSource,
      target: batchOutput,
    },
  );
  assert.deepEqual(batchWrite, {
    mode: "out",
    target: batchOutput,
    written: true,
  });
  assert.equal(await readFile(batchSource, "utf8"), original);
  assert.equal(await readFile(batchOutput, "utf8"), batch.updatedText);

  const advanceText = source({
    includeBase: false,
    work: [
      "task WORK START -> FINISH:",
      '  title "work"',
      "  duration 1p",
      "  status done",
      "",
    ],
  });
  const advanceSource = path.join(directory, "advance-source.pert");
  const advanceOutput = path.join(directory, "advance-output.pert");
  await writeFile(advanceSource, advanceText, "utf8");
  const advance = planTargetGovernanceAdvance(
    advanceText,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        actor: "codex",
      },
    },
  );
  assert.equal(advance.ok, true);
  assert.deepEqual(advance.advance.removedTaskIds, ["WORK"]);
  await writeFile(
    advanceSource,
    advanceText.replace('title "governed"', 'title "changed"'),
    "utf8",
  );
  await assert.rejects(
    persistTargetGovernanceResult(
      advance,
      TARGET_GRAMMAR_4_CAPABILITY,
      {
        mode: "out",
        source: advanceSource,
        target: advanceOutput,
      },
    ),
    (error) =>
      error instanceof SafeWriteConflictError &&
      error.reason === "source_changed",
  );
  await assert.rejects(readFile(advanceOutput, "utf8"), { code: "ENOENT" });
  assert.deepEqual(await temporaryFiles(directory), []);
});
