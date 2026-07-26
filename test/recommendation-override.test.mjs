import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  canonicalOverrideArtifact,
  overrideValidationResultToJson,
  selectNextTasks,
  validateOverride,
} from "../dist/index.js";
import {
  evaluateRecommendationExpression,
} from "../dist/recommendation/explanation-values.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, "fixtures/recommendation");

async function sourceFor(fixture) {
  const source = await readFile(path.join(fixtureDirectory, fixture), "utf8");
  const result = selectNextTasks(source);
  assert.equal(result.ok, true);
  assert.ok(result.recommendation);
  return result;
}

function requestFor(source, selectedTaskIds, overrides = {}) {
  return {
    sourceSchemaVersion: "Perttool.NextResult.v4",
    sourceDigest: source.recommendation.sourceDigest,
    sourceResultDecisionId: source.recommendation.resultDecision.id,
    selectedTaskIds,
    actor: {
      kind: "human",
      id: "maintainer@example.com",
      authentication: "caller_asserted",
    },
    decidedAt: "2026-07-23T12:34:56Z",
    reasonCode: "human_priority_decision",
    reasonText: "Prioritize the bounded customer-visible polish now.",
    evidenceReferences: [
      {
        kind: "issue",
        value: "https://github.com/mako10k/perttool/issues/1",
      },
    ],
    acknowledgedNegativeFactReasonIds: [],
    ...overrides,
  };
}

function diagnosticCode(result) {
  assert.equal(result.ok, false);
  assert.equal(result.override, null);
  assert.equal(result.diagnostics.length, 1);
  return result.diagnostics[0].code;
}

test("OVR-001 and OVR-006 produce a deterministic allowed replacement artifact", async () => {
  const source = await sourceFor("rec-001-critical-priority.pert");
  const sourceBefore = structuredClone(source);
  const request = requestFor(source, ["OPTIONAL_POLISH"]);
  const first = validateOverride(source, request);
  const second = validateOverride(source, request);
  assert.equal(first.ok, true, JSON.stringify(first.diagnostics));
  assert.deepEqual(second, first);
  assert.deepEqual(source, sourceBefore);

  const actual = overrideValidationResultToJson(first);
  const expected = JSON.parse(
    await readFile(
      path.join(
        testDirectory,
        "golden/recommendation/override-decision.expected.json",
      ),
      "utf8",
    ),
  );
  assert.deepEqual(actual, expected);
  assert.equal(canonicalOverrideArtifact(first), JSON.stringify(expected));

  const { override_id: overrideId, ...payload } = actual.override;
  const recalculated = `override:sha256:${
    createHash("sha256")
      .update(JSON.stringify(payload), "utf8")
      .digest("hex")
  }`;
  assert.equal(overrideId, recalculated);
  assert.match(overrideId, /^override:sha256:[0-9a-f]{64}$/);
  assert.equal(actual.override.actor.authentication, "caller_asserted");
  assert.equal(actual.override.decided_at, request.decidedAt);

  const taskDecision = first.override.taskDecisions[0];
  const normalDecision = source.recommendation.taskDecisions.find(
    ({ subjectTaskId }) => subjectTaskId === taskDecision.taskId,
  );
  assert.equal(taskDecision.normalDecisionId, normalDecision.id);
  assert.equal(
    taskDecision.normalDecisiveStepId,
    normalDecision.decisiveStepId,
  );
  assert.deepEqual(
    taskDecision.normalReasonOccurrenceIds,
    normalDecision.reasonOccurrenceIds,
  );
  assert.deepEqual(
    taskDecision.normalComparisonIds,
    normalDecision.comparisonIds,
  );

  const trailer = [
    `Perttool-Override: ${overrideId}`,
    `Perttool-Override-Record: ${canonicalOverrideArtifact(first)}`,
  ];
  const record = JSON.parse(
    trailer[1].slice("Perttool-Override-Record: ".length),
  );
  assert.equal(record.override.override_id, trailer[0].split(": ", 2)[1]);
});

