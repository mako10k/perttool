import assert from "node:assert/strict";
import test from "node:test";
import {
  planTargetGovernanceAdvance,
  planTargetGovernanceBatchMutation,
  planTargetGovernanceMutation,
} from "../dist/application/target-governance-mutation.js";
import {
  renderTargetGovernanceDecision,
  renderTargetGovernanceProjectText,
  targetGovernanceMutationResultToJson,
  targetGovernanceProjectResultToJson,
} from "../dist/application/target-governance-projection.js";
import {
  getTargetGovernanceProjectMetadata,
} from "../dist/application/target-governance-project.js";
import { digestDocumentBytes } from "../dist/io/document-file.js";
import {
  TARGET_GRAMMAR_4_CAPABILITY,
} from "../dist/parser/document-parser.js";

function source({
  goalOwner = "user",
  goalDelegates = "[zeta, alpha]",
  dagOwner = "llm",
  dagDelegates = "[codex]",
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
    `  goal_owner ${goalOwner}`,
    `  goal_delegates ${goalDelegates}`,
    `  dag_owner ${dagOwner}`,
    `  dag_delegates ${dagDelegates}`,
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

function legacySource() {
  return [
    "project LEGACY:",
    "  version 1",
    '  title "legacy"',
    "  duration_unit point",
    "  finish FINISH",
    "",
    "milestone START:",
    '  title "start"',
    "  state reached",
    "",
    "milestone FINISH:",
    '  title "finish"',
    "",
    "task BASE START -> FINISH:",
    '  title "base"',
    "  duration 1p",
    "",
  ].join("\n");
}

test("governed preview retains a valid candidate and reports missing authority", () => {
  const result = planTargetGovernanceMutation(
    source(),
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(result.schemaVersion, "Perttool.MutationResult.v2");
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.match(result.updatedText, /goal_owner admin/);
  assert.equal(result.governance.intent, "preview");
  assert.equal(result.governance.applicable, true);
  assert.equal(result.governance.actor, null);
  assert.deepEqual(result.governance.affectedScopes, ["goal"]);
  assert.deepEqual(result.governance.requiredOwnerConfirmations, ["user"]);
  assert.equal(result.governance.writeAuthorized, false);
  assert.equal(result.governance.scopes[0].denialCause, "actor_required");
  assert.equal(
    result.diagnostics.some(({ code }) => code === "PTGOV-101"),
    false,
  );
});

test("persistent denial retains the candidate and one PTGOV-101 decision", () => {
  const result = planTargetGovernanceMutation(
    source(),
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        actor: "codex",
      },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.changed, true);
  assert.match(result.updatedText, /goal_owner admin/);
  assert.equal(result.governance.writeAuthorized, false);
  assert.equal(
    result.governance.scopes[0].denialCause,
    "owner_confirmation_required",
  );
  assert.deepEqual(
    result.diagnostics.map(({ code }) => code),
    ["PTGOV-101"],
  );

  const json = targetGovernanceMutationResultToJson(
    result,
    "project.set",
    "plan.pert",
    { mode: "in_place", target: "plan.pert", written: true },
  );
  assert.equal(json.ok, false);
  assert.match(json.updated_text, /goal_owner admin/);
  assert.equal(json.write.written, false);
  assert.equal(json.governance.write_authorized, false);
  assert.equal(json.diagnostics[0].code, "PTGOV-101");
});

test("pre-governance source upgrades atomically but cannot self-authorize", () => {
  const preview = planTargetGovernanceMutation(
    legacySource(),
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(preview.ok, true);
  assert.match(preview.updatedText, /  version 4/);
  assert.match(preview.updatedText, /  goal_owner admin/);
  assert.deepEqual(preview.governance.affectedScopes, ["goal"]);
  assert.deepEqual(preview.governance.requiredOwnerConfirmations, ["user"]);

  const selfAuthorized = planTargetGovernanceMutation(
    legacySource(),
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        actor: "admin",
      },
    },
  );
  assert.equal(selfAuthorized.ok, false);
  assert.equal(selfAuthorized.governance.scopes[0].requiredOwner, "user");
  assert.equal(
    selfAuthorized.governance.scopes[0].denialCause,
    "owner_confirmation_required",
  );
});

test("owner confirmation and direct delegate authority compose across one batch", () => {
  const batch = {
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
  };
  const result = planTargetGovernanceBatchMutation(
    source(),
    batch,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        actor: "codex",
        acceptedByOwner: ["user"],
      },
    },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.governance.affectedScopes, ["goal", "dag"]);
  assert.deepEqual(result.governance.requiredOwnerConfirmations, ["user"]);
  assert.deepEqual(
    result.governance.scopes.map(
      ({ scope, actorDirect, scopeAuthorized }) => [
        scope,
        actorDirect,
        scopeAuthorized,
      ],
    ),
    [
      ["goal", false, true],
      ["dag", true, true],
    ],
  );
  assert.equal(result.governance.writeAuthorized, true);

  const preview = planTargetGovernanceBatchMutation(
    source(),
    batch,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "preview",
        actor: "codex",
        acceptedByOwner: ["user"],
      },
    },
  );
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.diagnostics.map(({ code }) => code), ["PTGOV-104"]);
});

