import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  inspectTargetPlanAssurance,
  PLAN_ASSURANCE_INSPECTION_CLI_CONTRACT_VERSION,
  PLAN_ASSURANCE_RESULT_SCHEMA_VERSION,
  renderTargetPlanAssuranceInspectionText,
  serializeTargetPlanAssuranceInspectionResult,
  targetPlanAssuranceInspectionResultToJson,
} from "../dist/application/target-assurance-inspection.js";
import {
  planTargetPlanAssuranceMutation,
} from "../dist/assurance/mutation.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../dist/parser/document-parser.js";

const vectors = {
  contractA:
    "sha256:e35fe89aabf48b47a19c513e63a7782591e8bf098f79a6b3ad789f905ef3cf2d",
  basisA:
    "sha256:3923becd976daeca7047a65206633ed3b8210b426f1bf969107728f5261cd489",
  contractB:
    "sha256:ccafd4ffb6985b1d11cbb4c91a40e1d634027f73bab5e195d2d63e1179f1aacf",
  basisB:
    "sha256:17d1c255bdf3d1f913eb12264c16d64b1abaae4d17e88a224229f550a0830fb9",
};

function source() {
  return [
    "project INSPECT:",
    "  version 6",
    '  title "Hash inspection"',
    "  duration_unit day",
    "  finish M2",
    "",
    "milestone M0:",
    '  title "start"',
    "  state reached",
    "",
    "milestone M1:",
    '  title "middle"',
    "",
    "milestone M2:",
    '  title "finish"',
    "",
    "task A M0 -> M1:",
    '  title "A"',
    "  duration 1d",
    "  status planned",
    "",
    "task B M1 -> M2:",
    '  title "B"',
    "  duration 1d",
    "  status planned",
    "",
  ].join("\n");
}

