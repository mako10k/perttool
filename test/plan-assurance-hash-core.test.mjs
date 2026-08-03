import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  hashChangedOutcomeContract,
  hashTaskOutcomeCommitment,
  hashTaskPlanBasis,
  hashTaskPlanContract,
  taskPlanContractRecord,
} from "../dist/assurance/canonical.js";
import {
  evaluatePlanAssurance,
  sealTaskResult,
} from "../dist/assurance/evaluate.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function contract(id, from, to, overrides = {}) {
  return {
    model: "Perttool.TaskPlanContract.v1",
    taskId: id,
    fromMilestoneId: from,
    toMilestoneId: to,
    title: id,
    description: null,
    durationOrEstimate: {
      kind: "duration",
      value: { numerator: "1", denominator: "1", unit: "day" },
    },
    notBefore: null,
    deadline: null,
    priority: 0,
    requirements: [],
    owner: null,
    tags: [],
    source: null,
    ...overrides,
  };
}

function task(taskContract, overrides = {}) {
  return {
    contract: taskContract,
    lifecycle: "unfinished",
    seal: null,
    outcome: null,
    ...overrides,
  };
}

function input(tasks, overrides = {}) {
  return {
    modelVersion: 1,
    hashModelVersion: 1,
    tasks,
    executionRelations: [],
    explicitRelations: [],
    frontierInputs: [],
    ...overrides,
  };
}

function resultById(evaluation, taskId) {
  const result = evaluation.taskResults.find(({ taskId: id }) => id === taskId);
  assert.ok(result, taskId);
  return result;
}

function withInitialSeals(unsealedInput) {
  const unsealed = evaluatePlanAssurance(unsealedInput);
  assert.equal(unsealed.ok, true);
  return {
    ...unsealedInput,
    tasks: unsealedInput.tasks.map((item) => ({
      ...item,
      seal: sealTaskResult(resultById(unsealed, item.contract.taskId)),
    })),
  };
}

test("hash model 1 reproduces every fixed interface vector", async () => {
  const fixture = JSON.parse(await readFile(
    path.join(root, "test/fixtures/plan-assurance-interface-v1.json"),
    "utf8",
  ));
  const vectors = Object.fromEntries(
    fixture.hash_vectors.map((vector) => [vector.name, vector.sha256]),
  );
  const a = contract("A", "M0", "M1");
  const b = contract("B", "M1", "M2");
  const contractA = hashTaskPlanContract(a);
  const basisA = hashTaskPlanBasis(contractA, []);
  const contractB = hashTaskPlanContract(b);
  const basisB = hashTaskPlanBasis(contractB, [{
    predecessorTaskId: "A",
    relationMode: "both",
    assuranceHash: basisA,
  }]);

  assert.equal(contractA, vectors.task_contract_a);
  assert.equal(basisA, vectors.task_basis_a);
  assert.equal(contractB, vectors.task_contract_b);
  assert.equal(basisB, vectors.task_basis_b);
  assert.equal(
    hashChangedOutcomeContract("A delivered a versioned alternative"),
    vectors.changed_outcome_contract_a,
  );
  assert.equal(
    hashTaskOutcomeCommitment(
      "A",
      basisA,
      "A delivered a versioned alternative",
    ),
    vectors.changed_outcome_commitment_a,
  );
});

test("status, events, trivia, and set order do not enter a task contract hash", () => {
  const canonical = contract("A", "M0", "M1", {
    requirements: [
      { resourceId: "REVIEW", units: 1 },
      { resourceId: "DEV", units: 2 },
    ],
    tags: ["two", "one"],
  });
  const reorderedWithExcludedData = {
    ...canonical,
    requirements: [...canonical.requirements].reverse(),
    tags: [...canonical.tags].reverse(),
    status: "done",
    blockedReason: "excluded",
    workEvents: [{ kind: "finish", occurredAt: "2030-01-01T00:00:00Z" }],
    sourceTrivia: "different line endings",
  };
  assert.equal(
    hashTaskPlanContract(reorderedWithExcludedData),
    hashTaskPlanContract(canonical),
  );
  assert.deepEqual(
    taskPlanContractRecord(contract("UNICODE", "M0", "M1", {
      tags: ["\u{10000}", "\ue000"],
    })).tags,
    ["\ue000", "\u{10000}"],
  );
});

