import assert from "node:assert/strict";
import test from "node:test";
import { checkDocument, planMutation } from "../dist/index.js";

function applyEdits(text, edits) {
  let updated = text;
  for (const edit of [...edits].reverse()) {
    updated = `${updated.slice(0, edit.startOffset)}${edit.replacement}${updated.slice(edit.endOffset)}`;
  }
  return updated;
}

function assertValid(text) {
  const checked = checkDocument(text);
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  return checked;
}

const linear = [
  "project MUTATION:",
  "  version 1",
  "  title \"mutation\"",
  "  duration_unit day",
  "  finish DONE",
  "",
  "milestone NOW:",
  "  title \"now\"",
  "  state reached",
  "",
  "milestone DONE:",
  "  title \"done\"",
  "",
  "task WORK NOW -> DONE:",
  "  title \"work\"",
  "  duration 1d",
  "",
].join("\n");

const entityPlan = [
  "project ENTITY_MUTATION:",
  "  title \"entity mutation\"",
  "  duration_unit day",
  "  finish DONE",
  "",
  "resource DEV:",
  "  title \"developers\"",
  "  # capacity context",
  "  description \"shared\"",
  "  capacity 2",
  "  tags [preserve]",
  "",
  "# unused resource documentation",
  "resource UNUSED:",
  "  title \"unused\"",
  "  capacity 1",
  "",
  "milestone NOW:",
  "  title \"now\"",
  "  state reached",
  "",
  "milestone MID:",
  "  title \"middle\"",
  "  # description context",
  "  description \"old description\"",
  "  tags [old, keep]",
  "",
  "milestone DONE:",
  "  title \"done\"",
  "",
  "task FIRST NOW -> MID:",
  "  title \"first\"",
  "  duration 1d",
  "  requires:",
  "    DEV 2",
  "",
  "task SECOND MID -> DONE:",
  "  title \"second\"",
  "  duration 1d",
  "",
].join("\n");

const gatePlan = [
  "project GATE_MUTATION:",
  "  title \"gate mutation\"",
  "  duration_unit day",
  "  finish DONE",
  "",
  "milestone NOW:",
  "  title \"now\"",
  "  state reached",
  "",
  "milestone ALT:",
  "  title \"alternate\"",
  "  state reached",
  "",
  "milestone MID:",
  "  title \"middle\"",
  "",
  "milestone DONE:",
  "  title \"done\"",
  "",
  "task FIRST NOW -> MID:",
  "  title \"first\"",
  "  duration 1d",
  "",
  "task SECOND MID -> DONE:",
  "  title \"second\"",
  "  duration 1d",
  "",
  "task ALT_WORK ALT -> DONE:",
  "  title \"alternate work\"",
  "  duration 1d",
  "",
  "# approval ownership",
  "gate APPROVAL ALT -> MID:",
  "  # reason context",
  "  reason |",
  "    old",
  "    reason",
  "",
].join("\n");

test("gate add appends a canonical declaration and preserves source bytes", () => {
  const input = `\uFEFF${linear.replaceAll("\n", "\r\n")}`;
  const result = planMutation(
    input,
    {
      kind: "gate.add",
      id: "APPROVAL",
      from: "NOW",
      to: "DONE",
      gate: { reason: "first\nsecond" },
    },
    { originalLabel: "plan.pert", updatedLabel: "candidate" },
  );

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.edits.length, 1);
  assert.equal(result.edits[0].startOffset, input.length);
  assert.equal(applyEdits(input, result.edits), result.updatedText);
  assert.ok(result.updatedText.startsWith("\uFEFF"));
  assert.match(
    result.updatedText,
    /gate APPROVAL NOW -> DONE:\r\n  reason \|\r\n    first\r\n    second\r\n$/,
  );
  assert.match(result.diff, /^--- plan\.pert\n\+\+\+ candidate\n@@ /);
  assertValid(result.updatedText);
});