test("OVR-002 accepts a feasible deferred replacement without relaxing capacity", async () => {
  const source = await sourceFor(
    "rec-005-selected-resource-conflict.pert",
  );
  const result = validateOverride(
    source,
    requestFor(source, ["ENV_LOW"], {
      reasonText: "Use the lower-priority environment task in this start set.",
      evidenceReferences: [],
    }),
  );
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.override.selection, {
    selectedTaskIds: ["ENV_LOW"],
    retainedRecommendedTaskIds: [],
    displacedRecommendedTaskIds: ["ENV_HIGH"],
    selectedNonrecommendedTaskIds: ["ENV_LOW"],
    triggerCodes: ["deferred_selected"],
  });
  assert.equal(result.override.taskDecisions[0].normalTier, "deferred");
  assert.deepEqual(result.override.feasibility.resourceWitnesses, [
    {
      resourceId: "ENV",
      capacity: 1,
      activeUsage: 0,
      selectedUsage: 1,
      used: 1,
      availableAfterSelection: 0,
      selectedTaskIds: ["ENV_LOW"],
    },
  ]);
  assert.equal(result.override.feasibility.expression.kind, "all");
  assert.equal(
    result.override.feasibility.expression.children[0].relation,
    "less_or_equal",
  );
  assert.equal(
    evaluateRecommendationExpression(
      result.override.feasibility.expression,
      new Map(),
    ),
    true,
  );
});

test("OVR-003 rejects normal-authority selections without an override artifact", async () => {
  const rec001 = await sourceFor("rec-001-critical-priority.pert");
  const rec004 = await sourceFor("rec-004-parallel-set.pert");
  for (const [source, selection] of [
    [rec001, ["CRITICAL_FIX"]],
    [rec001, ["CRITICAL_FIX", "OPTIONAL_POLISH"]],
    [rec004, ["PARALLEL_A"]],
  ]) {
    const result = validateOverride(source, requestFor(source, selection));
    assert.equal(diagnosticCode(result), "PTOVR-106");
  }
});

test("OVR-004 fails closed for unsupported, stale, ineligible, and infeasible input", async () => {
  const rec001 = await sourceFor("rec-001-critical-priority.pert");
  const rec006 = await sourceFor("rec-006-active-resource-empty.pert");
  for (const [source, request] of [
    [
      rec001,
      requestFor(rec001, ["OPTIONAL_POLISH"], {
        sourceSchemaVersion: "Perttool.NextResult.v3",
      }),
    ],
    [
      { ...rec001, ok: false },
      requestFor(rec001, ["OPTIONAL_POLISH"]),
    ],
    [
      {
        ...rec001,
        recommendation: {
          ...rec001.recommendation,
          explanationStatus: {
            ...rec001.recommendation.explanationStatus,
            truncated: true,
          },
        },
      },
      requestFor(rec001, ["OPTIONAL_POLISH"]),
    ],
  ]) {
    assert.equal(
      diagnosticCode(validateOverride(source, request)),
      "PTOVR-101",
    );
  }

  for (const request of [
    requestFor(rec001, ["OPTIONAL_POLISH"], {
      sourceDigest: `sha256:${"0".repeat(64)}`,
    }),
    requestFor(rec001, ["OPTIONAL_POLISH"], {
      sourceResultDecisionId: "rec:decision:result:stale",
    }),
  ]) {
    assert.equal(
      diagnosticCode(validateOverride(rec001, request)),
      "PTOVR-102",
    );
  }

  for (const selection of [
    [],
    ["OPTIONAL_POLISH", "OPTIONAL_POLISH"],
    ["UNKNOWN"],
  ]) {
    assert.equal(
      diagnosticCode(
        validateOverride(rec001, requestFor(rec001, selection)),
      ),
      "PTOVR-103",
    );
  }
  assert.equal(
    diagnosticCode(
      validateOverride(
        rec006,
        requestFor(rec006, ["ACTIVE_TEST"]),
      ),
    ),
    "PTOVR-103",
  );
  const activeConflict = validateOverride(
    rec006,
    requestFor(rec006, ["FRONTIER_TEST"]),
  );
  assert.equal(diagnosticCode(activeConflict), "PTOVR-104");
  assert.deepEqual(activeConflict.diagnostics[0].data.resource_ids, ["ENV"]);
});