test("default both relations propagate one direct cause through the descendant closure", () => {
  const base = withInitialSeals(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
    task(contract("C", "M2", "M3")),
  ], {
    executionRelations: [
      { predecessorTaskId: "A", successorTaskId: "B" },
      { predecessorTaskId: "B", successorTaskId: "C" },
    ],
  }));
  const accepted = evaluatePlanAssurance(base);
  assert.deepEqual(
    accepted.taskResults.map(({ taskId, status }) => [taskId, status]),
    [["A", "verified"], ["B", "conditional"], ["C", "conditional"]],
  );

  const changed = evaluatePlanAssurance({
    ...base,
    tasks: base.tasks.map((item) => item.contract.taskId === "A"
      ? { ...item, contract: { ...item.contract, title: "A changed" } }
      : item),
  });
  assert.equal(changed.ok, true);
  assert.deepEqual(changed.directMismatchTaskIds, ["A"]);
  assert.deepEqual(changed.inheritedMismatchTaskIds, ["B", "C"]);
  assert.deepEqual(changed.replanRequiredTaskIds, ["A", "B", "C"]);
  assert.deepEqual(
    resultById(changed, "C").inheritedCauses[0].pathTaskIds,
    ["A", "B", "C"],
  );
});

test("diamond propagation returns every stable complete cause path", () => {
  const base = withInitialSeals(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
    task(contract("C", "M1", "M3")),
    task(contract("D", "M4", "M5")),
  ], {
    executionRelations: [
      { predecessorTaskId: "A", successorTaskId: "B" },
      { predecessorTaskId: "A", successorTaskId: "C" },
      { predecessorTaskId: "B", successorTaskId: "D" },
      { predecessorTaskId: "C", successorTaskId: "D" },
    ],
  }));
  const changed = evaluatePlanAssurance({
    ...base,
    tasks: base.tasks.map((item) => item.contract.taskId === "A"
      ? { ...item, contract: { ...item.contract, description: "changed" } }
      : item),
  });
  assert.deepEqual(
    resultById(changed, "D").inheritedCauses.map(({ pathTaskIds }) => pathTaskIds),
    [["A", "B", "D"], ["A", "C", "D"]],
  );
});

test("accepted seal components distinguish own, relation, and inherited changes", () => {
  const base = withInitialSeals(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
  ], {
    executionRelations: [
      { predecessorTaskId: "A", successorTaskId: "B" },
    ],
  }));
  const ownAndInherited = evaluatePlanAssurance({
    ...base,
    tasks: base.tasks.map((item) => ({
      ...item,
      contract: {
        ...item.contract,
        title: `${item.contract.title} changed`,
      },
    })),
  });
  assert.deepEqual(
    resultById(ownAndInherited, "B").directCauses.map(({ kind }) => kind),
    ["task_contract_changed"],
  );
  assert.deepEqual(
    resultById(ownAndInherited, "B").inheritedCauses.map(({ kind }) => kind),
    ["task_contract_changed"],
  );

  const relationChanged = evaluatePlanAssurance({
    ...base,
    explicitRelations: [{
      id: "REL_A_B",
      predecessorTaskId: "A",
      successorTaskId: "B",
      mode: "execution_only",
      reason: "B's plan is independent",
    }],
  });
  assert.deepEqual(
    resultById(relationChanged, "B").directCauses.map(({ kind }) => kind),
    ["planning_relation_changed"],
  );
  assert.deepEqual(relationChanged.inheritedMismatchTaskIds, []);
});

test("planning-only and execution-only keep planning and execution semantics separate", () => {
  const independentTasks = [
    task(contract("A", "M0", "M1")),
    task(contract("B", "M2", "M3")),
  ];
  const planningOnly = withInitialSeals(input(independentTasks, {
    explicitRelations: [{
      id: "REL_A_B",
      predecessorTaskId: "A",
      successorTaskId: "B",
      mode: "planning_only",
      reason: "B uses A's findings",
    }],
  }));
  const planningChanged = evaluatePlanAssurance({
    ...planningOnly,
    tasks: planningOnly.tasks.map((item) => item.contract.taskId === "A"
      ? { ...item, contract: { ...item.contract, title: "A changed" } }
      : item),
  });
  assert.deepEqual(planningChanged.inheritedMismatchTaskIds, ["B"]);

  const executionOnly = withInitialSeals(input(independentTasks, {
    executionRelations: [{ predecessorTaskId: "A", successorTaskId: "B" }],
    explicitRelations: [{
      id: "REL_A_B",
      predecessorTaskId: "A",
      successorTaskId: "B",
      mode: "execution_only",
      reason: "B's plan is independent",
    }],
  }));
  const executionChanged = evaluatePlanAssurance({
    ...executionOnly,
    tasks: executionOnly.tasks.map((item) => item.contract.taskId === "A"
      ? { ...item, contract: { ...item.contract, title: "A changed" } }
      : item),
  });
  assert.deepEqual(executionChanged.inheritedMismatchTaskIds, []);
  assert.equal(resultById(executionChanged, "B").status, "verified");
});

