import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  planTargetBatchMutation,
  planTargetMutation,
} from "../dist/application/target-mutate.js";
import {
  createTargetDocumentFile,
  replaceTargetDocumentFile,
} from "../dist/io/target-safe-write.js";
import {
  TARGET_GRAMMAR_2_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetDocument,
} from "../dist/semantic/target-validator.js";

function applyEdits(text, edits) {
  let updated = text;
  for (const edit of [...edits].reverse()) {
    updated = `${updated.slice(0, edit.startOffset)}${edit.replacement}${updated.slice(edit.endOffset)}`;
  }
  return updated;
}

function assertTargetValid(text, grammarVersion) {
  const checked = validateTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.equal(checked.validatedDocument.grammarVersion, grammarVersion);
  return checked.validatedDocument.document;
}

const grammar1 = [
  "\uFEFFproject TEMPORAL_MUTATION:",
  "  version 1",
  '  title "temporal mutation 😀"',
  "  duration_unit day",
  "  finish DONE",
  "",
  "milestone NOW:",
  '  title "now"',
  "  state reached",
  "",
  "milestone DONE:",
  '  title "done"',
  "",
  "task WORK NOW -> DONE:",
  '  title "work 😀"',
  "  duration 1d",
  "  status planned",
  "  tags [keep]",
  "",
].join("\r\n");

const upgrade = {
  kind: "batch",
  mutations: [
    {
      kind: "task.set",
      id: "WORK",
      set: {
        notBefore: "2026-07-25T09:00:00.5000+09:30",
        deadline: "2026-07-27",
      },
    },
    {
      kind: "milestone.set",
      id: "DONE",
      set: { deadline: "2026-07-28T00:00:00Z" },
    },
    {
      kind: "project.set",
      set: { version: 2, asOf: "2026-07-25" },
    },
  ],
};

test("target temporal mutation remains capability-checked while Contract 4 is public", () => {
  assert.equal("planTargetMutation" in publicApi, false);
  assert.equal("planTargetBatchMutation" in publicApi, false);
  assert.equal("replaceTargetDocumentFile" in publicApi, false);
  assert.equal("createTargetDocumentFile" in publicApi, false);

  assert.throws(
    () => planTargetMutation(
      grammar1,
      {
        kind: "task.set",
        id: "WORK",
        set: { deadline: "2026-07-27" },
      },
      {
        id: "perttool.target-grammar-2-source",
        version: 1,
        grammarVersion: 2,
      },
    ),
    /target Grammar 2 source capability is required/,
  );

  const active = publicApi.planMutation(grammar1, {
    kind: "task.set",
    id: "WORK",
    set: { deadline: "2026-07-27" },
  });
  assert.equal(active.ok, false);
  assert.equal(active.diagnostics.at(-1)?.code, "PTDSL-005");
  assert.equal(active.updatedText, null);
  assert.deepEqual(active.edits, []);
});

