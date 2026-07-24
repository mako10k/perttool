# NextResult.v3 consumer migration guide

- Scope: CLI/library consumers that read `Perttool.NextResult.v2`
- Migration target: `Perttool.NextResult.v3`
- Publication date: 2026-07-23
- Normal authority adoption date: 2026-07-23
- Normative specification: [Recommendation Interface Contract](../specs/recommendation-interface.md)

## 1. Breaking change

The default JSON schema of `dag next` changed from v2 to v3. There is no option to emit v2 concurrently.

V3 preserves the meanings of v2 `groups`, `tasks`, `resource_rejections`, and upcoming `explanation`, and adds the following at the root.

```text
schema_version                    "Perttool.NextResult.v3"
recommendation_interface_version  1
recommendation                    complete RecommendationAnalysis
```

`groups.ready` represents start eligibility, and `groups.runnable_now` is the resource-feasible subset chosen by the existing scheduler. Neither is an alias for recommendation. Read start authority only from root `recommendation`.

## 2. Check the schema first

Consumers must check `schema_version` before accessing any other field.

```js
const result = JSON.parse(stdout);

if (result.schema_version !== "Perttool.NextResult.v3") {
  throw new Error(`unsupported dag next schema: ${result.schema_version}`);
}
if (result.recommendation_interface_version !== 1) {
  throw new Error("unsupported recommendation interface");
}

const recommendation = result.recommendation;
if (
  recommendation.algorithm.id !==
    "perttool.recommendation-ranking.lexicographic-frontier" ||
  recommendation.algorithm.version !== 1 ||
  recommendation.reason_taxonomy_version !== "1.0" ||
  recommendation.explanation_model_version !== 1 ||
  recommendation.expression_version !== 1 ||
  recommendation.description_registry_version !== 1 ||
  recommendation.description_locale !== "en"
) {
  throw new Error("unsupported decisive recommendation semantics");
}
if (
  recommendation.explanation_status.complete !== true ||
  recommendation.explanation_status.decisive_chain_complete !== true ||
  recommendation.explanation_status.truncated !== false ||
  Object.values(
    recommendation.explanation_status.omitted_counts,
  ).some((count) => count !== 0) ||
  result.diagnostics.some(({ code }) => code.startsWith("PTREC-"))
) {
  throw new Error("incomplete recommendation graph");
}
```

Do not coerce an unknown tier, decisive rule, reason code, expression node, or model version into a known value. Do not automatically start a task when any decisive semantics are not understood.

## 3. Read recommended tasks

`recommended_task_ids` is the set that can be started together in the current cycle. Do not treat array order as execution order. Under normal authority, consumers may select a subset containing one or more recommended tasks, or the full recommended set plus exactly one resource-feasible `allowed` task. Replacing a recommended task with an allowed task, and selecting `deferred` or `discouraged`, are outside normal authority. After starting one task, update project state and rerun `dag next`; do not reuse the same result.

Even with zero ready tasks, `recommendation`, the result decision, and joint-feasibility facts are present. `recommended_task_ids=[]` is a normal result, not an error. The recommended set can be empty because of active allocation even when ready tasks exist.

Each actual ready task has exactly one `task_decisions` entry.

```js
for (const decision of recommendation.task_decisions) {
  switch (decision.tier) {
    case "recommended":
      // normal start authority
      break;
    case "allowed":
      // may start only as additional work while retaining recommended work
      break;
    case "deferred":
    case "discouraged":
      // do not start without a human override
      break;
    default:
      throw new Error(`unknown recommendation tier: ${decision.tier}`);
  }
}
```

Do not omit `algorithm.optimal=false` or present this result as proof of a global optimum.

## 4. Read “why A rather than B”

Follow references from the task decision in this order.

1. Obtain the canonical English summary from `summary_description_id`.
2. Check the primary alternative through `primary_higher_priority_task_id`.
3. Obtain the applied rule and exact expression from `decisive_step_id`.
4. Obtain the winner, alternative, preceding tie, and contributing rule from `comparison_ids`.
5. Obtain typed values, units, and provenance from step/comparison `fact_ids`.

