import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import * as perttool from "../dist/index.js";
import {
  planTargetLifecycleMutation,
} from "../dist/application/target-actuals-mutation.js";
import {
  createDocumentSnapshot,
  documentOffsetToPosition,
} from "../dist/core/index.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../dist/parser/document-parser.js";
import { definition } from "../adapters/lsp/dist/projection.js";

const source = [
  "project DECLARATION_IDENTITY:",
  "  version 5",
  '  title "Declaration identity"',
  "  as_of 2026-08-06",
  "  duration_unit point",
  "  velocity 1p/1d",
  "  finish DONE",
  "",
  "milestone NOW:",
  '  title "Now"',
  "  state reached",
  "",
  "milestone MID:",
  '  title "Middle"',
  "",
  "milestone DONE:",
  '  title "Done"',
  "",
  "task BASE NOW -> MID:",
  '  title "Completed basis"',
  "  duration 1p",
  "  status done",
  "",
  "task KEEP MID -> DONE:",
  '  title "Existing future task"',
  "  duration 1p",
  "",
].join("\n");

function block(text, kind, id) {
  const parsed = perttool.parseDocument(text);
  const index = parsed.document.declarations.findIndex(
    (declaration) => declaration.kind === kind && declaration.id === id,
  );
  assert.notEqual(index, -1, `${kind} ${id}`);
  const declaration = parsed.document.declarations[index];
  const next = parsed.document.declarations[index + 1];
  return text.slice(
    declaration.headerSpan.start.offset,
    next?.headerSpan.start.offset ?? text.length,
  );
}

function moveTaskToEnd(text, taskId) {
  const parsed = perttool.parseDocument(text);
  const index = parsed.document.declarations.findIndex(
    ({ kind, id }) => kind === "task" && id === taskId,
  );
  assert.notEqual(index, -1);
  const declaration = parsed.document.declarations[index];
  const next = parsed.document.declarations[index + 1];
  assert.ok(next);
  const start = declaration.headerSpan.start.offset;
  const end = next.headerSpan.start.offset;
  return `${text.slice(0, start)}${text.slice(end)}${text.slice(start, end)}`;
}

function sealedSourceWithOutcome() {
  const sealed = perttool.planAssuranceMutation(source, {
    kind: "plan_assurance.seal",
    reason: "Initial declaration identity baseline",
  });
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  const outcome = perttool.planAssuranceMutation(sealed.updatedText, {
    kind: "task_outcome.add",
    id: "OUT_BASE",
    taskId: "BASE",
    status: "conformant",
    reason: "Completed basis accepted",
  });
  assert.equal(outcome.ok, true, JSON.stringify(outcome.diagnostics));
  return outcome.updatedText;
}

function addAndSealNewTask() {
  const added = perttool.planMutation(sealedSourceWithOutcome(), {
    kind: "task.add",
    id: "NEW",
    from: "MID",
    to: "DONE",
    task: {
      title: "New task",
      duration: "1p",
    },
  });
  assert.equal(added.ok, true, JSON.stringify(added.diagnostics));
  const sealed = perttool.planAssuranceMutation(added.updatedText, {
    kind: "plan_assurance.seal",
    reason: "Accept new task",
  });
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  return sealed.updatedText;
}

test("task.add inserts before assurance and actual declarations", () => {
  const original = sealedSourceWithOutcome();
  const added = perttool.planMutation(original, {
    kind: "task.add",
    id: "NEW",
    from: "MID",
    to: "DONE",
    task: { title: "New task", duration: "1p" },
  });
  assert.equal(added.ok, true, JSON.stringify(added.diagnostics));
  const taskOffset = added.updatedText.indexOf("task NEW ");
  const firstSealOffset = added.updatedText.indexOf("plan_seal ");
  const outcomeOffset = added.updatedText.indexOf("task_outcome ");
  assert.ok(taskOffset > 0);
  assert.ok(taskOffset < firstSealOffset);
  assert.ok(firstSealOffset < outcomeOffset);
  assert.equal(block(added.updatedText, "plan_seal", "BASE"), block(original, "plan_seal", "BASE"));
  assert.equal(block(added.updatedText, "task_outcome", "OUT_BASE"), block(original, "task_outcome", "OUT_BASE"));
});

test("task mutation and lifecycle resolve task identity independent of seal order", () => {
  const canonical = addAndSealNewTask();
  const noncanonical = moveTaskToEnd(canonical, "NEW");
  assert.equal(perttool.checkDocument(noncanonical).ok, true);
  assert.ok(noncanonical.indexOf("plan_seal NEW:") < noncanonical.indexOf("task NEW "));
  const originalSeal = block(noncanonical, "plan_seal", "NEW");

  const changed = perttool.planMutation(noncanonical, {
    kind: "task.set",
    id: "NEW",
    set: { title: "Updated task" },
  });
  assert.equal(changed.ok, true, JSON.stringify(changed.diagnostics));
  assert.match(block(changed.updatedText, "task", "NEW"), /title "Updated task"/);
  assert.equal(block(changed.updatedText, "plan_seal", "NEW"), originalSeal);

  const started = planTargetLifecycleMutation(
    noncanonical,
    {
      kind: "task.start",
      taskId: "NEW",
      event: { occurredAt: "2026-08-06T13:00:00+09:00" },
    },
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(started.ok, true, JSON.stringify(started.diagnostics));
  assert.match(block(started.updatedText, "task", "NEW"), /status active/);
  assert.equal(block(started.updatedText, "plan_seal", "NEW"), originalSeal);
});

test("LSP definition prefers the task over its same-ID plan seal", () => {
  const text = moveTaskToEnd(addAndSealNewTask(), "NEW");
  const snapshot = createDocumentSnapshot(
    {
      uri: "file:///declaration-identity.pert",
      generation: "declaration-identity",
      version: 1,
      text,
    },
    {
      maxDiagnostics: 100,
      digestText: (value) =>
        `sha256:${createHash("sha256").update(value).digest("hex")}`,
    },
  );
  assert.equal(snapshot.semantic.ok, true);
  const task = snapshot.parse.document.declarations.find(
    ({ kind, id }) => kind === "task" && id === "NEW",
  );
  const seal = snapshot.parse.document.declarations.find(
    ({ kind, id }) => kind === "plan_seal" && id === "NEW",
  );
  assert.ok(task);
  assert.ok(seal);
  const position = documentOffsetToPosition(text, task.idSpan.start.offset);
  assert.ok(position);
  const location = definition(snapshot, position);
  assert.ok(location);
  assert.deepEqual(location.range.start, {
    line: task.idSpan.start.line,
    character: task.idSpan.start.column,
  });
  assert.notDeepEqual(location.range.start, {
    line: seal.idSpan.start.line,
    character: seal.idSpan.start.column,
  });
});
