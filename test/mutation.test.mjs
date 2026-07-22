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