test("planning cycles fail before hashing with a stable witness", () => {
  const cyclic = evaluatePlanAssurance(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
  ], {
    executionRelations: [{ predecessorTaskId: "A", successorTaskId: "B" }],
    explicitRelations: [{
      id: "REL_B_A",
      predecessorTaskId: "B",
      successorTaskId: "A",
      mode: "planning_only",
      reason: "Reverse planning input",
    }],
  }));
  assert.equal(cyclic.ok, false);
  assert.deepEqual(cyclic.diagnostics.map(({ code }) => code), ["PTASSURE-102"]);
  assert.deepEqual(
    cyclic.diagnostics[0].data.cycle_task_ids,
    ["A", "B", "A"],
  );
  assert.deepEqual(cyclic.taskResults, []);
});

test("frontier commitments participate without recreating removed tasks", () => {
  const producerContract = hashTaskPlanContract(contract("A", "M0", "M1"));
  const firstCommitment = hashTaskPlanBasis(producerContract, []);
  const secondCommitment = hashTaskOutcomeCommitment(
    "A",
    firstCommitment,
    "Changed outcome",
  );
  const unsealed = input([task(contract("B", "M1", "M2"))], {
    frontierInputs: [{
      producerTaskId: "A",
      consumerTaskId: "B",
      relationMode: "both",
      assuranceHash: firstCommitment,
    }],
  });
  const base = withInitialSeals(unsealed);
  const changed = evaluatePlanAssurance({
    ...base,
    frontierInputs: [{
      ...base.frontierInputs[0],
      assuranceHash: secondCommitment,
    }],
  });
  assert.equal(resultById(changed, "B").status, "review_required");
  assert.deepEqual(
    resultById(changed, "B").inheritedCauses,
    [{
      kind: "frontier_commitment_changed",
      direct: false,
      rootTaskId: "A",
      affectedTaskId: "B",
      pathTaskIds: ["A", "B"],
    }],
  );

  const unavailable = evaluatePlanAssurance({
    ...base,
    frontierInputs: [{ ...base.frontierInputs[0], assuranceHash: null }],
  });
  assert.equal(unavailable.coverage, "partial");
  assert.equal(resultById(unavailable, "B").status, "unavailable");
});

test("changed outcomes invalidate once and become acceptable after consumer reseal", () => {
  const base = withInitialSeals(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
  ], {
    executionRelations: [{ predecessorTaskId: "A", successorTaskId: "B" }],
  }));
  const aSeal = base.tasks.find(({ contract: value }) => value.taskId === "A").seal;
  const changedInput = {
    ...base,
    tasks: base.tasks.map((item) => item.contract.taskId === "A"
      ? {
          ...item,
          lifecycle: "completed",
          outcome: {
            modelVersion: 1,
            againstBasisHash: aSeal.acceptedBasisHash,
            status: "changed",
            summary: "A delivered a versioned alternative",
          },
        }
      : item),
  };
  const changed = evaluatePlanAssurance(changedInput);
  assert.equal(resultById(changed, "A").status, "verified");
  assert.equal(resultById(changed, "A").outcomeStatus, "changed");
  assert.equal(resultById(changed, "B").status, "review_required");
  assert.deepEqual(changed.inheritedMismatchTaskIds, ["B"]);
  assert.deepEqual(
    resultById(changed, "B").inheritedCauses.map(({ kind }) => kind),
    ["changed_outcome"],
  );

  const resealedInput = {
    ...changedInput,
    tasks: changedInput.tasks.map((item) => item.contract.taskId === "B"
      ? { ...item, seal: sealTaskResult(resultById(changed, "B")) }
      : item),
  };
  const resealed = evaluatePlanAssurance(resealedInput);
  assert.equal(resultById(resealed, "A").outcomeStatus, "changed");
  assert.equal(resultById(resealed, "B").status, "verified");
  assert.deepEqual(resealed.replanRequiredTaskIds, []);

  const commitment = hashTaskOutcomeCommitment(
    "A",
    aSeal.acceptedBasisHash,
    "A delivered a versioned alternative",
  );
  assert.equal(resultById(changed, "A").exportedAssuranceHash, commitment);
});

test("missing completion evidence and inconsistent seals fail closed", () => {
  const base = withInitialSeals(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
  ], {
    executionRelations: [{ predecessorTaskId: "A", successorTaskId: "B" }],
  }));
  const missingOutcome = evaluatePlanAssurance({
    ...base,
    tasks: base.tasks.map((item) => item.contract.taskId === "A"
      ? { ...item, lifecycle: "completed" }
      : item),
  });
  assert.equal(resultById(missingOutcome, "A").status, "unavailable");
  assert.equal(resultById(missingOutcome, "B").status, "unavailable");
  assert.deepEqual(missingOutcome.unavailableTaskIds, ["A", "B"]);
  assert.deepEqual(resultById(missingOutcome, "B").directCauses, []);
  assert.deepEqual(
    resultById(missingOutcome, "B").inheritedCauses.map(({ kind }) => kind),
    ["outcome_missing"],
  );

  const inconsistent = evaluatePlanAssurance({
    ...base,
    tasks: base.tasks.map((item) => item.contract.taskId === "A"
      ? {
          ...item,
          seal: {
            ...item.seal,
            acceptedBasisHash: `sha256:${"0".repeat(64)}`,
          },
        }
      : item),
  });
  assert.equal(resultById(inconsistent, "A").status, "unavailable");
  assert.deepEqual(
    resultById(inconsistent, "A").directCauses.map(({ kind }) => kind),
    ["accepted_seal_inconsistent"],
  );
});

