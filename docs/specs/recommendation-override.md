# Recommendation Human Override Contract Specification

- Document status: Normative 1.0
- Override contract version: 1
- Override artifact schema: `Perttool.OverrideDecision.v1`
- Created: 2026-07-22
- Requirements: [../requirements.md](../requirements.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Reason taxonomy: [recommendation-reasons.md](recommendation-reasons.md)
- Structured explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Temporal start authority: [temporal-unit-interface.md](temporal-unit-interface.md)
- Plan assurance: [plan-assurance.md](plan-assurance.md)
- Related issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. Purpose

This specification establishes a contract that ties a human decision to intentionally depart from a normal recommendation to the original recommendation, selected tasks, replaced tasks, reason, resource feasibility, actor, and time, rather than leaving it as an implicit task selection or a brief chat statement.

A human override is not a feature that erases or falsifies a decision in the project model. It is a decision event in which a human explicitly approves a different feasible start set while retaining the normal recommendation as a fact of that snapshot.

It defines the following:

- start selections that require an override and selections that do not
- boundaries of decisions that human authority can override, and graph/resource invariants that it cannot override
- a stable reference to the normal recommendation
- actor, reason code, reason text, evidence, and decision time
- resource validation of the override start set
- a deterministic override ID and canonical artifact
- a repository-native audit policy using Git history
- stale determination, single use, and full re-analysis after a state change

This specification is a normative contract. MIG-05, on 2026-07-23, implemented read-only `validateOverride`, public types, the `Perttool.OverrideDecision.v1` JSON projection, and the canonical artifact in the library Core. The Grammar 6 and CLI Contract 7 cutover changes its accepted source envelope from `Perttool.NextResult.v5` to `Perttool.NextResult.v6` and makes plan-assurance eligibility non-overridable. It does not imply that an override command, task-status mutation, Git commit, or audit write has been implemented.

## 2. Normative position

Resolve semantic or design conflicts in the following order:

1. Must requirements in `docs/requirements.md`
2. lifecycle, tier, and start authority in the [Recommendation Semantics Specification](recommendation.md)
3. the normal selected set and comparisons in the [Recommendation Ranking Policy Specification](recommendation-ranking.md)
4. normal reasons in the [Recommendation Reason Taxonomy Specification](recommendation-reasons.md)
5. the normal trace in the [Recommendation Structured Explanation Specification](recommendation-explanation.md)
6. normal wire identity in the [Recommendation Interface Contract Specification](recommendation-interface.md)
7. temporal release eligibility and start authority in the [Temporal and Unit Interface Contract](temporal-unit-interface.md)
8. this specification
9. Graph Semantics, CLI Interface, basic design, process, examples, tests, and implementation

An override does not reclassify a normal tier. Do not use an override reason code as a normal ranking input or normal Reason Taxonomy code.

## 3. Scope

In scope:

- the `start` action for an actual `ready` task
- a decision to select `allowed` work instead of recommended work
- a decision to select `deferred` or `discouraged` work
- a replacement start set that contains multiple tasks
- a human-supplied reason and caller-asserted actor
- a read-only validation artifact fixed to the source recommendation snapshot
- a durable audit envelope in a Git-managed project

Out of scope:

- forcing a non-ready task to start
- ignoring dependencies, gates, blocked status, or resource-capacity violations
- automatic changes to priority, duration, dependencies, or capacity
- learning ranking weights from override reasons
- approval workflows, RBAC, identity providers, signatures, or authentication
- storing data in generic issue trackers or chat history
- a CLI command and write implementation that applies an override
- automatic execution of Git commands
- external audit services, network writes, or notifications

## 4. Human authority boundary

### 4.1 Decisions that can be overridden

A human can override the decision authority held by a normal recommendation: which ready task to prioritize now.

- not start some or all of the recommended set now
- start a resource-feasible `allowed` task instead of recommended work
- start a resource-feasible `deferred` task in place of a recommended task
- start a resource-feasible `discouraged` task with awareness of modeled negative facts

An override does not change the original task's normal tier, decisive reason, higher-priority task, or resource witness.

### 4.2 Decisions that cannot be overridden

A human override does not bypass any of the following:

- eligibility of a task that is not `ready`
- an unreached dependency or gate
- `blocked` status
- starting an active task again
- starting a done task
- a future `not_before` release
- an unavailable temporal release relationship
- an unsealed, review-required, or unavailable plan-assurance state
- a simultaneous start set that exceeds applied capacity
- an invalid document, cycle, undefined reference, or analysis-invariant failure

When any of these must change, a human explicitly modifies the project model, such as task state, dependencies, or capacity, and re-analyzes it through a safe write path. Do not falsify project facts using only an override artifact.

### 4.3 Feasible replacement

Let `R` be the normal recommended set and `O` be the set of ready tasks started now by an override. A valid override satisfies the following:

```text
O is a subset of assurance-eligible P
startFeasible(O) == true
O differs from an authority-preserving start selection
```

Resource feasibility includes active allocations and applied capacity and uses the same exact determination as the Recommendation Semantics Specification. A task deferred because `startFeasible(R union {t}) == false` can be feasible in `O` when some of `R` is removed. When a task itself cannot start because of active allocation alone, do not validate an override; require a capacity or state change.

## 5. Override requirement classification

### 5.1 No override required

The following are within normal authority and do not require an override artifact:

- starting one or more recommended tasks; selecting a subset of multiple recommended tasks has no implicit order
- retaining the recommended set and additionally starting a resource-feasible `allowed` task
- starting no task now

Do not regard merely not starting every task in the recommended set concurrently as a departure.

### 5.2 Override required

Use the following trigger codes:

| Trigger code | Exact condition |
| --- | --- |
| `allowed_replaces_recommended` | A selected `allowed` task is present and one or more normal recommended tasks are removed from the start set. |
| `deferred_selected` | The normal tier of a selected task is `deferred`. |
| `discouraged_selected` | The normal tier of a selected task is `discouraged`. |

When one event satisfies multiple conditions, retain every applicable code in the table order. Selecting a subset of `recommended` tasks, selecting no task, or only adding allowed work does not produce a trigger.

### 5.3 Override impossible

The following produce a rejected result rather than a valid override artifact:

- `O` contains a non-ready or temporally ineligible task
- `startFeasible(O) == false`
- the source recommendation is stale or incomplete
- the selected task's normal decision cannot be referenced from the source graph
- the actor, decision time, or reason does not meet the requirements
- zero trigger codes mean that an override is unnecessary

Do not record a case that does not require an override as an override merely to increase the audit count.

## 6. Human reason taxonomy

An override reason is not a normal project fact; it is a decision reason asserted by a human who takes responsibility for it. Version 1 has the following stable codes:

| Reason code | Meaning |
| --- | --- |
| `human_priority_decision` | A human decision outside the project model changes the current priority. |
| `external_commitment` | An external commitment, such as a customer, contract, or deadline, takes precedence. |
| `incident_response` | An incident or urgent response takes precedence. |
| `plan_correction_pending` | A model omission or error is recognized, and a limited departure is made before correction. |
| `resource_reallocation_pending` | The selection changes before an actual resource-allocation change is reflected in the model. |
| `risk_acceptance` | A human accepts a modeled negative fact or known risk. |
| `experiment` | A different task is deliberately started as a bounded experiment. |
| `other_explicit_reason` | A reason not covered above is stated explicitly. |

`reason_code` alone is insufficient; nonempty `reason_text` is required. Do not automatically convert reason text into a normal reason code, ranking fact, or task priority.

## 7. Override request

The request passed to pure validation has the following meaning:

```text
source_schema_version          "Perttool.NextResult.v6"
source_digest                  sha256 digest
source_result_decision_id      string
selected_task_ids              string[]
actor:
  kind                         "human"
  id                           string
  authentication              "caller_asserted"
decided_at                     RFC 3339 UTC string
reason_code                    HumanOverrideReasonCode
reason_text                    string
evidence_references            OverrideEvidenceReference[]
acknowledged_negative_fact_reason_ids string[]
```

Rules:

- `source_digest` and the result decision ID match the complete source recommendation.
- `selected_task_ids` contains one or more entries, has no duplicates, and is stabilized in the canonical order of source `task_decisions`.
- perttool does not claim to authenticate the actor and fixes `authentication=caller_asserted`.
- `decided_at` is the `YYYY-MM-DDTHH:mm:ssZ` value explicitly supplied by the caller; do not automatically insert the current time.
- The actor ID has no leading or trailing Unicode White_Space, is 1..256 UTF-8 bytes, and has no NUL.
- `reason_text` has no leading or trailing Unicode White_Space, is 1..4096 UTF-8 bytes, and has no NUL.
- Explicitly include every decisive negative-fact reason ID of a selected `discouraged` task in `acknowledged_negative_fact_reason_ids`. Do not include any other ID.
- Evidence has 0..16 entries; each value has no leading or trailing Unicode White_Space, is 1..1024 UTF-8 bytes, and has no NUL.
- Help warns not to include secrets, credentials, or tokens in reasons or evidence.

Evidence reference:

```text
kind   "issue" | "commit" | "document" | "url" | "other"
value  string
```

The producer does not perform a network or file lookup for a reference target. Deduplicate identical kind/value pairs and stabilize them in the ASCII/UTF-8 byte order of kind and value.

## 8. Override validation

Validation is a pure operation whose only inputs are the source
`NextResult.v6` and request; it does not change normal ranking, temporal
eligibility, or plan-assurance eligibility.

```text
validateOverride(sourceNextResult, request): OverrideValidationResult
```

Validation order:

1. understand the source schema, interface, algorithm, taxonomy, and explanation versions
2. verify that the source result has `ok=true`, is complete, and is not truncated
3. verify that the source digest and result decision ID match the request
4. verify that temporal and plan-assurance authority is complete and
   consistent with the source recommendation
5. verify that every selected task is actually ready, time-eligible,
   assurance-eligible, and has a task decision
6. derive trigger codes from section 5
7. evaluate `startFeasible(O)` for selected set `O` exactly, with active allocations and applied capacity
8. reference from the source trace the negative facts for discouraged tasks, blockers for deferred tasks, and displaced recommended tasks
9. validate the actor, time, reason, evidence, and negative-fact acknowledgement
10. generate the canonical artifact and override ID

Do not change the source normal recommendation if a step fails. Do not reinterpret a validation failure as success because of human approval.

## 9. `Perttool.OverrideDecision.v1`

### 9.1 Result envelope

```text
schema_version          "Perttool.OverrideDecision.v1"
tool_version            string
operation               "recommendation.override.validate"
ok                      boolean
diagnostics             Diagnostic[]
diagnostics_truncated   boolean
override                HumanOverrideDecision|null
```

When `ok=true`, `override` is non-null; when `ok=false`, `override=null`. This is not a mutation result but a validation artifact that does not change a file, task status, or Git repository.

### 9.2 HumanOverrideDecision

```text
override_contract_version        1
override_id                      "override:sha256:" + 64 lowercase hex digits
source:
  schema_version                 "Perttool.NextResult.v6"
  tool_version                   string
  source_digest                  sha256 digest
  recommendation_interface_version 1
  ranking_algorithm_id           string
  ranking_algorithm_version      integer
  reason_taxonomy_version        string
  explanation_model_version      integer
  expression_version             integer
  description_registry_version   integer
  result_decision_id             string
  recommended_task_ids           string[]
  capacity_overrides             [{resource_id: string, capacity: integer}]
actor                            OverrideActor
decided_at                       RFC 3339 UTC string
reason:
  code                           HumanOverrideReasonCode
  text                           string
  evidence_references            OverrideEvidenceReference[]
selection:
  selected_task_ids              string[]
  retained_recommended_task_ids  string[]
  displaced_recommended_task_ids string[]
  selected_nonrecommended_task_ids string[]
  trigger_codes                  OverrideTriggerCode[]
task_decisions                  OverrideTaskDecision[]
feasibility                     OverrideFeasibility
single_use                      true
```

`retained_recommended_task_ids` is `O intersection R`, `displaced_recommended_task_ids` is `R minus O`, and `selected_nonrecommended_task_ids` is `O minus R`.

### 9.3 Per-task decision reference

```text
task_id                       string
normal_decision_id            string
normal_tier                   "recommended" | "allowed" | "deferred" | "discouraged"
normal_decisive_step_id       string
normal_reason_occurrence_ids  string[]
normal_comparison_ids         string[]
override_selected             true
trigger_codes                 OverrideTriggerCode[]
acknowledged_negative_fact_reason_ids string[]
```

Include only selected tasks. When the normal tier is `discouraged`, `acknowledged_negative_fact_reason_ids` contains every decisive negative-fact reason; for other tiers it is empty. Reference the source ID without copying a normal reason and transforming it into another meaning.

`normal_reason_occurrence_ids` contains tier-required reasons and the decisive-chain closure, while `normal_comparison_ids` contains the comparisons they reference in canonical order. Do not add reasons for unrelated tasks or exhaustive comparisons not used for the decision.

### 9.4 Feasibility

```text
selected_set_reference       {kind: "derived_set", id: "O"}
start_feasible               true
active_task_ids              string[]
resource_witnesses:
  resource_id                string
  capacity                   integer
  active_usage               integer
  selected_usage             integer
  used                        integer
  available_after_selection  integer
  selected_task_ids          string[]
expression                   RecommendationExpression|null
```

Version 1 returns witnesses only for resources with usage of at least 1, rather than for every declared resource, and orders them by resource ID. Check `used = active_usage + selected_usage` and `available_after_selection = capacity - used` as exact integers. `expression` is a restricted `All` expression that compares each witness's precomputed `used <= capacity` using unit-bearing literals. When there are zero witnesses, the resource constraint is vacuously feasible and `expression=null`. Do not generate a valid artifact when the expression is false or an arithmetic invariant does not match.

## 10. Deterministic identity

Generate the override ID from the SHA-256 of the `HumanOverrideDecision` payload excluding `override_id`, serialized as compact JSON in schema order and canonical array order, encoded as UTF-8, and without a newline.

```text
override_id = "override:sha256:" + lowercaseHex(sha256(canonical_payload_without_id))
```

The identity includes the following:

- source digest and all semantic versions
- result decision ID and normal recommended set
- selected, retained, and displaced tasks
- trigger code and normal decision reference
- exact resource witness
- actor ID and caller-supplied decision time
- human reason code/text/evidence

Do not include localized descriptions, the current time, hostname, username, absolute path, or a random nonce in the identity. The same request and source result must return byte-identical artifacts and override IDs.

## 11. Durable audit policy

### 11.1 General rule

Before starting an override-target task, store the canonical `Perttool.OverrideDecision.v1` artifact in the durable append-only audit sink specified by project policy. Do not use chat history, terminal scrollback, or AI-internal context alone as the audit destination.

The perttool Core does not write audits. Generating a validation artifact and storing it, mutating state, and executing are separate authorities.

### 11.2 Repository-native default

For a Git-managed `.pert` project, the default audit sink is the commit message of the task-state-change commit corresponding to the override. Put the following two trailers at the end of the commit body.

```text
Perttool-Override: override:sha256:<64 lowercase hex digits>
Perttool-Override-Record: <canonical compact Perttool.OverrideDecision.v1 JSON>
```

Rules:

- The ID recalculated from the record trailer JSON matches `Perttool-Override`.
- Reflect the selected task's start state in the source of truth in the same commit.
- Do not mix unrelated overrides into one commit.
- Do not consider beginning execution without creating a commit to be durable-audit completion.
- perttool does not run Git automatically; creating the commit is the responsibility of the human/execution workflow.
- Do not store secrets in the commit message.

Stage 2 has enabled general editing writes, but does not enable override apply for self-use until MIG-08 validation, single-use, and audit gates are satisfied. Do not fabricate override authority merely from the existence of this contract or the safe-write surface.

### 11.3 External sink

When project policy uses an external audit system, it must still store the complete canonical artifact or a lossless content-addressed blob retrievable by override ID. Do not leave only an issue URL or ticket ID and lose the artifact. Network writes to an external sink are outside the perttool Core's responsibility.

## 12. Apply, single-use, and stale boundary

A validated override is a single-use authorization fixed to the source digest and source recommendation.

Recheck the following before apply:

- The current canonical document digest matches the source digest.
- The capacity override and analysis options match the source recommendation.
- The selected task remains ready.
- The selected set remains resource-feasible.
- The override ID and artifact digest match.
- The durable audit can be attached to the same state transition.

If even one item has changed, reject it as stale and restart from `dag next`. Do not rebase an old override onto a new snapshot.

Conceptually, apply treats the selected task's start-state transition and audit envelope as one logical change. Do not allow partial apply, starting only some selected tasks, or reuse of the same override ID. Subsequent implementation/process design fixes the concrete mutation command, atomic file write, and Git integration.

## 13. Re-analysis contract

After override apply, rerun check, analyze, and next for the entire project from a new snapshot whose project document reflects selected tasks as active and tasks not started in their original state.

- Do not reuse the source recommendation or override artifact as the ranking result for the next cycle.
- Do not automatically rewrite a displaced recommended task as deferred.
- Do not automatically convert a human reason into priority, dependency, or a negative fact.
- Track normal recommendation history with Git/audit artifacts and recompute the current result from the new snapshot.
- Do not change the model without a separate explicit change, even for reasons that indicate a model update such as a pending plan correction.

It is normal if the recommendation after re-analysis again does not recommend the same task. When continuing with another start action, re-evaluate whether an override is necessary against the new result.

## 14. Explainability

An AI must be able to answer at least the following from an override artifact:

- What was the normal recommendation?
- Which tasks did the human select, and which recommended tasks did they remove?
- What were the selected tasks' normal tiers and decisive reasons?
- What trigger made the override necessary?
- What reason code, reason text, and evidence did the human provide?
- What establishes that the selected set is resource-feasible?
- That the actor identity is caller-asserted and not authenticated by perttool.

Human reason text may be quoted as a human assertion, but must not be presented as a project fact or normal-ranking reason. Do not mix the normal trace and override trace into one reason list.

## 15. Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `PTOVR-101` | error | The source schema/version is not understood, or the source explanation is incomplete |
| `PTOVR-102` | error | Stale request due to a mismatch in source digest/result decision |
| `PTOVR-103` | error | The selected task is non-ready, unknown, or duplicated |
| `PTOVR-104` | error | The selected set is resource-infeasible |
| `PTOVR-105` | error | The actor, decision time, reason, or evidence is invalid |
| `PTOVR-106` | error | No override is needed within normal authority |
| `PTOVR-201` | error | The artifact is stale because source/state/capacity changed at apply time |
| `PTOVR-202` | error | Mismatch among override ID, canonical record, and audit envelope |

Do not convert a validation error into a document syntax error. If read-only validation is exposed in the CLI in the future, use exit 1 for an invalid request, exit 2 for a usage error, exit 3 for an I/O error, and exit 70 for an internal invariant. Use existing exit 5 for an optimistic-lock conflict at apply time.

## 16. Conceptual examples

### 16.1 Allowed work replaces recommended work

```text
Normal:
  R = [TASK_A]
  TASK_A = recommended
  TASK_B = allowed

Human selection:
  O = [TASK_B]

Override:
  trigger = allowed_replaces_recommended
  retained = []
  displaced = [TASK_A]
  selected_nonrecommended = [TASK_B]
  startFeasible(O) = true
```

Adding TASK_B together with TASK_A is within normal authority, but removing TASK_A and selecting TASK_B alone requires an override.

### 16.2 Deferred work replaces a conflicting recommendation

```text
Normal:
  R = [TASK_A]
  TASK_B = deferred because startFeasible(R union {TASK_B}) = false

Human selection:
  O = [TASK_B]
  startFeasible(O) = true

Override trigger:
  deferred_selected
```

The override does not permit a capacity violation; it records that a human selected a replacement set that does not start TASK_A now.

### 16.3 Active allocation makes a task infeasible

```text
Normal:
  TASK_B = deferred
  startFeasible({TASK_B}) = false because ACTIVE_X occupies the resource

Human selection:
  O = [TASK_B]

Result:
  rejected with PTOVR-104
```

In this case, change the active state or capacity in the source of truth and re-analyze.

## 17. Items handed to subsequent design tasks

### `NORMATIVE_EXAMPLES`

[Normative recommendation examples](../examples/recommendation.md) fix the following.

- allowed replacement, deferred replacement, and discouraged-risk acceptance in a future model
- cases where a recommended subset and additional allowed work need no override
- rejection for non-ready, active-only conflict, and stale digest
- golden artifacts that separate normal traces from override traces
- deterministic override IDs and Git trailer verification

### `PROCESS_MIGRATION`

[Recommendation implementation and self-use migration](../process/recommendation-migration.md) fix the following.

- the order for introducing override validation as read-only
- state transitions and audit-commit procedure after the write gate
- the operational gate that prevents an AI from starting deferred/discouraged tasks without an override artifact
- secret review and commit trailer verification

## 18. Acceptance for this slice

- Separated priority judgments that human authority may override from eligibility/resource invariants that it may not.
- Defined conditions in which an override is required, not required, or impossible.
- Defined stable trigger codes and the human-reason taxonomy.
- Defined caller-asserted actors, explicit UTC times, reason text, and evidence.
- Defined a separate artifact fixed to the source recommendation.
- Defined selected, retained, and displaced tasks and normal decision references.
- Required exact resource feasibility for the replacement set.
- Defined deterministic override IDs and single-use/stale rules.
- Defined Git commit trailers as the repository-native audit default.
- Defined full re-analysis after apply and no feedback into normal ranking.
- Did not change the current CLI, write path, or Git operation.