function sealedSource() {
  const sealed = planTargetPlanAssuranceMutation(
    source(),
    {
      kind: "plan_assurance.seal",
      reason: "accepted inspection baseline",
    },
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  return sealed.updatedText;
}

function inspect(text, request, options = {}) {
  return inspectTargetPlanAssurance(
    text,
    request,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
}

test("inspection remains internal with the fixed Contract 7 result identity", () => {
  assert.equal(
    PLAN_ASSURANCE_RESULT_SCHEMA_VERSION,
    "Perttool.PlanAssuranceResult.v1",
  );
  assert.equal(PLAN_ASSURANCE_INSPECTION_CLI_CONTRACT_VERSION, 7);
  for (const name of [
    "inspectTargetPlanAssurance",
    "renderTargetPlanAssuranceInspectionText",
    "PLAN_ASSURANCE_RESULT_SCHEMA_VERSION",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
});

test("unfiltered show returns the complete source-bound projection", () => {
  const text = sealedSource();
  const result = inspect(text, { operation: "plan-assurance.show" });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.schemaVersion, "Perttool.PlanAssuranceResult.v1");
  assert.equal(result.cliContractVersion, 7);
  assert.equal(result.documentId, "INSPECT");
  assert.equal(result.grammarVersion, 6);
  assert.deepEqual(result.selectedTaskIds, ["A", "B"]);
  assert.deepEqual(
    result.assurance.taskResults.map(({ taskId }) => taskId),
    ["A", "B"],
  );
  assert.equal(result.assurance.coverage, "complete");
  assert.equal(result.taskId, null);
  assert.equal(result.kind, null);
  assert.equal(result.selectedHash, null);
  assert.match(renderTargetPlanAssuranceInspectionText(result), /^PLAN_ASSURANCE /);
});

test("filtered show deduplicates options and retains evaluator order", () => {
  const result = inspect(sealedSource(), {
    operation: "plan-assurance.show",
    taskIds: ["B", "B", "A"],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.selectedTaskIds, ["A", "B"]);
  assert.deepEqual(
    result.assurance.taskResults.map(({ taskId }) => taskId),
    ["A", "B"],
  );

  const onlyB = inspect(sealedSource(), {
    operation: "plan-assurance.show",
    taskIds: ["B"],
  });
  assert.equal(onlyB.assurance.coverage, "complete");
  assert.deepEqual(onlyB.selectedTaskIds, ["B"]);
  assert.deepEqual(
    onlyB.assurance.taskResults.map(({ taskId }) => taskId),
    ["B"],
  );
  assert.equal(onlyB.assurance.taskResults[0].computedInputs[0].predecessorTaskId, "A");
});

test("task-filtered show keeps causes entering the selected task", () => {
  const changed = planTargetPlanAssuranceMutation(
    sealedSource(),
    {
      kind: "batch",
      mutations: [
        { kind: "task.set", id: "A", set: { title: "A changed" } },
        {
          kind: "plan_dependency.add",
          id: "REL_A_B",
          predecessorTaskId: "A",
          successorTaskId: "B",
          mode: "both",
        },
      ],
    },
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(changed.ok, true, JSON.stringify(changed.diagnostics));
  const result = inspect(changed.updatedText, {
    operation: "plan-assurance.show",
    taskIds: ["B"],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.assurance.replanRequiredTaskIds, ["B"]);
  assert.deepEqual(
    result.assurance.taskResults[0].inheritedCauses.map(({ rootTaskId }) =>
      rootTaskId
    ),
    ["A"],
  );
  assert.deepEqual(result.assurance.requiredActions, [{
    kind: "replan_and_reseal",
    rootTaskIds: ["A"],
    affectedTaskIds: ["B"],
  }]);
  assert.ok(result.diagnostics.some(({ code }) => code === "PTASSURE-202"));
});

test("unknown show selection fails atomically without a partial projection", () => {
  const result = inspect(sealedSource(), {
    operation: "plan-assurance.show",
    taskIds: ["A", "MISSING"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.assurance, null);
  assert.equal(result.selectedHash, null);
  assert.deepEqual(
    result.diagnostics.filter(({ code }) => code === "PTASSURE-302")
      .map(({ entityId }) => entityId),
    ["MISSING"],
  );
  assert.equal(renderTargetPlanAssuranceInspectionText(result), "");

  const limited = inspect(sealedSource(), {
    operation: "plan-assurance.show",
    taskIds: ["MISSING"],
  }, { maxDiagnostics: 1 });
  assert.equal(limited.diagnostics.length, 1);
  assert.equal(limited.diagnostics[0].code, "PTASSURE-302");
});

test("pinpoint hash selects all three values from the shared evaluator", () => {
  const text = sealedSource();
  const cases = [
    ["A", "contract", vectors.contractA],
    ["A", "computed-basis", vectors.basisA],
    ["A", "exported", vectors.basisA],
    ["B", "contract", vectors.contractB],
    ["B", "computed-basis", vectors.basisB],
    ["B", "exported", vectors.basisB],
  ];
  for (const [taskId, kind, expected] of cases) {
    const result = inspect(text, {
      operation: "plan-assurance.hash",
      taskId,
      kind,
    });
    assert.equal(result.ok, true, `${taskId}:${kind}`);
    assert.equal(result.selectedHash, expected, `${taskId}:${kind}`);
    assert.equal(
      renderTargetPlanAssuranceInspectionText(result),
      `${expected}\n`,
    );
    assert.match(
      renderTargetPlanAssuranceInspectionText(result),
      /^sha256:[0-9a-f]{64}\n$/,
    );
    assert.deepEqual(result.selectedTaskIds, [taskId]);
    assert.deepEqual(
      result.assurance.taskResults.map(({ taskId: id }) => id),
      [taskId],
    );
  }
});

test("semantic hashes ignore source trivia while retaining raw source identity", () => {
  const firstText = sealedSource();
  const secondText = `\uFEFF${firstText}`
    .replace("  version 6", "  version 0006")
    .replaceAll("\n", "\r\n");
  const request = {
    operation: "plan-assurance.hash",
    taskId: "B",
    kind: "computed-basis",
  };
  const first = inspect(firstText, request);
  const second = inspect(secondText, request);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.selectedHash, first.selectedHash);
  assert.notEqual(second.sourceDigest, first.sourceDigest);
});

test("an unavailable selected hash returns PTASSURE-203 and no text digest", () => {
  const completed = planTargetPlanAssuranceMutation(
    sealedSource(),
    {
      kind: "batch",
      mutations: [
        { kind: "task.set", id: "A", set: { status: "done" } },
        {
          kind: "plan_dependency.add",
          id: "REL_A_B",
          predecessorTaskId: "A",
          successorTaskId: "B",
          mode: "both",
        },
      ],
    },
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(completed.ok, true, JSON.stringify(completed.diagnostics));
  const exported = inspect(completed.updatedText, {
    operation: "plan-assurance.hash",
    taskId: "A",
    kind: "exported",
  });
  assert.equal(exported.ok, false);
  assert.equal(exported.selectedHash, null);
  assert.equal(renderTargetPlanAssuranceInspectionText(exported), "");
  assert.equal(
    exported.diagnostics.filter(({ code }) => code === "PTASSURE-203").length,
    1,
  );
  assert.equal(
    exported.diagnostics.find(({ code }) => code === "PTASSURE-203").severity,
    "error",
  );

  const limited = inspect(completed.updatedText, {
    operation: "plan-assurance.hash",
    taskId: "A",
    kind: "exported",
  }, { maxDiagnostics: 1 });
  assert.equal(limited.diagnostics.length, 1);
  assert.equal(limited.diagnostics[0].code, "PTASSURE-203");
  assert.equal(limited.diagnostics[0].severity, "error");

  const computed = inspect(completed.updatedText, {
    operation: "plan-assurance.hash",
    taskId: "A",
    kind: "computed-basis",
  });
  assert.equal(computed.ok, true);
  assert.equal(computed.selectedHash, vectors.basisA);
});

test("JSON output is closed, source-bound, and byte deterministic", () => {
  const result = inspect(sealedSource(), {
    operation: "plan-assurance.hash",
    taskId: "B",
    kind: "computed-basis",
  });
  const json = targetPlanAssuranceInspectionResultToJson(result, "plan.pert");
  assert.deepEqual(Object.keys(json), [
    "schema_version",
    "cli_contract_version",
    "tool_version",
    "operation",
    "ok",
    "document_id",
    "source",
    "source_digest",
    "diagnostics",
    "diagnostics_truncated",
    "grammar_version",
    "selected_task_ids",
    "task_id",
    "kind",
    "selected_hash",
    "assurance",
  ]);
  assert.equal(json.operation, "plan-assurance.hash");
  assert.equal(json.source, "plan.pert");
  assert.equal(json.task_id, "B");
  assert.equal(json.kind, "computed-basis");
  assert.equal(json.selected_hash, vectors.basisB);
  assert.deepEqual(
    json.assurance.task_results.map(({ task_id }) => task_id),
    ["B"],
  );
  assert.equal(
    serializeTargetPlanAssuranceInspectionResult(result, "plan.pert"),
    `${JSON.stringify(json)}\n`,
  );
});

test("invalid Grammar 6 input returns no projection or text", () => {
  const result = inspect(
    source().replace("  duration 1d", "  duration invalid"),
    { operation: "plan-assurance.hash", taskId: "A", kind: "contract" },
  );
  assert.equal(result.ok, false);
  assert.equal(result.assurance, null);
  assert.equal(result.selectedHash, null);
  assert.equal(renderTargetPlanAssuranceInspectionText(result), "");
  assert.ok(result.diagnostics.some(({ severity }) => severity === "error"));
});

test("invalid normalized inspection requests fail before evaluation", () => {
  assert.throws(
    () => inspect(sealedSource(), {
      operation: "plan-assurance.hash",
      taskId: "A",
      kind: "raw-bytes",
    }),
    /hash kind must be contract, computed-basis, or exported/,
  );
  assert.throws(
    () => inspect(sealedSource(), {
      operation: "plan-assurance.show",
      taskIds: [""],
    }),
    /show taskIds must contain nonempty task IDs/,
  );
});
