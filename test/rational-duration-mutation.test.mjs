import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  planTargetGrammar3BatchMutation,
  planTargetGrammar3Mutation,
} from "../dist/application/target-mutate.js";
import {
  createTargetGrammar3DocumentFile,
  replaceTargetGrammar3DocumentFile,
} from "../dist/io/target-safe-write.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar3Document,
} from "../dist/semantic/target-validator.js";

const grammar3 = `project EXACT_MUTATION:
  version 3
  title "exact mutation"
  as_of 2026-07-25
  duration_unit day
  finish FINISH
  critical_epsilon 1/3d
  target_duration 2/3d

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task KEEP START -> FINISH:
  title "keep"
  duration 4/6d

task CHANGE START -> FINISH:
  title "change"
  duration 1d
`;

const grammar2 = grammar3
  .replace("  version 3", "  version 2")
  .replace("  critical_epsilon 1/3d", "  critical_epsilon 0.5d")
  .replace("  target_duration 2/3d", "  target_duration 1d")
  .replace("  duration 4/6d", "  duration 0.5d");

function assertGrammar3Valid(source, version) {
  const checked = validateTargetGrammar3Document(
    source,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.equal(checked.validatedDocument.grammarVersion, version);
}

test("Grammar 3 mutation and safe-write entry points remain internal", () => {
  for (const name of [
    "planTargetGrammar3Mutation",
    "planTargetGrammar3BatchMutation",
    "createTargetGrammar3DocumentFile",
    "replaceTargetGrammar3DocumentFile",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
  assert.throws(
    () => planTargetGrammar3Mutation(
      grammar3,
      {
        kind: "task.set",
        id: "CHANGE",
        set: { duration: "1/3d" },
      },
      {
        id: "perttool.target-grammar-3-source",
        version: 1,
        grammarVersion: 3,
      },
    ),
    /target Grammar 3 source capability is required/,
  );
});

test("Grammar 3 project and task mutation canonicalize only changed Duration fields", () => {
  const result = planTargetGrammar3BatchMutation(
    grammar3,
    {
      kind: "batch",
      mutations: [
        {
          kind: "project.set",
          set: {
            criticalEpsilon: "4/6d",
            targetDuration: "1/2d",
          },
        },
        {
          kind: "task.set",
          id: "CHANGE",
          set: {
            estimate: {
              optimistic: "2/6d",
              mostLikely: "4/6d",
              pessimistic: "6/6d",
            },
          },
        },
      ],
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.ok(result.updatedText.includes("  critical_epsilon 2/3d\n"));
  assert.ok(result.updatedText.includes("  target_duration 0.5d\n"));
  assert.ok(result.updatedText.includes("  duration 4/6d\n"));
  assert.ok(result.updatedText.includes(
    `task CHANGE START -> FINISH:
  title "change"
  estimate:
    optimistic 1/3d
    most_likely 2/3d
    pessimistic 1d
`,
  ));
  assertGrammar3Valid(result.updatedText, 3);

  const repeated = planTargetGrammar3BatchMutation(
    grammar3,
    {
      kind: "batch",
      mutations: [
        {
          kind: "project.set",
          set: {
            criticalEpsilon: "4/6d",
            targetDuration: "1/2d",
          },
        },
        {
          kind: "task.set",
          id: "CHANGE",
          set: {
            estimate: {
              optimistic: "2/6d",
              mostLikely: "4/6d",
              pessimistic: "6/6d",
            },
          },
        },
      ],
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(repeated.updatedDigest, result.updatedDigest);
  assert.equal(repeated.diff, result.diff);
  assert.deepEqual(repeated.edits, result.edits);
});

test("Grammar 3 task.add uses exact canonical generation", () => {
  const result = planTargetGrammar3Mutation(
    grammar3,
    {
      kind: "task.add",
      id: "ADDED",
      from: "START",
      to: "FINISH",
      task: {
        title: "added",
        duration: "6/8d",
      },
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.ok(result.updatedText.includes(
    `task ADDED START -> FINISH:
  title "added"
  duration 0.75d
`,
  ));
  assertGrammar3Valid(result.updatedText, 3);
});

test("one final-candidate batch explicitly upgrades or returns from Grammar 3", () => {
  const upgraded = planTargetGrammar3BatchMutation(
    grammar2,
    {
      kind: "batch",
      mutations: [
        { kind: "project.set", set: { version: 3 } },
        {
          kind: "task.set",
          id: "CHANGE",
          set: { duration: "1/3d" },
        },
      ],
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(upgraded.ok, true);
  assert.ok(upgraded.updatedText.includes("  version 3\n"));
  assert.ok(upgraded.updatedText.includes("  duration 1/3d\n"));
  assertGrammar3Valid(upgraded.updatedText, 3);

  const returned = planTargetGrammar3BatchMutation(
    upgraded.updatedText,
    {
      kind: "batch",
      mutations: [
        { kind: "project.set", set: { version: 2 } },
        {
          kind: "task.set",
          id: "CHANGE",
          set: { duration: "1/2d" },
        },
      ],
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(returned.ok, true);
  assert.ok(returned.updatedText.includes("  version 2\n"));
  assert.ok(returned.updatedText.includes("  duration 0.5d\n"));
  assertGrammar3Valid(returned.updatedText, 2);

  const invalidReturn = planTargetGrammar3BatchMutation(
    upgraded.updatedText,
    {
      kind: "batch",
      mutations: [
        { kind: "project.set", set: { version: 2 } },
        {
          kind: "task.set",
          id: "CHANGE",
          set: { duration: "1/3d" },
        },
      ],
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(invalidReturn.ok, false);
  assert.equal(invalidReturn.updatedText, null);
  assert.deepEqual(invalidReturn.edits, []);
  assert.ok(invalidReturn.diagnostics.some(({ code }) => code === "PTDSL-007"));
});

test("Grammar 3 batch still excludes automatic migration", () => {
  const result = planTargetGrammar3BatchMutation(
    grammar3,
    {
      kind: "batch",
      mutations: [
        {
          kind: "project.migrate-unit",
          id: "EXACT_MUTATION",
          targetUnit: "hour",
        },
      ],
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.at(-1)?.code, "PTMUT-301");
  assert.equal(result.updatedText, null);
  assert.deepEqual(result.edits, []);
});

test("malformed Grammar 3 Duration mutation exposes no candidate", () => {
  const result = planTargetGrammar3Mutation(
    grammar3,
    {
      kind: "task.set",
      id: "CHANGE",
      set: { duration: "1/0d" },
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(result.ok, false);
  assert.equal(result.updatedText, null);
  assert.deepEqual(result.edits, []);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["PTDSL-007"]);
});

test("Grammar 3 candidates reuse digest-locked safe writes", async () => {
  const changed = planTargetGrammar3Mutation(
    grammar3,
    {
      kind: "task.set",
      id: "CHANGE",
      set: { duration: "4/6d" },
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(changed.ok, true);
  assert.ok(changed.updatedText.includes("  duration 2/3d\n"));

  const directory = await mkdtemp(path.join(tmpdir(), "perttool-grammar3-write-"));
  try {
    const target = path.join(directory, "plan.pert");
    const output = path.join(directory, "output.pert");
    await writeFile(target, grammar3, "utf8");
    const written = await replaceTargetGrammar3DocumentFile(
      target,
      changed.updatedText,
      TARGET_GRAMMAR_3_CAPABILITY,
      {
        initialDigest: changed.originalDigest,
        expectedDigest: changed.originalDigest,
      },
    );
    assert.equal(written.written, true);
    assert.equal(written.digest, changed.updatedDigest);
    assert.equal(await readFile(target, "utf8"), changed.updatedText);
    assertGrammar3Valid(await readFile(target, "utf8"), 3);

    const created = await createTargetGrammar3DocumentFile(
      output,
      changed.updatedText,
      TARGET_GRAMMAR_3_CAPABILITY,
      { mode: 0o600 },
    );
    assert.equal(created.written, true);
    assert.equal(created.digest, changed.updatedDigest);
    assert.equal(await readFile(output, "utf8"), changed.updatedText);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