test("gate set edits endpoints and reason locally and normalizes a no-op", () => {
  assertValid(gatePlan);
  const result = planMutation(gatePlan, {
    kind: "gate.set",
    id: "APPROVAL",
    from: "NOW",
    to: "DONE",
    set: { reason: "new\nreason" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.edits.length, 3);
  assert.equal(applyEdits(gatePlan, result.edits), result.updatedText);
  assert.match(
    result.updatedText,
    /# approval ownership\ngate APPROVAL NOW -> DONE:\n  # reason context\n  reason \|\n    new\n    reason\n$/,
  );
  assert.match(result.updatedText, /task ALT_WORK ALT -> DONE:/);
  assertValid(result.updatedText);

  const noOp = planMutation(gatePlan, {
    kind: "gate.set",
    id: "APPROVAL",
    from: "ALT",
    to: "MID",
    set: { reason: "old\nreason" },
  });
  assert.equal(noOp.ok, true);
  assert.equal(noOp.changed, false);
  assert.equal(noOp.diff, "");
  assert.deepEqual(noOp.edits, []);
});

test("gate remove owns no cascade and preserves candidate-validation diagnostics", () => {
  const removed = planMutation(gatePlan, {
    kind: "gate.remove",
    id: "APPROVAL",
  });
  assert.equal(removed.ok, true);
  assert.doesNotMatch(removed.updatedText, /approval ownership|gate APPROVAL/);
  assert.match(removed.updatedText, /milestone ALT:/);
  assert.match(removed.updatedText, /task ALT_WORK ALT -> DONE:/);
  assertValid(removed.updatedText);

  const onlyGate = [
    "project ONLY_GATE:",
    "  title \"only gate\"",
    "  duration_unit day",
    "  finish DONE",
    "",
    "milestone NOW:",
    "  title \"now\"",
    "  state reached",
    "",
    "milestone DONE:",
    "  title \"done\"",
    "",
    "gate REQUIRED NOW -> DONE:",
    "  reason \"required\"",
    "",
  ].join("\n");
  assertValid(onlyGate);
  const rejected = planMutation(onlyGate, {
    kind: "gate.remove",
    id: "REQUIRED",
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.updatedText, null);
  assert.deepEqual(rejected.edits, []);
  assert.ok(rejected.diagnostics.some(({ code }) => code.startsWith("PTDAG-")));
});

test("gate request and target failures use stable mutation diagnostics", () => {
  const cases = [
    {
      mutation: { kind: "gate.set", id: "APPROVAL" },
      code: "PTMUT-301",
    },
    {
      mutation: { kind: "gate.set", id: "MISSING", set: { reason: "x" } },
      code: "PTMUT-302",
    },
    {
      mutation: { kind: "gate.set", id: "FIRST", set: { reason: "x" } },
      code: "PTMUT-303",
    },
    {
      mutation: {
        kind: "gate.add",
        id: "DONE",
        from: "NOW",
        to: "MID",
        gate: { reason: "duplicate" },
      },
      code: "PTMUT-304",
    },
    {
      mutation: {
        kind: "gate.add",
        id: "EXTRA",
        from: "NOW",
        to: "MID",
        gate: { reason: "x", title: "unsupported" },
      },
      code: "PTMUT-301",
    },
  ];
  for (const { mutation, code } of cases) {
    const result = planMutation(gatePlan, mutation);
    assert.equal(result.ok, false);
    assert.equal(result.updatedText, null);
    assert.deepEqual(result.edits, []);
    assert.equal(result.diagnostics.at(-1)?.code, code);
  }
});

test("gate candidate validation rejects undefined endpoints, cycles, and empty reasons", () => {
  const cases = [
    {
      text: linear,
      mutation: {
        kind: "gate.add",
        id: "MISSING_ENDPOINT",
        from: "NOW",
        to: "UNKNOWN",
        gate: { reason: "invalid endpoint" },
      },
      code: "PTSEM-204",
    },
    {
      text: gatePlan,
      mutation: {
        kind: "gate.set",
        id: "APPROVAL",
        from: "DONE",
        to: "MID",
      },
      code: "PTDAG-202",
    },
    {
      text: gatePlan,
      mutation: {
        kind: "gate.set",
        id: "APPROVAL",
        set: { reason: "" },
      },
      code: "PTSEM-106",
    },
  ];
  for (const { text, mutation, code } of cases) {
    const result = planMutation(text, mutation);
    assert.equal(result.ok, false);
    assert.equal(result.updatedText, null);
    assert.deepEqual(result.edits, []);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === code));
  }
});

test("atomic batch creates connected milestones and gates in one candidate", () => {
  const result = planMutation(linear, {
    kind: "batch",
    mutations: [
      { kind: "task.remove", id: "WORK" },
      {
        kind: "milestone.add",
        id: "MID",
        milestone: { title: "middle" },
      },
      {
        kind: "gate.add",
        id: "FIRST_GATE",
        from: "NOW",
        to: "MID",
        gate: { reason: "enter middle" },
      },
      {
        kind: "gate.add",
        id: "SECOND_GATE",
        from: "MID",
        to: "DONE",
        gate: { reason: "enter finish" },
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.match(result.updatedText, /milestone MID:/);
  assert.match(result.updatedText, /gate FIRST_GATE NOW -> MID:/);
  assert.match(result.updatedText, /gate SECOND_GATE MID -> DONE:/);
  assert.doesNotMatch(result.updatedText, /task WORK/);
  assert.equal(applyEdits(linear, result.edits), result.updatedText);
  assertValid(result.updatedText);
});

test("task add appends one canonical declaration and preserves source trivia", () => {
  const input = [
    "\uFEFFproject ADD:",
    "  version 1",
    "  title \"add\"",
    "  duration_unit day",
    "  finish DONE",
    "",
    "milestone NOW:",
    "  title \"now\"",
    "  state reached",
    "",
    "milestone DONE:",
    "  title \"done\"",
    "",
    "task WORK NOW -> DONE:",
    "  title \"work\"",
    "  duration 1d",
    "# trailing standalone",
    "",
  ].join("\r\n");
  assertValid(input);

  const result = planMutation(
    input,
    {
      kind: "task.add",
      id: "EXTRA",
      from: "NOW",
      to: "DONE",
      task: {
        title: "extra",
        description: "first\nsecond",
        duration: "002.00d",
        priority: 5,
        tags: ["fast", "two words"],
      },
    },
    { originalLabel: "plan.pert", updatedLabel: "plan.pert (candidate)" },
  );

  assert.equal(result.ok, true);
  assert.equal(result.documentId, "ADD");
  assert.equal(result.changed, true);
  assert.equal(result.edits.length, 1);
  assert.equal(result.edits[0].startOffset, input.length);
  assert.equal(applyEdits(input, result.edits), result.updatedText);
  assert.ok(result.updatedText.startsWith("\uFEFF"));
  assert.ok(result.updatedText.includes("# trailing standalone\r\n\r\ntask EXTRA NOW -> DONE:\r\n"));
  assert.ok(result.updatedText.includes("  description |\r\n    first\r\n    second\r\n"));
  assert.ok(result.updatedText.includes("  duration 2d\r\n"));
  assert.ok(result.updatedText.includes("  tags [fast, \"two words\"]\r\n"));
  assertValid(result.updatedText);
  assert.match(result.originalDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(result.updatedDigest, /^sha256:[0-9a-f]{64}$/);
  assert.ok(result.diff.startsWith("--- plan.pert\n+++ plan.pert (candidate)\n@@ "));
  assert.equal(
    planMutation(input, {
      kind: "task.add",
      id: "EXTRA",
      from: "NOW",
      to: "DONE",
      task: { title: "extra", duration: "2d" },
    }).originalDigest,
    result.originalDigest,
  );
});

test("task set emits local edits and preserves unrelated fields and comments", () => {
  const input = [
    "project SET_TASK:",
    "  title \"set task\"",
    "  duration_unit day",
    "  finish DONE",
    "",
    "resource DEV:",
    "  title \"developers\"",
    "  capacity 3",
    "",
    "resource QA:",
    "  title \"qa\"",
    "  capacity 2",
    "",
    "milestone NOW:",
    "  title \"now\"",
    "  state reached",
    "",
    "milestone ALT:",
    "  title \"alt\"",
    "  state reached",
    "",
    "milestone DONE:",
    "  title \"done\"",
    "",
    "task KEEP NOW -> DONE:",
    "  title \"keep exactly\"",
    "  duration 1d",
    "",
    "task OTHER ALT -> DONE:",
    "  title \"other exactly\"",
    "  duration 1d",
    "",
    "task WORK NOW -> DONE:",
    "  title \"before 😀\"",
    "  estimate:",
    "    optimistic 1d",
    "    # keep estimate comment",
    "    most_likely 2d",
    "    pessimistic 3d",
    "  priority 1",
    "  requires:",
    "    # keep requirement comment",
    "    DEV 1",
    "  # owner documentation",
    "  owner \"alice\"",
    "  tags [old, keep]",
    "  source \"issue:1\"",
    "",
  ].join("\n");
  const before = assertValid(input);
  const untouched = input.slice(
    input.indexOf("task KEEP"),
    input.indexOf("task OTHER"),
  );

  const result = planMutation(input, {
    kind: "task.set",
    id: "WORK",
    from: "ALT",
    set: {
      title: "after 😀",
      estimate: { optimistic: "1d", mostLikely: "3d", pessimistic: "5d" },
      status: "blocked",
      priority: 7,
      blockedReason: "waiting",
    },
    clear: ["owner"],
    addTags: ["new"],
    removeTags: ["old"],
    upsertRequirements: [
      { resourceId: "DEV", units: 2 },
      { resourceId: "QA", units: 1 },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(applyEdits(input, result.edits), result.updatedText);
  for (let index = 1; index < result.edits.length; index += 1) {
    assert.ok(result.edits[index].startOffset >= result.edits[index - 1].endOffset);
  }
  assert.ok(result.updatedText.includes(untouched));
  assert.ok(result.updatedText.includes("task WORK ALT -> DONE:"));
  assert.ok(result.updatedText.includes("  title \"after 😀\""));
  assert.ok(result.updatedText.includes("    # keep estimate comment\n"));
  assert.ok(result.updatedText.includes("    # keep requirement comment\n    DEV 2\n    QA 1\n"));
  assert.equal(result.updatedText.includes("owner documentation"), false);
  assert.equal(result.updatedText.includes("  owner \"alice\""), false);
  assert.ok(result.updatedText.includes("  tags [keep, new]\n"));
  assert.ok(result.updatedText.includes("  blocked_reason \"waiting\"\n"));

  const after = assertValid(result.updatedText);
  const target = after.document.declarations.find(({ id }) => id === "WORK");
  assert.equal(target.from, "ALT");
  assert.equal(target.fields.find(({ name }) => name === "status").value, "blocked");
  assert.equal(target.fields.find(({ name }) => name === "priority").value, 7);
  assert.deepEqual(target.fields.find(({ name }) => name === "tags").value, ["keep", "new"]);
  assert.deepEqual(
    target.fields.find(({ name }) => name === "requires").value.map(({ resourceId, units }) => [resourceId, units]),
    [["DEV", 2], ["QA", 1]],
  );
  const beforeKeep = before.document.declarations.find(({ id }) => id === "KEEP");
  const afterKeep = after.document.declarations.find(({ id }) => id === "KEEP");
  assert.equal(beforeKeep.fields.find(({ name }) => name === "title").value, afterKeep.fields.find(({ name }) => name === "title").value);
});

test("task finish clears the owned blocked reason and is idempotent", () => {
  const input = linear.replace(
    "  duration 1d\n",
    "  duration 1d\n  status blocked\n  # resolution note\n  blocked_reason \"waiting\"\n",
  );
  assertValid(input);
  const finished = planMutation(input, { kind: "task.finish", id: "WORK" });
  assert.equal(finished.ok, true);
  assert.ok(finished.updatedText.includes("  status done\n"));
  assert.equal(finished.updatedText.includes("blocked_reason"), false);
  assert.equal(finished.updatedText.includes("resolution note"), false);
  assertValid(finished.updatedText);

  const repeated = planMutation(finished.updatedText, { kind: "task.finish", id: "WORK" });
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.edits, []);
  assert.equal(repeated.diff, "");
  assert.equal(repeated.originalDigest, repeated.updatedDigest);
});

test("task set replaces duration and estimate as one timing field", () => {
  const estimated = planMutation(linear, {
    kind: "task.set",
    id: "WORK",
    set: { estimate: { optimistic: "1d", mostLikely: "2d", pessimistic: "4d" } },
  });
  assert.equal(estimated.ok, true);
  assert.equal(estimated.updatedText.includes("  duration 1d"), false);
  assert.ok(estimated.updatedText.includes("  estimate:\n"));
  assertValid(estimated.updatedText);

  const duration = planMutation(estimated.updatedText, {
    kind: "task.set",
    id: "WORK",
    set: { duration: "03.00d" },
  });
  assert.equal(duration.ok, true);
  assert.equal(duration.updatedText.includes("  estimate:"), false);
  assert.ok(duration.updatedText.includes("  duration 3d\n"));
  assertValid(duration.updatedText);
});

test("task remove deletes only the task and its leading comments", () => {
  const input = linear.replace(
    "task WORK NOW -> DONE:\n",
    [
      "task KEEP NOW -> DONE:",
      "  title \"keep\"",
      "  duration 1d",
      "",
      "# remove documentation",
      "task WORK NOW -> DONE:",
      "",
    ].join("\n"),
  );
  assertValid(input);
  const result = planMutation(input, { kind: "task.remove", id: "WORK" });
  assert.equal(result.ok, true);
  assert.equal(result.updatedText.includes("task WORK"), false);
  assert.equal(result.updatedText.includes("remove documentation"), false);
  assert.ok(result.updatedText.includes("task KEEP NOW -> DONE:"));
  assertValid(result.updatedText);
});

test("milestone set emits local field and tag edits without changing edges", () => {
  const before = assertValid(entityPlan);
  const firstTask = entityPlan.slice(entityPlan.indexOf("task FIRST"));
  const result = planMutation(entityPlan, {
    kind: "milestone.set",
    id: "MID",
    set: {
      title: "reviewed",
      description: "first\nsecond",
      state: "planned",
    },
    addTags: ["new"],
    removeTags: ["old"],
  });

  assert.equal(result.ok, true);
  assert.equal(applyEdits(entityPlan, result.edits), result.updatedText);
  assert.ok(result.updatedText.includes("  title \"reviewed\"\n"));
  assert.ok(result.updatedText.includes("  # description context\n  description |\n    first\n    second\n"));
  assert.ok(result.updatedText.includes("  state planned\n  tags [keep, new]\n"));
  assert.ok(result.updatedText.includes(firstTask));
  const after = assertValid(result.updatedText);
  const beforeFirst = before.document.declarations.find(({ id }) => id === "FIRST");
  const afterFirst = after.document.declarations.find(({ id }) => id === "FIRST");
  assert.equal(beforeFirst.from, afterFirst.from);
  assert.equal(beforeFirst.to, afterFirst.to);

  const cleared = planMutation(result.updatedText, {
    kind: "milestone.set",
    id: "MID",
    clear: ["state", "tags"],
  });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.updatedText.includes("  state planned\n"), false);
  assert.equal(cleared.updatedText.includes("  tags [keep, new]\n"), false);
  assertValid(cleared.updatedText);
});

test("resource add set and remove preserve unsupported fields and owned comments", () => {
  const added = planMutation(entityPlan, {
    kind: "resource.add",
    id: "QA",
    resource: { title: "quality", description: "checks", capacity: 3 },
  });
  assert.equal(added.ok, true);
  assert.ok(added.updatedText.endsWith([
    "resource QA:",
    "  title \"quality\"",
    "  description \"checks\"",
    "  capacity 3",
    "",
  ].join("\n")));
  assertValid(added.updatedText);

  const set = planMutation(entityPlan, {
    kind: "resource.set",
    id: "DEV",
    set: { title: "engineering", capacity: 3 },
    clear: ["description"],
  });
  assert.equal(set.ok, true);
  assert.ok(set.updatedText.includes("resource DEV:\n  title \"engineering\"\n  capacity 3\n  tags [preserve]\n"));
  assert.equal(set.updatedText.includes("capacity context"), false);
  assertValid(set.updatedText);

  const removed = planMutation(entityPlan, { kind: "resource.remove", id: "UNUSED" });
  assert.equal(removed.ok, true);
  assert.equal(removed.updatedText.includes("resource UNUSED"), false);
  assert.equal(removed.updatedText.includes("unused resource documentation"), false);
  assertValid(removed.updatedText);
});

test("batch adds a connected milestone and removes a path without invalid intermediate states", () => {
  const added = planMutation(entityPlan, {
    kind: "batch",
    mutations: [
      {
        kind: "milestone.add",
        id: "EXTRA",
        milestone: { title: "extra", tags: ["batch"] },
      },
      {
        kind: "task.add",
        id: "EXTRA_IN",
        from: "NOW",
        to: "EXTRA",
        task: { title: "enter extra", duration: "1d" },
      },
      {
        kind: "task.add",
        id: "EXTRA_OUT",
        from: "EXTRA",
        to: "DONE",
        task: { title: "leave extra", duration: "1d" },
      },
    ],
  });
  assert.equal(added.ok, true);
  assert.equal(added.edits.length, 1);
  assert.ok(added.updatedText.indexOf("milestone EXTRA:") < added.updatedText.indexOf("task EXTRA_IN"));
  assert.ok(added.updatedText.indexOf("task EXTRA_IN") < added.updatedText.indexOf("task EXTRA_OUT"));
  assertValid(added.updatedText);

  const replaced = planMutation(entityPlan, {
    kind: "batch",
    mutations: [
      { kind: "task.remove", id: "FIRST" },
      { kind: "task.remove", id: "SECOND" },
      { kind: "milestone.remove", id: "MID" },
      {
        kind: "task.add",
        id: "DIRECT",
        from: "NOW",
        to: "DONE",
        task: { title: "direct", duration: "1d" },
      },
    ],
  });
  assert.equal(replaced.ok, true);
  assert.equal(replaced.updatedText.includes("milestone MID"), false);
  assert.equal(replaced.updatedText.includes("task FIRST"), false);
  assert.equal(replaced.updatedText.includes("task SECOND"), false);
  assert.ok(replaced.updatedText.includes("task DIRECT NOW -> DONE:"));
  assertValid(replaced.updatedText);

  const resourceAndRequirement = planMutation(entityPlan, {
    kind: "batch",
    mutations: [
      {
        kind: "resource.add",
        id: "QA",
        resource: { title: "quality", capacity: 1 },
      },
      {
        kind: "task.set",
        id: "SECOND",
        upsertRequirements: [{ resourceId: "QA", units: 1 }],
      },
    ],
  });
  assert.equal(resourceAndRequirement.ok, true);
  assert.ok(resourceAndRequirement.updatedText.includes("resource QA:"));
  assert.ok(resourceAndRequirement.updatedText.includes("task SECOND MID -> DONE:\n  title \"second\"\n  duration 1d\n  requires:\n    QA 1\n"));
  assertValid(resourceAndRequirement.updatedText);
});

test("entity mutation rejects unsafe standalone changes and malformed requests", () => {
  for (const [mutation, code] of [
    [{ kind: "milestone.set", id: "MID" }, "PTMUT-301"],
    [{ kind: "milestone.set", id: "MISSING", set: { title: "x" } }, "PTMUT-302"],
    [{ kind: "milestone.remove", id: "DEV" }, "PTMUT-303"],
    [{ kind: "milestone.add", id: "MID", milestone: { title: "x" } }, "PTMUT-304"],
    [{ kind: "resource.set", id: "DEV" }, "PTMUT-301"],
    [{ kind: "resource.set", id: "MISSING", set: { capacity: 2 } }, "PTMUT-302"],
    [{ kind: "resource.remove", id: "MID" }, "PTMUT-303"],
    [{ kind: "resource.add", id: "DEV", resource: { title: "x", capacity: 1 } }, "PTMUT-304"],
    [{ kind: "batch", mutations: [] }, "PTMUT-301"],
    [{ kind: "batch", mutations: [
      { kind: "resource.set", id: "DEV", set: { capacity: 3 } },
      { kind: "resource.set", id: "DEV", set: { title: "duplicate" } },
    ] }, "PTMUT-301"],
  ]) {
    const result = planMutation(entityPlan, mutation);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some(({ code: actual }) => actual === code));
    assert.equal(result.updatedText, null);
    assert.deepEqual(result.edits, []);
  }

  for (const mutation of [
    { kind: "milestone.add", id: "ISOLATED", milestone: { title: "isolated" } },
    { kind: "milestone.remove", id: "MID" },
    { kind: "resource.remove", id: "DEV" },
    { kind: "resource.set", id: "DEV", set: { capacity: 1 } },
  ]) {
    const result = planMutation(entityPlan, mutation);
    assert.equal(result.ok, false);
    assert.equal(result.updatedText, null);
    assert.deepEqual(result.edits, []);
    assert.ok(result.diagnostics.some(({ severity }) => severity === "error"));
  }
});

test("task mutation rejects request, target, original, and candidate errors", () => {
  for (const [mutation, code] of [
    [null, "PTMUT-301"],
    [{ kind: "task.unknown", id: "WORK" }, "PTMUT-301"],
    [{ kind: "task.finish", id: 42 }, "PTMUT-301"],
    [{ kind: "task.set", id: "WORK" }, "PTMUT-301"],
    [{ kind: "task.set", id: "WORK", clear: "owner" }, "PTMUT-301"],
    [{ kind: "task.set", id: "WORK", set: { duration: "1d", estimate: {} } }, "PTMUT-301"],
    [{ kind: "task.add", id: "BAD", from: "NOW", to: "DONE", task: { title: "x", estimate: {} } }, "PTMUT-301"],
    [{ kind: "task.add", id: "BAD", from: "NOW", to: "DONE", task: { title: "x", duration: "1d", typo: true } }, "PTMUT-301"],
    [{ kind: "task.finish", id: "WORK", extra: true }, "PTMUT-301"],
    [{ kind: "task.finish", id: "MISSING" }, "PTMUT-302"],
    [{ kind: "task.finish", id: "NOW" }, "PTMUT-303"],
    [{ kind: "task.add", id: "WORK", from: "NOW", to: "DONE", task: { title: "x", duration: "1d" } }, "PTMUT-304"],
  ]) {
    const result = planMutation(linear, mutation);
    assert.equal(result.ok, false);
    assert.equal(result.updatedText, null);
    assert.equal(result.diff, null);
    assert.deepEqual(result.edits, []);
    assert.ok(result.diagnostics.some(({ code: actual }) => actual === code));
  }

  const invalidOriginal = planMutation(
    `project INVALID:\n  title \"invalid\"\n  duration_unit day\n  finish MISSING\n`,
    { kind: "task.finish", id: "WORK" },
  );
  assert.equal(invalidOriginal.ok, false);
  assert.ok(invalidOriginal.diagnostics.some(({ code }) => code === "PTSEM-203"));
  assert.deepEqual(invalidOriginal.edits, []);

  const invalidCandidate = planMutation(linear, {
    kind: "task.set",
    id: "WORK",
    set: { status: "blocked" },
  });
  assert.equal(invalidCandidate.ok, false);
  assert.ok(invalidCandidate.diagnostics.some(({ code }) => code === "PTSEM-103"));
  assert.equal(invalidCandidate.updatedText, null);
  assert.deepEqual(invalidCandidate.edits, []);

  const unsafeRemove = planMutation(linear, { kind: "task.remove", id: "WORK" });
  assert.equal(unsafeRemove.ok, false);
  assert.ok(unsafeRemove.diagnostics.some(({ code }) => code === "PTDAG-204"));
  assert.deepEqual(unsafeRemove.edits, []);
});