test("disabled and unknown models preserve compatibility and availability boundaries", () => {
  const tasks = [task(contract("A", "M0", "M1"))];
  const disabled = evaluatePlanAssurance(input(tasks, {
    modelVersion: null,
    hashModelVersion: null,
  }));
  assert.equal(disabled.coverage, "not_enabled");
  assert.equal(resultById(disabled, "A").status, "not_applicable");

  const unknown = evaluatePlanAssurance(input(tasks, {
    modelVersion: 2,
    hashModelVersion: 1,
  }));
  assert.equal(unknown.ok, true);
  assert.equal(resultById(unknown, "A").status, "unavailable");
  assert.deepEqual(unknown.unavailableTaskIds, ["A"]);
  assert.deepEqual(
    resultById(unknown, "A").directCauses.map(({ kind }) => kind),
    ["unknown_model"],
  );
});

test("full evaluation is byte-deterministic across input declaration order", () => {
  const base = withInitialSeals(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
    task(contract("C", "M1", "M3")),
  ], {
    executionRelations: [
      { predecessorTaskId: "A", successorTaskId: "C" },
      { predecessorTaskId: "A", successorTaskId: "B" },
    ],
  }));
  const forward = evaluatePlanAssurance(base);
  const reversed = evaluatePlanAssurance({
    ...base,
    tasks: [...base.tasks].reverse(),
    executionRelations: [...base.executionRelations].reverse(),
  });
  assert.equal(JSON.stringify(reversed), JSON.stringify(forward));
});

test("invalid canonical and enablement inputs fail as PTASSURE-101", () => {
  assert.throws(
    () => hashTaskPlanContract(contract("A", "M0", "M1", {
      title: "lone \ud800 surrogate",
    })),
    /lone high surrogate/,
  );
  assert.throws(
    () => hashTaskPlanContract(contract("A", "M0", "M1", {
      durationOrEstimate: {
        kind: "duration",
        value: { numerator: "2", denominator: "2", unit: "day" },
      },
    })),
    /not reduced/,
  );

  const enabledRecordWithoutModel = evaluatePlanAssurance(input([
    task(contract("A", "M0", "M1"), {
      seal: {
        acceptedContractHash: `sha256:${"0".repeat(64)}`,
        acceptedBasisHash: `sha256:${"0".repeat(64)}`,
        acceptedInputs: [],
      },
    }),
  ], { modelVersion: null, hashModelVersion: null }));
  assert.equal(enabledRecordWithoutModel.ok, false);
  assert.deepEqual(
    enabledRecordWithoutModel.diagnostics.map(({ code }) => code),
    ["PTASSURE-101"],
  );

  const invalidRelationMode = evaluatePlanAssurance(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
  ], {
    executionRelations: [{ predecessorTaskId: "A", successorTaskId: "B" }],
    explicitRelations: [{
      id: "REL_A_B",
      predecessorTaskId: "A",
      successorTaskId: "B",
      mode: "unknown",
      reason: "Invalid projected mode",
    }],
  }));
  assert.equal(invalidRelationMode.ok, false);
  assert.deepEqual(
    invalidRelationMode.diagnostics.map(({ code }) => code),
    ["PTASSURE-101"],
  );

  assert.throws(
    () => hashTaskPlanBasis(`sha256:${"0".repeat(64)}`, [{
      predecessorTaskId: "A",
      relationMode: "execution_only",
      assuranceHash: `sha256:${"1".repeat(64)}`,
    }]),
    /planning modes/,
  );

  const malformedOutcome = withInitialSeals(input([
    task(contract("A", "M0", "M1")),
  ]));
  const malformedOutcomeResult = evaluatePlanAssurance({
    ...malformedOutcome,
    tasks: malformedOutcome.tasks.map((item) => ({
      ...item,
      lifecycle: "completed",
      outcome: {
        modelVersion: 1,
        againstBasisHash: item.seal.acceptedBasisHash,
        status: "changed",
        summary: "lone \ud800 surrogate",
      },
    })),
  });
  assert.equal(resultById(malformedOutcomeResult, "A").status, "unavailable");
  assert.deepEqual(
    resultById(malformedOutcomeResult, "A").directCauses.map(({ kind }) => kind),
    ["outcome_invalid"],
  );
});