`descriptions[].text` is a display projection, not the authority source of truth. Do not infer missing rules or facts from text. When only active allocation causes a resource conflict, the comparison winner/loser task is `null`; do not fabricate a ready task.

## 5. Text and JSON

Text output is a human-facing summary with four tier sections; its header displays `complete=false` and the `--format json` route. Automation and AI agents use JSON containing the complete graph.

```sh
perttool dag next PLAN.pert --format json
```

A recommendation-invariant failure does not return a successful v3 result; it returns `PTREC-301` through `PTREC-303` and exit `70`. Distinguish it from zero ready tasks or an empty recommended set.

For perttool's own AI development, after acceptance of the five-plan shadow and the MIG-07 dry run, this known and complete JSON was adopted as the normal task-selection authority. Select a workstream from the macro-plan recommendation, then reanalyze its corresponding detail plan; do not compare different detail plans directly. Stop without returning a task ID for an unknown or incomplete contract. Human-override apply/audit is a separate gate; do not treat a read-only artifact alone as evidence that it has been performed.

## 6. Library consumer

`selectNextTasks` returns public `NextResultV3`. On success, `recommendation` is complete and `recommendationAnalysisToJson` generates the same snake_case wire projection as the CLI.

```js
import { recommendationAnalysisToJson, selectNextTasks } from "perttool";

const result = selectNextTasks(sourceText);
if (!result.ok || result.recommendation === null) {
  throw new Error(result.diagnostics.map(({ code }) => code).join(","));
}
const wireRecommendation = recommendationAnalysisToJson(result.recommendation);
```

An adapter that must align the filesystem-byte digest with the root result passes the read-time `sha256:` digest to `NextOptions.sourceDigest`. A library call that receives only a string deterministically generates the digest from UTF-8 text.

## 7. Read-only human override validation

`validateOverride` takes only a successful, complete `NextResultV3` and an explicit request, returning `Perttool.OverrideDecision.v1` without changing the normal recommendation. Only an allowed replacement, deferred selection, or future discouraged selection triggers an override; a selection within normal authority returns `PTOVR-106`, a non-ready selection returns `PTOVR-103`, and a resource-infeasible replacement returns `PTOVR-104`, without generating an artifact.

```js
import {
  canonicalOverrideArtifact,
  selectNextTasks,
  validateOverride,
} from "perttool";

const source = selectNextTasks(sourceText);
if (!source.ok || source.recommendation === null) {
  throw new Error("complete source recommendation is required");
}

const validation = validateOverride(source, {
  sourceSchemaVersion: "Perttool.NextResult.v3",
  sourceDigest: source.recommendation.sourceDigest,
  sourceResultDecisionId: source.recommendation.resultDecision.id,
  selectedTaskIds: ["DEFERRED_TASK"],
  actor: {
    kind: "human",
    id: "maintainer@example.com",
    authentication: "caller_asserted",
  },
  decidedAt: "2026-07-23T12:34:56Z",
  reasonCode: "human_priority_decision",
  reasonText: "Explicitly choose this feasible replacement now.",
  evidenceReferences: [{ kind: "issue", value: "ISSUE-123" }],
  acknowledgedNegativeFactReasonIds: [],
});

if (!validation.ok) {
  throw new Error(validation.diagnostics.map(({ code }) => code).join(","));
}
const canonicalRecord = canonicalOverrideArtifact(validation);
```

The same source and request return the same `override_id` and canonical record. The actor is not authenticated by perttool but is `caller_asserted`, and the current time is not inserted automatically. `reasonText` and evidence must not include a secret, credential, or token.

This is a read-only Core API. It does not change task state, files, Git, or the network, and no CLI yet applies an override or saves one to an audit sink. Before MIG-08, do not treat a canonical artifact as execution permission or an applied audit.