test("PTOVR-105 validates caller assertions without inventing identity or time", async () => {
  const source = await sourceFor("rec-001-critical-priority.pert");
  const invalidOverrides = [
    {
      actor: {
        kind: "human",
        id: " leading-space",
        authentication: "caller_asserted",
      },
    },
    { decidedAt: "2026-07-23T12:34:56.000Z" },
    { decidedAt: "2026-02-30T12:34:56Z" },
    { reasonText: "" },
    { reasonCode: "unregistered_reason" },
    {
      evidenceReferences: Array.from({ length: 17 }, (_, index) => ({
        kind: "other",
        value: `evidence-${index}`,
      })),
    },
    { evidenceReferences: [{ kind: "issue", value: " trailing-space " }] },
    { acknowledgedNegativeFactReasonIds: ["rec:reason:unrelated"] },
  ];
  for (const overrides of invalidOverrides) {
    const result = validateOverride(
      source,
      requestFor(source, ["OPTIONAL_POLISH"], overrides),
    );
    assert.equal(diagnosticCode(result), "PTOVR-105");
  }
});

test("evidence is deduplicated and sorted by kind and UTF-8 value", async () => {
  const source = await sourceFor("rec-001-critical-priority.pert");
  const result = validateOverride(
    source,
    requestFor(source, ["OPTIONAL_POLISH"], {
      evidenceReferences: [
        { kind: "url", value: "https://example.com/z" },
        { kind: "issue", value: "ISSUE-2" },
        { kind: "issue", value: "ISSUE-1" },
        { kind: "issue", value: "ISSUE-1" },
      ],
    }),
  );
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.override.reason.evidenceReferences, [
    { kind: "issue", value: "ISSUE-1" },
    { kind: "issue", value: "ISSUE-2" },
    { kind: "url", value: "https://example.com/z" },
  ]);
});

test("artifact identity binds the source capacity overrides", async () => {
  const fixture = await readFile(
    path.join(fixtureDirectory, "rec-001-critical-priority.pert"),
    "utf8",
  );
  const sourceText = fixture.replace(
    "\nmilestone NOW:",
    `\nresource DEV:
  title "Developer capacity"
  capacity 1

milestone NOW:`,
  );
  const source = selectNextTasks(sourceText, {
    capacityOverrides: new Map([["DEV", 2]]),
  });
  assert.equal(source.ok, true);
  assert.ok(source.recommendation);
  const withOverride = validateOverride(
    source,
    requestFor(source, ["OPTIONAL_POLISH"]),
  );
  assert.equal(withOverride.ok, true, JSON.stringify(withOverride.diagnostics));
  assert.deepEqual(withOverride.override.source.capacityOverrides, [
    { resourceId: "DEV", capacity: 2 },
  ]);

  const withoutOverride = await sourceFor("rec-001-critical-priority.pert");
  const baseline = validateOverride(
    withoutOverride,
    requestFor(withoutOverride, ["OPTIONAL_POLISH"]),
  );
  assert.equal(baseline.ok, true, JSON.stringify(baseline.diagnostics));
  assert.notEqual(withOverride.override.overrideId, baseline.override.overrideId);
});

test("override validation cannot bypass a future temporal release gate", async () => {
  const fixture = await readFile(
    path.join(fixtureDirectory, "rec-001-critical-priority.pert"),
    "utf8",
  );
  const sourceText = fixture
    .replace("  version 1\n", "  version 2\n  as_of 2026-07-26\n")
    .replace(
      '  title "Polish an optional component"\n',
      '  title "Polish an optional component"\n  not_before 2026-07-27\n',
    );
  const source = selectNextTasks(sourceText);
  assert.equal(source.ok, true);
  assert.deepEqual(
    source.temporal.authority.timeIneligibleTaskIds,
    ["OPTIONAL_POLISH"],
  );

  const result = validateOverride(
    source,
    requestFor(source, ["OPTIONAL_POLISH"]),
  );
  assert.equal(diagnosticCode(result), "PTOVR-103");
  assert.match(result.diagnostics[0].message, /time-eligible/);
});

test("validation is synchronous and leaves an unrelated filesystem sandbox unchanged", async () => {
  const source = await sourceFor("rec-001-critical-priority.pert");
  const sandbox = await mkdtemp(path.join(tmpdir(), "perttool-override-pure."));
  try {
    const before = await readdir(sandbox);
    const result = validateOverride(
      source,
      requestFor(source, ["OPTIONAL_POLISH"]),
    );
    assert.equal(result.ok, true);
    assert.deepEqual(await readdir(sandbox), before);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
