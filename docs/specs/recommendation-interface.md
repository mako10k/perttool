# Recommendation Interface Contract Specification

- Document status: Normative 1.0
- Recommendation interface version: 1
- Target schema: `Perttool.NextResult.v3`
- Created: 2026-07-22
- Related requirements: [../requirements.md](../requirements.md)
- Current CLI interface: [interfaces.md](interfaces.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Reason taxonomy: [recommendation-reasons.md](recommendation-reasons.md)
- Structured explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Human override: [recommendation-override.md](recommendation-override.md)
- Related issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. Purpose

This specification fixes the interface contract for exposing a normal recommendation with the same meaning through the Core API, CLI JSON, and CLI text. Its purpose is to enable an AI to obtain, from one `dag next --format json` result, the task to start now, the tier of every other task, comparison targets, applicable rules, exact facts, and the decision trace.

It defines the following:

- Core recommendation types and their connection to the existing `NextResult`
- the wire schema for `Perttool.NextResult.v3`
- encoding for typed values, entity references, expressions, and traces
- canonical English text generated from stable description keys
- the CLI text summary layout and the complete CLI JSON graph
- migration from `NextResult.v2`
- boundaries for unknown versions, invariant failures, and determinism

This specification is a design contract and was implemented atomically in the Core, CLI JSON/text, help, and package by MIG-04 on 2026-07-23. MIG-05 read-only human-override validation, MIG-06 five-plan shadowing, and MIG-07 adoption of normal AI task-selection authority and the unknown-version safe-stop dry run are also complete. Human-override apply/audit is gated separately and is not enabled merely by publishing v3 or generating an override artifact.

## 2. Normative position

Resolve semantic or design conflicts in the following order:

1. Must requirements in `docs/requirements.md`
2. recommendation tiers in the [Recommendation Semantics specification](recommendation.md)
3. selection order and rules in the [Recommendation Ranking Policy specification](recommendation-ranking.md)
4. reason codes in the [Recommendation Reason Taxonomy specification](recommendation-reasons.md)
5. facts, expressions, traces, and description keys in the [Recommendation Structured Explanation specification](recommendation-explanation.md)
6. this specification
7. common CLI, diagnostic, and stream rules in the current [CLI Interface specification](interfaces.md)
8. basic design, examples, tests, help, and implementation

This specification does not redefine the meaning of rankings, tiers, or reason codes. It inherits the common results, CLI streams, and exit codes of the current Interface v2 unchanged, except for explicitly stated v3 differences.

## 3. Scope

In scope:

- normal recommendations from `dag next`
- the `start` action for actual `ready` tasks
- CLI JSON containing the complete recommendation graph
- CLI text showing the tier and primary reason for every ready task
- stable types and ordering shared by the Core and adapters
- a one-time migration from the pre-release `NextResult.v2` to v3

Out of scope:

- implementation of the recommendation algorithm
- human-override input, persistence, and audit results
- replacement of upcoming explanations for non-ready tasks
- MCP, LSP, and provider-specific tool schemas
- localized template catalogs and a locale-selection option
- graph pagination, streaming, and partial-result queries
- a hard output limit measured in bytes
- a backward-compatible v2 parallel-output mode

## 4. Version identity

Version 1 consists of the following combination:

```text
next_schema_version                = Perttool.NextResult.v3
recommendation_interface_version  = 1
ranking_algorithm_id              = perttool.recommendation-ranking.lexicographic-frontier
ranking_algorithm_version         = 1
reason_taxonomy_version           = 1.0
explanation_model_version         = 1
expression_version                = 1
description_registry_version      = 1
description_locale                = en
```

These are separate compatibility boundaries and MUST NOT be collapsed into one `version` field. `schema_version` identifies wire shape, the algorithm version identifies selection results, the taxonomy version identifies the reason vocabulary, explanation/expression versions identify trace semantics, and the description registry and locale identify derived text.

## 5. Core API contract

### 5.1 Type names

The Core/Application layer has at least the following stable conceptual types:

```text
NextResultV3
RecommendationAnalysis
RecommendationResultDecision
RecommendationTaskDecision
RecommendationDecisionStep
RecommendationFact
RecommendationExpression
RecommendationComparison
RecommendationReasonOccurrence
RecommendationDescription
RecommendationEntityReference
RecommendationValue
RecommendationProvenance
RecommendationExplanationStatus
```

In the TypeScript implementation, map properties to camelCase in accordance with repository conventions; in the JSON adapter, map them to snake_case. Do not redefine the meaning of type names or properties per adapter.

### 5.2 Purity and completeness

After recommendation implementation, `selectNextTasks(text, options)` returns `NextResultV3` and performs no I/O, current-time lookup, locale lookup, or network lookup. Recommendation calculation uses the same parse/semantic/analysis result, and the CLI renderer does not reimplement ranking.

Core `RecommendationAnalysis` retains every tier-required trace, minimal comparison witness, resource-conflict witness, and emitted contributing/tie evidence required by the Structured Explanation specification. Do not truncate Core types to fit the amount of displayed text.

### 5.3 Orthogonality to existing results

`NextResultV3` retains v2 classification, `runnable_now`, resource rejections, and upcoming explanations, and adds the new root field `recommendation`.

- `groups.ready` represents eligibility, not the recommended set.
- `groups.runnable_now` represents current scheduler selection, not the recommended set.
- `tasks[].resource_rejections` witnesses `runnable_now`; it is not a recommendation conflict.
- `tasks[].explanation` is an upcoming dependency explanation, not a recommendation trace.
- `recommendation` is authoritative only at root `recommendation`; do not reuse existing field names.

## 6. Common wire primitives

### 6.1 Entity reference

An entity reference is the following object:

```text
kind  "project" | "task" | "milestone" | "gate" | "resource" |
      "policy_rule" | "ranking_factor" | "negative_fact_kind" | "derived_set"
id    string
```

Do not use a bare ID string as a substitute for a reference with a kind. Keep v2-derived fields, such as existing task-ID arrays, as strings for compatibility.

### 6.2 Typed value

Scalar values are a tagged union:

```text
{type: "boolean", value: boolean}
{type: "integer", value: decimal integer string}
{type: "rational", numerator: decimal integer string, denominator: positive decimal integer string}
{type: "enum", enum_type: string, value: string}
{type: "entity", value: RecommendationEntityReference}
```

Collection values contain only values of the same scalar type:

```text
{type: "list", item_type: string, items: RecommendationScalarValue[]}
{type: "set", item_type: string, items: RecommendationScalarValue[]}
{type: "map", key_type: string, value_type: string,
 entries: [{key: RecommendationScalarValue, value: RecommendationScalarValue}]}
```

Do not return Integer or Rational values as JSON numbers. Order set and map entries in the canonical order defined by the Structured Explanation specification. Do not permit duplicate set items or map keys.

### 6.3 Unit

A fact's `unit` is one of the following or `null`:

```text
{kind: "duration", value: "day" | "hour" | "point"}
{kind: "resource", resource: {kind: "resource", id: string}}
{kind: "ratio"}
null
```

Require `unit=null` for Boolean, enum, and entity-reference values. A dimensionless count also has `unit=null`, even when it is an Integer or Rational.

### 6.4 Provenance

```text
kind                "document" | "precedence_analysis" | "ranking_algorithm" |
                    "resource_snapshot" | "recommendation_model"
source_digest       "sha256:" followed by 64 lowercase hex digits
entity_references   RecommendationEntityReference[]
producer            {id: string, version: string}
source_span         Span|null
```

Use `source_span` only for a fact that directly corresponds to one location in a document. Do not attach an inferred span to a derived fact. `source_digest` MUST match the result root.

### 6.5 Record ID encoding

Record IDs in the decision graph have the following form:

```text
rec:<record_kind>:<semantic_component>[:<semantic_component>...]
```

`record_kind` is one of `decision|step|fact|comparison|reason|description`. Order components by the semantic identity order in the Structured Explanation specification; use `-` for an inapplicable value and a decimal integer of zero or greater for the canonical occurrence index. Convert every UTF-8 byte other than ASCII unreserved `A-Z a-z 0-9 - . _ ~` within a component to uppercase `%HH` percent encoding. Do not emit delimiter `:` unescaped from a component.

Examples:

```text
rec:decision:task:TASK_A
rec:step:TASK_A:eligibility:task_ready:0
rec:comparison:ranking:TASK_A:TASK_B:lower_total_float:0
rec:reason:TASK_A:recommended_set_selected:decisive:0
rec:description:TASK_A:recommendation.summary.recommended:0
```

Do not use random UUIDs, IDs consisting only of array indexes, locale text, display values, or source offsets as record IDs.

## 7. `Perttool.NextResult.v3`

### 7.1 Root delta

The v3 root adds the following to every v2 field:

```text
schema_version                    "Perttool.NextResult.v3"
recommendation_interface_version  1
recommendation                    RecommendationAnalysis
```

`recommendation` is always present in a successful `dag next` result. Do not omit it when there are zero ready tasks; return an empty recommended set and a result-level feasibility decision.

### 7.2 RecommendationAnalysis

```text
action                         "start"
algorithm:
  id                           "perttool.recommendation-ranking.lexicographic-frontier"
  version                      1
  optimal                      false
reason_taxonomy_version        "1.0"
explanation_model_version      1
expression_version             1
description_registry_version   1
description_locale             "en"
recommended_task_ids           string[]
result_decision                RecommendationResultDecision
task_decisions                 RecommendationTaskDecision[]
decision_steps                 RecommendationDecisionStep[]
facts                          RecommendationFact[]
comparisons                    RecommendationComparison[]
reason_occurrences             RecommendationReasonOccurrence[]
descriptions                   RecommendationDescription[]
explanation_status             RecommendationExplanationStatus
```

`optimal=false` indicates that the result is heuristic. Do not rename field names to `score`, `best`, `optimal`, or similar terms that imply a global optimum.

`recommended_task_ids` returns the recommended set from the Ranking Policy in scan order. Do not give the set's meaning an implicit execution order. `task_decisions` contains exactly one decision for every actual ready task and no decision for a non-ready task.

### 7.3 Explanation status

CLI JSON v3 returns only complete graphs:

```text
level                     "full"
complete                  true
decisive_chain_complete   true
truncated                 false
omitted_counts:
  decision_steps          0
  facts                   0
  comparisons             0
  reason_occurrences      0
  descriptions            0
```

The producer does not silently omit arrays because of size and does not treat a result that cannot satisfy the fixed values above as successful.

## 8. Decision graph wire schema

### 8.1 Result decision

```text
id                         string
action                     "start"
recommended_task_ids       string[]
joint_feasibility_fact_id  string
step_ids                   string[]
reason_occurrence_ids      string[]
```

`joint_feasibility_fact_id` refers to the fact `startFeasible(R) == true`. Do not omit the fact when the recommended set is empty.

### 8.2 Task decision

```text
id                               string
subject_task_id                  string
action                           "start"
classification                   "ready"
tier                             "recommended" | "allowed" | "deferred" | "discouraged"
recommended_set_member           boolean
step_ids                         string[]
decisive_step_id                 string
reason_occurrence_ids            string[]
comparison_ids                   string[]
primary_higher_priority_task_id  string|null
summary_description_id           string
description_ids                  string[]
```

`recommended_set_member=true` and `tier=recommended` MUST be equivalent. The Structured Explanation specification is authoritative for the applicability conditions of `primary_higher_priority_task_id`; do not fabricate a higher-priority task when it is inapplicable.

### 8.3 Decision step

```text
id                            string
phase                         "eligibility" | "negative_fact_filter" |
                              "selection_horizon" | "candidate_ranking" |
                              "resource_selection" | "set_membership" |
                              "tier_classification"
rule                          RecommendationEntityReference
input_fact_ids                string[]
expression                    RecommendationExpression
result                        boolean
effect                        "supporting" | "opposing" | "blocking" | "neutral"
role                          "decisive" | "contributing" | "context"
reason_occurrence_ids         string[]
comparison_ids                string[]
depends_on_step_ids           string[]
```

`rule.kind` is `policy_rule`. `depends_on_step_ids` refers only to preceding steps in the same decision graph.

### 8.4 Fact

```text
id          string
kind        string
subject     RecommendationEntityReference
value       RecommendationValue
unit        RecommendationUnit|null
provenance  RecommendationProvenance
```

`kind` MUST be registered in the declared Taxonomy/Ranking/Explanation version. Do not put a display decimal in `value`.

### 8.5 Expression

A term is one of the following:

```text
{kind: "fact", fact_id: string}
{kind: "literal", value: RecommendationValue, unit: RecommendationUnit|null}
```

An expression is one of the following:

```text
{kind: "compare", left: Term,
 relation: "equal" | "not_equal" | "less_than" | "less_or_equal" |
           "greater_than" | "greater_or_equal" | "contains",
 right: Term}
{kind: "all", children: RecommendationExpression[]}
{kind: "any", children: RecommendationExpression[]}
```

Do not convert an unknown node or relation to a known node. `all` and `any` MUST each have one or more children.

### 8.6 Comparison

```text
id                         string
scope                      "ranking" | "selection_horizon" | "resource_selection" | "tier"
subject_task_id            string
alternative_task_id        string|null
winner_task_id             string|null
loser_task_id              string|null
decisive_rule              RecommendationEntityReference
decisive_expression        RecommendationExpression
prior_tied_rule_ids        string[]
contributing_rule_ids      string[]
fact_ids                   string[]
```

For a resource rejection caused only by active allocation, set inter-task fields to `null` and refer to the active blocker through a fact. Do not fill in an empty string or the subject task itself as the winner.

### 8.7 Reason occurrence

```text
id                         string
code                       string
subject                    RecommendationEntityReference
effect                     "supporting" | "opposing" | "blocking" | "neutral"
role                       "decisive" | "contributing" | "context"
fact_ids                   string[]
emission_expression        RecommendationExpression
decision_step_id           string
comparison_ids             string[]
description_id             string|null
```

`code` is an ASCII lower-snake-case identifier in Taxonomy version 1.0. `subject.kind` is `task` for a task-level reason, while result-level `recommended_set_feasible` uses `derived_set`. Set `description_id` to non-null only when the registry contains a reason-level description key; do not infer display text or a rule ID from the code. Every task decision's `summary_description_id` is always non-null.

### 8.8 Description

```text
id                         string
key                        string
registry_version           1
parameters                 [{name: string, value: RecommendationValue,
                             unit: RecommendationUnit|null}]
source_reason_ids          string[]
source_comparison_ids      string[]
locale                     "en"
text                       string
render_status              "rendered"
```

Order parameters by ASCII lexical order of their names. `text` is a convenience projection derived from the key and typed parameters, not a decision input. If the producer lacks a template for a registered key, do not place a raw fallback in a successful result; treat it as an invariant failure.

## 9. Canonical description rendering

### 9.1 Locale and value rendering

Interface version 1 has only the canonical locale `en` and adds no locale option. Adding locales in the future must not change the same keys, parameters, tiers, or traces.

Canonical value rendering:

- entity reference: stable `id`
- boolean: `true` or `false`
- integer: decimal without a leading zero
- Rational: numerator when the denominator is 1; otherwise `numerator/denominator`
- duration unit: `d`, `h`, `p`
- resource unit: append the corresponding resource ID as ` <RESOURCE_ID>-units`
- enum: use the registered value as is
- list/set: `[item1, item2]`; use `[]` when empty
- relation: use the registry value as is

Description text must retain exact values and must not use the rounded display from `--precision`.

### 9.2 Version 1 English templates

| Description key | Canonical template |
| --- | --- |
| `recommendation.summary.recommended` | `{task_id} is recommended by rule {decisive_rule_id}.` |
| `recommendation.summary.allowed` | `{task_id} is allowed as additional work, but {higher_priority_task_id} ranks higher by rule {decisive_rule_id}.` |
| `recommendation.summary.deferred_resource` | `{task_id} is deferred because resources {resource_ids} cannot fit it with the recommended set; selected blockers: {higher_priority_task_ids}; active blockers: {active_blocker_task_ids}.` |
| `recommendation.summary.deferred_policy` | `{task_id} is deferred by rule {decisive_rule_id}.` |
| `recommendation.summary.discouraged` | `{task_id} is discouraged because {negative_fact_kind} applies under rule {decisive_rule_id}.` |
| `recommendation.reason.ranking_comparison` | `{winner_task_id} ranks above {alternative_task_id} by rule {rule_id}: {winner_value} {relation} {alternative_value}.` |
| `recommendation.reason.resource_conflict` | `{task_id} cannot be added on {resource_id}: capacity {capacity}, used {used}, required {required}, deficit {deficit}, occupants {occupant_task_ids}.` |
| `recommendation.reason.policy_deferral` | `{task_id} is deferred by policy rule {rule_id}.` |
| `recommendation.reason.negative_fact` | `{task_id} is discouraged because {negative_fact_kind} applies under rule {rule_id}.` |

Template punctuation, ASCII spaces, and parameter order are part of registry version 1. Do not automatically insert task titles or resource titles into templates; always display stable IDs.

## 10. CLI text contract

After the existing header and velocity display, and before `ACTIVE`, the text output of `dag next` adds the following summary sections.

```text
RECOMMENDATION
ALGORITHM perttool.recommendation-ranking.lexicographic-frontier@1 optimal=false
EXPLANATION detail=summary complete=false machine_trace="--format json"
RECOMMENDED SET TASK_A,TASK_C

RECOMMENDED START
TASK_A tier=recommended rule=lower_total_float higher_priority=- blockers=-
  reason=ranking_rule_supports_task
  why: TASK_A is recommended by rule lower_total_float.

ALLOWED ADDITIONAL START
TASK_B tier=allowed rule=lower_total_float higher_priority=TASK_A blockers=-
  reason=ranking_rule_opposes_task
  why: TASK_B is allowed as additional work, but TASK_A ranks higher by rule lower_total_float.

DEFERRED START
-

DISCOURAGED START
-
```

Rules:

- Always display the four tier sections in the fixed order.
- Display each ready task in exactly one section, in complete candidate order.
- Use `-` for an empty section.
- Display the decisive reason code as the primary reason and the decisive rule ID as the rule.
- Use `-` when no higher-priority task applies; use a comma-separated list in stable order for multiple blockers.
- Use the canonical English text of the summary description for `why:`.
- Use `RECOMMENDED SET -` when the recommended set is empty.
- Do not omit `optimal=false` or the statement that the summary is not a complete trace.
- Do not remove or replace the existing `ACTIVE`, `RUNNABLE NOW`, `READY / WAITING RESOURCE`, `BLOCKED NOW`, or `UPCOMING` sections with recommendation tiers.

Do not enable raw facts or ASTs to be reconstructed from the text summary. AI and automation that require the decision trace must use `--format json` on the same command.

## 11. JSON completeness, size, and pagination

Version 1 prioritizes determinism and explainability and always returns CLI JSON with `level=full` and `complete=true`.

- It has no CLI option that changes the explanation level.
- It has no graph pagination.
- It has no byte limit or record-count limit.
- A task filter must not omit comparison witnesses for other tasks.
- Terminal width, TTY, and environment variables must not change its contents.

Result size increases according to the number of ready tasks, triggered rules, facts, and resource witnesses. If size controls are added in the future, a separate interface version must fix cross-reference closure, snapshot binding for continuation tokens, and decisive-chain completeness. A Version 1 producer must not return a truncated graph due to its own limit.

CLI text is an explicit summary projection, not truncation of the JSON graph. Display `complete=false` and the machine-trace route in the header.

## 12. Ordering and determinism

JSON arrays use the following order.

1. `recommended_task_ids`: scan order from the Ranking Policy
2. `task_decisions`: complete candidate order; task ID order for ready tasks that are not candidates
3. `decision_steps`: phase, rule order, step ID
4. `facts`: fact kind, subject kind, subject ID, fact ID
5. `comparisons`: scope, subject task, alternative task, decisive rule, comparison ID
6. `reason_occurrences`: decision phase, rule order, subject, alternative, code, occurrence ID
7. `descriptions`: source task order, key, description ID
8. reference ID arrays: the order defined by the semantic rule where it has one; stable ID order otherwise

JSON object keys use schema order, include a trailing newline, and contain no ANSI sequences. The same document bytes, options, all versions, and tool version must return byte-identical JSON and text. The description locale `en` must not vary with the environment's `LANG` or timezone.

## 13. Unknown versions and consumer safety

Consumers must observe the following rules.

- Do not infer an unknown `schema_version` as v2 or v3.
- Even for a known schema, do not map an unknown tier enum, expression node, decisive reason code, decisive rule, or model major version to a known value.
- Do not reclassify a known tier solely because of an unknown optional contributing reason.
- Do not automatically start a task with unknown decisive semantics.
- Preserve unknown objects and typed values as losslessly as possible.
- Do not reconstruct missing authority from derived English `text` alone.

Producers must not emit an unknown code, key, node, or relation for the version they declare. Consumers that do not know a minor-compatible taxonomy addition may display raw codes and facts, but must not automate an action based on a decisive reason they do not understand.

## 14. Diagnostics and exit codes

The following namespace is reserved for recommendation invariant failures.

| Code | Severity | Meaning |
| --- | --- | --- |
| `PTREC-301` | error | Mismatch among tier, set membership, decision trace, and reference closure |
| `PTREC-302` | error | Mismatch between declared algorithm/taxonomy/model version and code, rule, fact, or expression |
| `PTREC-303` | error | Mismatch among description key, parameters, template, and rendered text |

These are internal invariant failures, not input errors in a valid user document. The CLI must not emit a successful `NextResult.v3` and must use internal-error exit `70` from the [CLI Interface specification](interfaces.md). Where possible, diagnostics include decision, task, fact, and rule IDs in `data`, but must not include a stack trace, the entire document, or an absolute path.

Zero ready tasks, an empty recommended set, and resource conflicts for all horizon tasks are normal results and must not produce `PTREC-*`.

## 15. Migration from `NextResult.v2`

The logical change that publishes the recommendation implementation raises the default schema of `dag next` from v2 to v3.

| v2 | v3 |
| --- | --- |
| `schema_version=Perttool.NextResult.v2` | `schema_version=Perttool.NextResult.v3` |
| no recommendation field | required root `recommendation` |
| `groups` and `tasks` | retain their fields and semantics |
| `tasks[].resource_rejections` | retain scheduler rejections |
| `tasks[].explanation` | retain the upcoming dependency explanation |
| text starts with operational state | add the recommendation summary near the beginning |

Migration rules:

1. Do not reinterpret v2 fields as recommendations.
2. A v3 consumer checks `schema_version` first.
3. Do not depend on a v2 consumer silently accepting v3.
4. Do not add a dual-emission option such as `--schema-version 2`.
5. Update implementation, help, Core/CLI JSON parity tests, goldens, and package documentation in the same logical change.
6. Record this as a breaking migration during pre-release in the CHANGELOG.

## 16. Minimal JSON example

The following is an excerpt showing reference shapes; it is not a complete result.

```json
{
  "schema_version": "Perttool.NextResult.v3",
  "recommendation_interface_version": 1,
  "recommendation": {
    "action": "start",
    "algorithm": {
      "id": "perttool.recommendation-ranking.lexicographic-frontier",
      "version": 1,
      "optimal": false
    },
    "reason_taxonomy_version": "1.0",
    "explanation_model_version": 1,
    "expression_version": 1,
    "description_registry_version": 1,
    "description_locale": "en",
    "recommended_task_ids": ["TASK_A"],
    "task_decisions": [
      {
        "id": "rec:decision:task:TASK_A",
        "subject_task_id": "TASK_A",
        "action": "start",
        "classification": "ready",
        "tier": "recommended",
        "recommended_set_member": true,
        "step_ids": ["rec:step:TASK_A:eligibility:task_ready:0", "rec:step:TASK_A:set_membership:recommended_set_selected:0"],
        "decisive_step_id": "rec:step:TASK_A:set_membership:recommended_set_selected:0",
        "reason_occurrence_ids": ["rec:reason:TASK_A:recommended_set_selected:decisive:0"],
        "comparison_ids": ["rec:comparison:ranking:TASK_A:TASK_B:lower_total_float:0"],
        "primary_higher_priority_task_id": null,
        "summary_description_id": "rec:description:TASK_A:recommendation.summary.recommended:0",
        "description_ids": ["rec:description:TASK_A:recommendation.summary.recommended:0"]
      }
    ],
    "explanation_status": {
      "level": "full",
      "complete": true,
      "decisive_chain_complete": true,
      "truncated": false,
      "omitted_counts": {
        "decision_steps": 0,
        "facts": 0,
        "comparisons": 0,
        "reason_occurrences": 0,
        "descriptions": 0
      }
    }
  }
}
```

An actual result includes `result_decision`, every ready-task decision, steps, facts, comparisons, reasons, and descriptions. Do not emit the excerpt as a complete result.

## 17. Items handed to subsequent design tasks

### `NORMATIVE_EXAMPLES`

[Normative recommendation examples](../examples/recommendation.md) fix the following golden and test perspectives.

- v3 complete JSON goldens and text-summary goldens
- critical versus priority, parallel recommended tasks, and allowed tasks outside the horizon
- resource conflicts that distinguish selected blockers from active-only blockers
- an empty recommended set and zero ready tasks
- exact Rationals, entity references, expression evaluation, and description rendering
- migration tests that retain the meaning of v2 fields
- invariant tests for `PTREC-301` through `PTREC-303`

### `PROCESS_MIGRATION`

[Recommendation implementation and self-use migration](../process/recommendation-migration.md) fix the following.

- the order from Core through adapters for the recommendation implementation slice
- the CHANGELOG, help, and consumer migration guide for the v3 switch
- a shadow/adoption gate that makes JSON recommendations the task-selection authority in the AI development flow

### [`HUMAN_OVERRIDE_CONTRACT`](recommendation-override.md) (decided)

- how to attach an override to a separate result without changing the normal `recommendation` graph
- types for actor, reason, selected task, and source recommendation identity
- the boundary between read-only recommendation and write/audit

## 18. Acceptance for this slice

- Defined Core conceptual types and the v3 root field.
- Defined the wire encoding for typed values, units, provenance, and entity references.
- Fixed fields for decisions, steps, facts, expressions, comparisons, reasons, and descriptions.
- Defined canonical English templates and exact value rendering.
- Separated responsibilities between the text summary and complete JSON.
- Explicitly decided not to use pagination, size limits, or truncation in v3.
- Defined the consumer rule that unknown decisive semantics must not be automated.
- Defined the boundary between recommendation invariant diagnostics and exit 70.
- Defined the breaking migration from `NextResult.v2` to v3.
- Did not change the current interface or implementation.

## 19. Implementation status

MIG-04 was completed on 2026-07-23.

- `selectNextTasks` returns public `NextResultV3` and complete `RecommendationAnalysis`.
- `recommendationAnalysisToJson` and the CLI return the same `snake_case` graph.
- The default schema of `dag next` was switched to `Perttool.NextResult.v3` in a single change.
- The text output adds four tier summaries, `complete=false`, and the JSON route.
- Fixture baselines retain the meaning of v2 operational fields.
- Automated checks cover complete empty JSON, text, Core/CLI parity, byte determinism, fail-closed behavior, help, and the package.

Section 18 is the acceptance record from the time this specification slice was drafted. “Did not change the current interface or implementation” is historical at that point; this section is authoritative for the implementation state after MIG-04.