test("one final-candidate batch upgrades and downgrades temporal grammar", () => {
  assertTargetValid(grammar1, 1);
  const upgraded = planTargetBatchMutation(
    grammar1,
    upgrade,
    TARGET_GRAMMAR_2_CAPABILITY,
    { originalLabel: "plan.pert", updatedLabel: "candidate" },
  );

  assert.equal(upgraded.ok, true);
  assert.equal(upgraded.changed, true);
  assert.equal(applyEdits(grammar1, upgraded.edits), upgraded.updatedText);
  assert.ok(upgraded.updatedText.startsWith("\uFEFF"));
  assert.ok(upgraded.updatedText.includes(
    "  version 2\r\n" +
    '  title "temporal mutation 😀"\r\n' +
    "  as_of 2026-07-25\r\n",
  ));
  assert.ok(upgraded.updatedText.includes(
    "milestone DONE:\r\n" +
    '  title "done"\r\n' +
    "  deadline 2026-07-28T00:00:00Z\r\n",
  ));
  assert.ok(upgraded.updatedText.includes(
    "  duration 1d\r\n" +
    "  not_before 2026-07-25T09:00:00.5000+09:30\r\n" +
    "  deadline 2026-07-27\r\n" +
    "  status planned\r\n",
  ));
  assert.match(upgraded.diff, /^--- plan\.pert\n\+\+\+ candidate\n@@ /);
  const upgradedDocument = assertTargetValid(upgraded.updatedText, 2);
  const work = upgradedDocument.declarations.find(({ id }) => id === "WORK");
  assert.equal(
    work.fields.find(({ name }) => name === "not_before").rawValue,
    "2026-07-25T09:00:00.5000+09:30",
  );
  assert.equal(publicApi.checkDocument(upgraded.updatedText).ok, true);

  const repeated = planTargetBatchMutation(
    grammar1,
    upgrade,
    TARGET_GRAMMAR_2_CAPABILITY,
    { originalLabel: "plan.pert", updatedLabel: "candidate" },
  );
  assert.equal(repeated.updatedDigest, upgraded.updatedDigest);
  assert.equal(repeated.diff, upgraded.diff);
  assert.deepEqual(repeated.edits, upgraded.edits);

  const downgraded = planTargetBatchMutation(
    upgraded.updatedText,
    {
      kind: "batch",
      mutations: [
        {
          kind: "project.set",
          set: { version: 1 },
          clear: ["as_of"],
        },
        {
          kind: "milestone.set",
          id: "DONE",
          clear: ["deadline"],
        },
        {
          kind: "task.set",
          id: "WORK",
          clear: ["not_before", "deadline"],
        },
      ],
    },
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(downgraded.ok, true);
  assert.doesNotMatch(downgraded.updatedText, /\b(?:as_of|not_before|deadline)\b/);
  assertTargetValid(downgraded.updatedText, 1);
  assert.equal(publicApi.checkDocument(downgraded.updatedText).ok, true);
});

test("temporal set and clear use localized UTF-16 edits and comment ownership", () => {
  const upgraded = planTargetBatchMutation(
    grammar1,
    upgrade,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(upgraded.ok, true);
  const annotated = upgraded.updatedText
    .replace(
      "  not_before 2026-07-25T09:00:00.5000+09:30\r\n",
      "  # release ownership\r\n" +
      "  not_before 2026-07-25T09:00:00.5000+09:30\r\n",
    )
    .replace(
      "  deadline 2026-07-27\r\n",
      "  # task deadline ownership\r\n" +
      "  deadline 2026-07-27\r\n",
    )
    .replace(
      "  deadline 2026-07-28T00:00:00Z\r\n",
      "  # milestone deadline ownership\r\n" +
      "  deadline 2026-07-28T00:00:00Z\r\n",
    );
  assertTargetValid(annotated, 2);

  const set = planTargetMutation(
    annotated,
    {
      kind: "task.set",
      id: "WORK",
      set: {
        notBefore: "2026-07-26",
        deadline: "2026-07-29T12:00:00-04:00",
      },
    },
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(set.ok, true);
  assert.equal(set.edits.length, 2);
  assert.equal(applyEdits(annotated, set.edits), set.updatedText);
  assert.ok(set.updatedText.includes("  # release ownership\r\n"));
  assert.ok(set.updatedText.includes("  not_before 2026-07-26\r\n"));
  assert.ok(set.updatedText.includes("  deadline 2026-07-29T12:00:00-04:00\r\n"));
  assert.ok(set.updatedText.includes('  title "work 😀"\r\n'));

  const cleared = planTargetBatchMutation(
    set.updatedText,
    {
      kind: "batch",
      mutations: [
        {
          kind: "task.set",
          id: "WORK",
          clear: ["not_before", "deadline"],
        },
        {
          kind: "milestone.set",
          id: "DONE",
          clear: ["deadline"],
        },
      ],
    },
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(cleared.ok, true);
  assert.doesNotMatch(cleared.updatedText, /(?:release|deadline) ownership/);
  assert.ok(cleared.updatedText.includes("  status planned\r\n"));
  assert.ok(cleared.updatedText.includes("  tags [keep]\r\n"));
  assertTargetValid(cleared.updatedText, 2);
});

test("temporal task and milestone additions use the shared canonical order", () => {
  const upgraded = planTargetBatchMutation(
    grammar1,
    upgrade,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(upgraded.ok, true);

  const result = planTargetBatchMutation(
    upgraded.updatedText,
    {
      kind: "batch",
      mutations: [
        { kind: "task.remove", id: "WORK" },
        {
          kind: "milestone.add",
          id: "MID",
          milestone: {
            title: "middle",
            state: "planned",
            deadline: "2026-07-26",
            tags: ["target"],
          },
        },
        {
          kind: "task.add",
          id: "FIRST",
          from: "NOW",
          to: "MID",
          task: {
            title: "first",
            duration: "01.00d",
            notBefore: "2026-07-25",
            deadline: "2026-07-26",
            status: "planned",
            tags: ["target"],
          },
        },
        {
          kind: "task.add",
          id: "SECOND",
          from: "MID",
          to: "DONE",
          task: { title: "second", duration: "1d" },
        },
      ],
    },
    TARGET_GRAMMAR_2_CAPABILITY,
  );

  assert.equal(result.ok, true);
  assert.ok(result.updatedText.includes(
    "milestone MID:\r\n" +
    '  title "middle"\r\n' +
    "  state planned\r\n" +
    "  deadline 2026-07-26\r\n" +
    "  tags [target]\r\n",
  ));
  assert.ok(result.updatedText.includes(
    "task FIRST NOW -> MID:\r\n" +
    '  title "first"\r\n' +
    "  duration 1d\r\n" +
    "  not_before 2026-07-25\r\n" +
    "  deadline 2026-07-26\r\n" +
    "  status planned\r\n" +
    "  tags [target]\r\n",
  ));
  assertTargetValid(result.updatedText, 2);
});

test("invalid temporal candidates and migration-shaped batches fail closed", () => {
  const v1Temporal = planTargetMutation(
    grammar1,
    {
      kind: "task.set",
      id: "WORK",
      set: { deadline: "2026-07-27" },
    },
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(v1Temporal.ok, false);
  assert.ok(v1Temporal.diagnostics.some(({ code }) => code === "PTDSL-005"));
  assert.equal(v1Temporal.updatedText, null);
  assert.deepEqual(v1Temporal.edits, []);

  const upgraded = planTargetBatchMutation(
    grammar1,
    upgrade,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(upgraded.ok, true);

  for (const [mutation, code] of [
    [
      {
        kind: "task.set",
        id: "WORK",
        set: { deadline: "2026-02-30" },
      },
      "PTDSL-008",
    ],
    [
      {
        kind: "project.set",
        clear: ["as_of"],
      },
      "PTSEM-112",
    ],
  ]) {
    const result = planTargetMutation(
      upgraded.updatedText,
      mutation,
      TARGET_GRAMMAR_2_CAPABILITY,
    );
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some(({ code: actual }) => actual === code));
    assert.equal(result.updatedText, null);
    assert.deepEqual(result.edits, []);
  }

  const migration = planTargetBatchMutation(
    upgraded.updatedText,
    {
      kind: "batch",
      mutations: [
        {
          kind: "project.migrate-unit",
          id: "TEMPORAL_MUTATION",
          targetUnit: "hour",
        },
      ],
    },
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(migration.ok, false);
  assert.equal(migration.diagnostics.at(-1)?.code, "PTMUT-301");
  assert.equal(migration.updatedText, null);
  assert.deepEqual(migration.edits, []);
});

test("target temporal candidates reuse digest-locked in-place and out writes", async () => {
  const upgraded = planTargetBatchMutation(
    grammar1,
    upgrade,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(upgraded.ok, true);
  const changed = planTargetMutation(
    upgraded.updatedText,
    {
      kind: "task.set",
      id: "WORK",
      set: { deadline: "2026-07-30" },
    },
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(changed.ok, true);

  const directory = await mkdtemp(path.join(tmpdir(), "perttool-target-write-"));
  try {
    const source = path.join(directory, "source.pert");
    const output = path.join(directory, "output.pert");
    await writeFile(source, upgraded.updatedText, "utf8");

    const written = await replaceTargetDocumentFile(
      source,
      changed.updatedText,
      TARGET_GRAMMAR_2_CAPABILITY,
      {
        initialDigest: changed.originalDigest,
        expectedDigest: changed.originalDigest,
      },
    );
    assert.equal(written.written, true);
    assert.equal(written.digest, changed.updatedDigest);
    assert.equal(await readFile(source, "utf8"), changed.updatedText);
    assertTargetValid(await readFile(source, "utf8"), 2);

    const created = await createTargetDocumentFile(
      output,
      changed.updatedText,
      TARGET_GRAMMAR_2_CAPABILITY,
      { mode: 0o600 },
    );
    assert.equal(created.written, true);
    assert.equal(created.digest, changed.updatedDigest);
    assert.equal(await readFile(output, "utf8"), changed.updatedText);

    const publicOutput = path.join(directory, "active-accepts.pert");
    const publicCreated = await publicApi.createDocumentFile(
      publicOutput,
      changed.updatedText,
    );
    assert.equal(publicCreated.written, true);
    assert.equal(await readFile(publicOutput, "utf8"), changed.updatedText);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