test("ordinary persistent maintenance remains applicable=false without actor", () => {
  const result = planTargetGovernanceMutation(
    source(),
    {
      kind: "project.set",
      set: { title: "renamed" },
    },
    TARGET_GRAMMAR_4_CAPABILITY,
    { governance: { intent: "persist" } },
  );
  assert.equal(result.ok, true);
  assert.equal(result.governance.applicable, false);
  assert.deepEqual(result.governance.affectedScopes, []);
  assert.equal(result.governance.ownerConfirmationRequired, false);
  assert.equal(result.governance.writeAuthorized, true);
  assert.equal(renderTargetGovernanceDecision(result.governance), "");
});

test("ordinary maintenance with an owner assertion emits PTGOV-103", () => {
  const result = planTargetGovernanceMutation(
    source(),
    {
      kind: "project.set",
      set: { title: "renamed" },
    },
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        acceptedByOwner: ["user"],
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.governance.applicable, false);
  assert.equal(result.governance.writeAuthorized, true);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["PTGOV-103"]);
  assert.equal(
    result.diagnostics[0].data.cause,
    "owner_confirmation_not_applicable",
  );

  const json = targetGovernanceMutationResultToJson(
    result,
    "project.set",
    "plan.pert",
  );
  assert.equal(json.ok, true);
  assert.deepEqual(json.governance.accepted_by_owner, ["user"]);
  assert.equal(json.diagnostics[0].severity, "warning");
});

test("governed preview with an owner assertion emits PTGOV-104", () => {
  const result = planTargetGovernanceMutation(
    source(),
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "preview",
        actor: "codex",
        acceptedByOwner: ["user"],
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.governance.applicable, true);
  assert.equal(result.governance.writeAuthorized, true);
  assert.deepEqual(result.governance.affectedScopes, ["goal"]);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["PTGOV-104"]);
  assert.equal(
    result.diagnostics[0].data.cause,
    "owner_confirmation_on_governed_preview",
  );

  const persistent = planTargetGovernanceMutation(
    source(),
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        actor: "codex",
        acceptedByOwner: ["user"],
      },
    },
  );
  assert.equal(persistent.ok, true);
  assert.deepEqual(persistent.diagnostics, []);
});

test("invalid governance request returns PTGOV-102 without a candidate", () => {
  const result = planTargetGovernanceMutation(
    source(),
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        acceptedByOwner: ["user", "user"],
      },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.changed, false);
  assert.equal(result.updatedDigest, null);
  assert.equal(result.updatedText, null);
  assert.deepEqual(result.edits, []);
  assert.equal(result.governance, null);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "PTGOV-102");
  assert.equal(
    result.diagnostics[0].data.cause,
    "duplicate_accepted_by_owner",
  );
});

test("advance uses the same actual-change classifier on Grammar 4", () => {
  const text = source({
    includeBase: false,
    work: [
      "task WORK START -> FINISH:",
      '  title "work"',
      "  duration 1p",
      "  status done",
      "",
    ],
  });
  const preview = planTargetGovernanceAdvance(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.advance.removedTaskIds, ["WORK"]);
  assert.deepEqual(preview.governance.affectedScopes, ["dag"]);
  assert.equal(preview.governance.writeAuthorized, false);

  const assertedPreview = planTargetGovernanceAdvance(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "preview",
        actor: "codex",
        acceptedByOwner: ["llm"],
      },
    },
  );
  assert.equal(assertedPreview.ok, true);
  assert.equal(assertedPreview.governance.writeAuthorized, true);
  assert.deepEqual(
    assertedPreview.diagnostics.map(({ code }) => code),
    ["PTGOV-104"],
  );

  const delegated = planTargetGovernanceAdvance(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        intent: "persist",
        actor: "codex",
      },
    },
  );
  assert.equal(delegated.ok, true);
  assert.equal(delegated.governance.scopes[0].actorDirect, true);
  assert.equal(delegated.governance.writeAuthorized, true);
  const json = targetGovernanceMutationResultToJson(
    delegated,
    "dag.advance",
    "plan.pert",
  );
  assert.equal(json.schema_version, "Perttool.MutationResult.v2");
  assert.deepEqual(json.advance.removed_task_ids, ["WORK"]);
});

