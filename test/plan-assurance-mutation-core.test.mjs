import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  planTargetPlanAssuranceMutation,
} from "../dist/assurance/mutation.js";
import {
  candidateForPlanAssuranceWrite,
  persistTargetPlanAssuranceResult,
} from "../dist/application/target-assurance-write.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar6Document,
} from "../dist/semantic/target-validator.js";

function source(lineEnding = "\n") {
  return [
    "project ASSURE_MUTATION:",
    "  version 5",
    '  title "mutation"',
    "  as_of 2026-08-03",
    "  duration_unit point",
    "  velocity 2p/1d",
    "  finish M2",
    "  dag_owner user",
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
    "# task A comment stays byte-identical",
    "task A M0 -> M1:",
    '  title "A"',
    "  duration 1p",
    "  status done",
    "",
    "task B M1 -> M2:",
    '  title "B"',
    "  duration 1p",
    "  status planned",
    "",
  ].join(lineEnding);
}

function gatedSource() {
  return [
    "project ASSURE_MIXED_BATCH:",
    "  version 5",
    '  title "mixed batch"',
    "  as_of 2026-08-03",
    "  duration_unit point",
    "  velocity 2p/1d",
    "  finish M3",
    "  dag_owner user",
    "",
    "milestone M0:",
    '  title "start"',
    "  state reached",
    "",
    "milestone M1:",
    '  title "one"',
    "",
    "milestone M2:",
    '  title "two"',
    "",
    "milestone M3:",
    '  title "finish"',
    "",
    "task A M0 -> M1:",
    '  title "A"',
    "  duration 1p",
    "  status done",
    "",
    "gate G M1 -> M2:",
    '  reason "execution dependency"',
    "",
    "task B M2 -> M3:",
    '  title "B"',
    "  duration 1p",
    "  status planned",
    "",
  ].join("\n");
}

function mutation(text, request, governance = { intent: "preview" }) {
  return planTargetPlanAssuranceMutation(
    text,
    request,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance },
  );
}

function seal(text = source()) {
  return mutation(text, {
    kind: "plan_assurance.seal",
    reason: "Initial reviewed planning baseline",
  });
}

function assertValid(text) {
  const checked = validateTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
}