test("ProjectResult v3 and text distinguish declared order from effective order", () => {
  const text = source();
  const result = getTargetGovernanceProjectMetadata(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(result.ok, true);
  const digest = digestDocumentBytes(Buffer.from(text));
  const json = targetGovernanceProjectResultToJson(
    result,
    "plan.pert",
    digest,
  );
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
    "project",
  ]);
  assert.equal(json.schema_version, "Perttool.ProjectResult.v3");
  assert.equal(json.cli_contract_version, 5);
  assert.deepEqual(
    json.project.governance.declared.goal_delegates,
    ["zeta", "alpha"],
  );
  assert.deepEqual(
    json.project.governance.effective.goal_delegates,
    ["alpha", "zeta"],
  );

  const rendered = renderTargetGovernanceProjectText(result.project);
  const governanceLines = rendered
    .split("\n")
    .filter((line) => /^(?:GOAL|DAG)_/.test(line));
  assert.deepEqual(governanceLines, [
    "GOAL_OWNER declared=user effective=user",
    "GOAL_DELEGATES declared=[zeta, alpha] effective=[alpha, zeta]",
    "DAG_OWNER declared=llm effective=llm",
    "DAG_DELEGATES declared=[codex] effective=[codex]",
  ]);
  assert.ok(
    rendered.indexOf("FINISH_DEADLINE") <
      rendered.indexOf("GOAL_OWNER"),
  );
  assert.ok(
    rendered.indexOf("DAG_DELEGATES") <
      rendered.indexOf("CRITICAL_EPSILON"),
  );
});

test("ProjectResult v3 projects effective defaults for Grammar 1", () => {
  const text = legacySource();
  const result = getTargetGovernanceProjectMetadata(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(result.ok, true);
  const json = targetGovernanceProjectResultToJson(
    result,
    "legacy.pert",
    digestDocumentBytes(Buffer.from(text)),
  );
  assert.deepEqual(json.project.governance, {
    source_contract_version: 1,
    declared: {
      goal_owner: null,
      goal_delegates: null,
      dag_owner: null,
      dag_delegates: null,
    },
    effective: {
      goal_owner: "user",
      goal_delegates: [],
      dag_owner: "user",
      dag_delegates: [],
    },
  });
});

test("MutationResult v2 JSON and governance text use stable contract order", () => {
  const result = planTargetGovernanceMutation(
    source(),
    goalMutation(),
    TARGET_GRAMMAR_4_CAPABILITY,
    {
      governance: {
        actor: "codex",
        acceptedByOwner: ["user"],
      },
    },
  );
  const json = targetGovernanceMutationResultToJson(
    result,
    "project.set",
    "plan.pert",
  );
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
    "changed",
    "original_digest",
    "updated_digest",
    "updated_text",
    "diff",
    "edits",
    "write",
    "governance",
  ]);
  assert.deepEqual(Object.keys(json.governance), [
    "schema_version",
    "governance_interface_version",
    "governance_source_contract_version",
    "governance_semantics_version",
    "source_digest",
    "intent",
    "applicable",
    "actor",
    "accepted_by_owner",
    "affected_scopes",
    "required_owner_confirmations",
    "owner_confirmation_required",
    "write_authorized",
    "scopes",
  ]);
  assert.equal(json.cli_contract_version, 5);
  assert.equal(json.governance.write_authorized, true);
  assert.equal(
    renderTargetGovernanceDecision(result.governance),
    [
      "GOVERNANCE intent=preview applicable=true actor=codex affected_scopes=goal required_owner_confirmations=user accepted_by_owner=user write_authorized=true",
      "GOVERNANCE_SCOPE scope=goal required_owner=user delegates=alpha,zeta actor_direct=false owner_confirmation_required=true owner_confirmation_present=true scope_authorized=true denial_cause=-",
      "",
    ].join("\n"),
  );
});