test("initial seal atomically enables Grammar 6 and creates a complete component baseline", () => {
  const result = seal();
  assert.equal(
    result.ok,
    true,
    result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.equal(result.schemaVersion, "Perttool.MutationResult.v4");
  assert.equal(result.governance.schemaVersion, "Perttool.GovernanceDecision.v2");
  assert.equal(result.governance.governanceInterfaceVersion, 2);
  assert.deepEqual(result.governance.affectedScopes, ["plan_assurance"]);
  assert.equal(result.governance.writeAuthorized, false);
  assert.match(result.updatedText, /  version 6\n/);
  assert.match(result.updatedText, /  plan_assurance_model 1\n/);
  assert.match(result.updatedText, /  plan_assurance_hash_model 1\n/);
  assert.match(result.updatedText, /plan_seal A:/);
  assert.match(result.updatedText, /plan_seal B:/);
  assert.match(result.updatedText, /  accepted_inputs:\n    A both sha256:/);
  assert.match(result.updatedText, /# task A comment stays byte-identical/);
  assert.equal(result.assuranceImpact.after.coverage, "complete");
  assertValid(result.updatedText);
  for (const name of [
    "planTargetPlanAssuranceMutation",
    "persistTargetPlanAssuranceResult",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
});

test("selected reseal establishes the first basis for a newly added unsealed task", () => {
  const baseline = seal(source().replace("  status done", "  status planned")).updatedText;
  const partial = baseline
    .replace(
      "# task A comment stays byte-identical",
      [
        "milestone M_NEW:",
        '  title "new"',
        "",
        "# task A comment stays byte-identical",
      ].join("\n"),
    )
    .replace(
      "\nplan_seal A:",
      [
        "",
        "task C M0 -> M_NEW:",
        '  title "C"',
        "  duration 1p",
        "  status planned",
        "",
        "gate C_JOIN M_NEW -> M2:",
        '  reason "retain one connected finish path"',
        "",
        "plan_seal A:",
      ].join("\n"),
    );
  assertValid(partial);
  const beforeA = /plan_seal A:[\s\S]*?(?=\n\n|$)/u.exec(partial)[0];
  const beforeB = /plan_seal B:[\s\S]*?(?=\n\n|$)/u.exec(partial)[0];
  const resealed = mutation(partial, {
    kind: "plan_assurance.reseal",
    taskIds: ["C"],
    reason: "Reviewed newly added task",
  });
  assert.equal(resealed.ok, true, JSON.stringify(resealed.diagnostics));
  assert.deepEqual(resealed.assuranceImpact.projection.before.requiredActions, [{
    kind: "replan_and_reseal",
    rootTaskIds: ["C"],
    affectedTaskIds: ["C"],
  }]);
  assert.equal(
    /plan_seal A:[\s\S]*?(?=\n\n|$)/u.exec(resealed.updatedText)[0],
    beforeA,
  );
  assert.equal(
    /plan_seal B:[\s\S]*?(?=\n\n|$)/u.exec(resealed.updatedText)[0],
    beforeB,
  );
  assert.match(
    resealed.updatedText,
    /plan_seal C:[\s\S]*reason "Reviewed newly added task"/u,
  );
  assert.equal(resealed.assuranceImpact.after.coverage, "complete");
  assertValid(resealed.updatedText);
});

test("relation maintenance is source preserving and never updates accepted hashes", () => {
  const baseline = seal().updatedText;
  const sealed = mutation(baseline, {
    kind: "task_outcome.add",
    id: "OUT_A",
    taskId: "A",
    status: "conformant",
    reason: "Acceptance matched the reviewed plan",
  }).updatedText;
  const beforeB = /plan_seal B:[\s\S]*?(?=\n\n|$)/.exec(sealed)[0];
  const added = mutation(sealed, {
    kind: "plan_dependency.add",
    id: "REL_A_B",
    predecessorTaskId: "A",
    successorTaskId: "B",
    mode: "execution_only",
    reason: "Execution order does not constrain the reviewed plan",
  });
  assert.equal(added.ok, true);
  assert.match(added.updatedText, /task_relation REL_A_B A -> B:/);
  assert.ok(
    added.updatedText.indexOf("task_relation REL_A_B") <
      added.updatedText.indexOf("plan_seal A"),
  );
  assert.equal(
    /plan_seal B:[\s\S]*?(?=\n\n|$)/.exec(added.updatedText)[0],
    beforeB,
  );
  assert.deepEqual(
    added.assuranceImpact.after.replanRequiredTaskIds,
    ["B"],
  );
  assert.deepEqual(
    added.assuranceImpact.projection.after.requiredActions,
    [{
      kind: "replan_and_reseal",
      rootTaskIds: ["B"],
      affectedTaskIds: ["B"],
    }],
  );

  const invalid = mutation(sealed, {
    kind: "plan_dependency.add",
    id: "REL_INVALID",
    predecessorTaskId: "A",
    successorTaskId: "B",
    mode: "planning_only",
    reason: "Invalid duplicate of the projected execution relation",
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.updatedText, null);
  assert.ok(invalid.diagnostics.some(({ code }) => code === "PTASSURE-101"));

  const resealed = mutation(added.updatedText, {
    kind: "plan_assurance.reseal",
    taskIds: ["B"],
    reason: "B remains valid without A as a planning predecessor",
  });
  assert.equal(resealed.ok, true);
  assert.deepEqual(resealed.assuranceImpact.after.replanRequiredTaskIds, []);
  assert.match(
    resealed.updatedText,
    /plan_seal B:[\s\S]*reason "B remains valid without A as a planning predecessor"/,
  );

  const removed = mutation(resealed.updatedText, {
    kind: "plan_dependency.remove",
    id: "REL_A_B",
  });
  assert.equal(removed.ok, true);
  assert.doesNotMatch(removed.updatedText, /task_relation REL_A_B/);
  assert.deepEqual(removed.assuranceImpact.after.replanRequiredTaskIds, ["B"]);
});

test("outcome add binds the equal current basis and changed evidence invalidates consumers", () => {
  const sealed = seal().updatedText;
  const added = mutation(sealed, {
    kind: "task_outcome.add",
    id: "OUT_A",
    taskId: "A",
    status: "conformant",
    reason: "Acceptance matched the reviewed plan",
  });
  assert.equal(added.ok, true);
  const acceptedA = /plan_seal A:\n  accepted_contract sha256:[0-9a-f]{64}\n  accepted_basis (sha256:[0-9a-f]{64})/.exec(sealed)[1];
  assert.match(added.updatedText, new RegExp(`against_basis ${acceptedA}`));
  assert.match(added.updatedText, /status conformant/);
  assert.doesNotMatch(added.updatedText, /  summary /);

  const changed = mutation(added.updatedText, {
    kind: "task_outcome.set",
    id: "OUT_A",
    status: "changed",
    summary: "A delivered a versioned alternative",
    reason: "Acceptance found a deliberate difference",
  });
  assert.equal(changed.ok, true);
  assert.match(changed.updatedText, /status changed/);
  assert.match(changed.updatedText, /summary "A delivered a versioned alternative"/);
  assert.deepEqual(changed.assuranceImpact.after.replanRequiredTaskIds, ["B"]);

  const conformant = mutation(changed.updatedText, {
    kind: "task_outcome.set",
    id: "OUT_A",
    status: "conformant",
    clearSummary: true,
    reason: "Corrected acceptance classification",
  });
  assert.equal(conformant.ok, true);
  assert.doesNotMatch(conformant.updatedText, /  summary /);
  assert.deepEqual(conformant.assuranceImpact.after.replanRequiredTaskIds, []);

  const removed = mutation(conformant.updatedText, {
    kind: "task_outcome.remove",
    id: "OUT_A",
  });
  assert.equal(removed.ok, true);
  assert.ok(removed.diagnostics.some(({ code }) => code === "PTASSURE-203"));
  assert.deepEqual(removed.assuranceImpact.after.unavailableTaskIds, ["A", "B"]);
});

test("assurance batch validates one final candidate and applies governance once", () => {
  const result = mutation(source(), {
    kind: "batch",
    mutations: [
      {
        kind: "plan_assurance.seal",
        reason: "Initial reviewed planning baseline",
      },
      {
        kind: "task_outcome.add",
        id: "OUT_A",
        taskId: "A",
        status: "conformant",
        reason: "Acceptance matched the reviewed plan",
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.edits.length, 1);
  assert.deepEqual(result.governance.affectedScopes, ["plan_assurance"]);
  assert.match(result.updatedText, /plan_seal A:/);
  assert.match(result.updatedText, /task_outcome OUT_A:/);
  assert.deepEqual(result.assuranceImpact.after.unavailableTaskIds, []);
  assertValid(result.updatedText);
});

test("mixed atomic batch converts execution dependency to planning-only in one final candidate", () => {
  const initial = seal(gatedSource()).updatedText;
  const baseline = mutation(initial, {
    kind: "task_outcome.add",
    id: "OUT_A",
    taskId: "A",
    status: "conformant",
    reason: "Acceptance matched the reviewed plan",
  }).updatedText;
  const result = mutation(baseline, {
    kind: "batch",
    mutations: [
      { kind: "gate.remove", id: "G" },
      {
        kind: "gate.add",
        id: "H",
        from: "M1",
        to: "M3",
        gate: { reason: "Preserve finish reachability without ordering B" },
      },
      {
        kind: "milestone.set",
        id: "M2",
        set: { state: "reached" },
      },
      {
        kind: "plan_dependency.add",
        id: "REL_A_B",
        predecessorTaskId: "A",
        successorTaskId: "B",
        mode: "planning_only",
        reason: "B still consumes A's result without execution ordering",
      },
    ],
  });
  assert.equal(
    result.ok,
    true,
    result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.doesNotMatch(result.updatedText, /gate G /);
  assert.match(result.updatedText, /gate H M1 -> M3:/);
  assert.match(result.updatedText, /task_relation REL_A_B A -> B:/);
  assert.match(result.updatedText, /  mode planning_only/);
  assert.deepEqual(result.governance.affectedScopes, ["dag", "plan_assurance"]);
  assert.deepEqual(result.governance.requiredOwnerConfirmations, ["user"]);
  assertValid(result.updatedText);
});

test("mutation requests fail closed for preconditions and warning policy", () => {
  const sealed = seal().updatedText;
  const repeated = seal(sealed);
  assert.equal(repeated.ok, false);
  assert.ok(repeated.diagnostics.some(({ code }) => code === "PTASSURE-303"));

  const noOutcomeBasis = mutation(source(), {
    kind: "task_outcome.add",
    id: "OUT_A",
    taskId: "A",
    status: "conformant",
    reason: "No seal exists",
  });
  assert.equal(noOutcomeBasis.ok, false);
  assert.ok(noOutcomeBasis.diagnostics.some(({ code }) => code === "PTASSURE-305"));

  const strict = planTargetPlanAssuranceMutation(
    sealed,
    {
      kind: "task_outcome.remove",
      id: "MISSING",
    },
    TARGET_GRAMMAR_6_CAPABILITY,
    { warningsAsErrors: true },
  );
  assert.equal(strict.ok, false);
  assert.ok(strict.diagnostics.some(({ code }) => code === "PTASSURE-302"));
});

test("CRLF and unrelated source trivia survive assurance mutations", () => {
  const text = `\uFEFF${source("\r\n")}`;
  const result = seal(text);
  assert.equal(result.ok, true);
  assert.equal(result.updatedText.startsWith("\uFEFFproject"), true);
  assert.equal(/(?<!\r)\n/.test(result.updatedText), false);
  assert.match(result.updatedText, /# task A comment stays byte-identical/);
  assertValid(result.updatedText);
});

test("authorized persistence is candidate and digest bound and revalidates Grammar 6", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "perttool-assurance-write-"));
  const target = path.join(directory, "plan.pert");
  try {
    const original = source();
    await writeFile(target, original, "utf8");
    const preview = seal(original);
    assert.equal(candidateForPlanAssuranceWrite(preview), null);

    const denied = mutation(
      original,
      {
        kind: "plan_assurance.seal",
        reason: "Initial reviewed planning baseline",
      },
      { intent: "persist", actor: "codex" },
    );
    assert.equal(denied.ok, false);
    assert.equal(candidateForPlanAssuranceWrite(denied), null);
    assert.ok(denied.diagnostics.some(({ code }) => code === "PTGOV-101"));

    const authorized = mutation(
      original,
      {
        kind: "plan_assurance.seal",
        reason: "Initial reviewed planning baseline",
      },
      { intent: "persist", actor: "user" },
    );
    assert.equal(authorized.ok, true);
    assert.equal(candidateForPlanAssuranceWrite(authorized), authorized.updatedText);
    const written = await persistTargetPlanAssuranceResult(
      authorized,
      TARGET_GRAMMAR_6_CAPABILITY,
      {
        mode: "in_place",
        target,
        expectedDigest: authorized.originalDigest,
      },
    );
    assert.deepEqual(written, { mode: "in_place", target, written: true });
    assert.equal(await readFile(target, "utf8"), authorized.updatedText);
    assertValid(await readFile(target, "utf8"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
