# Recommendation Semantics Specification

- Document status: Normative 1.0
- Created: 2026-07-22
- Scope: execution eligibility and recommendation model for the AI Project Control Plane
- Ranking policy: [recommendation-ranking.md](recommendation-ranking.md)
- Reason taxonomy: [recommendation-reasons.md](recommendation-reasons.md)
- Structured explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Human override: [recommendation-override.md](recommendation-override.md)
- Related issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. Purpose

This specification defines the task state and resource selection currently returned by `dag next`, and recommendations to be added in the future, as distinct concepts.

It fixes the following:

- the action and task set to which recommendations are evaluated;
- the separation of lifecycle/eligibility, resource selection, and recommendation tiers;
- the formal meanings of `recommended`, `allowed`, `deferred`, and `discouraged`;
- the decision not to use `blocked` as a recommendation tier;
- consistency with `active`, `ready`, `blocked_now`, `upcoming`, and `done`;
- invariants for recommending multiple tasks concurrently;
- the boundary between human override and re-analysis; and
- responsibilities passed to ranking, reason codes, structured explanations, and the interface.

This specification is the semantic contract for recommendations. It was implemented in `Perttool.NextResult.v3` by MIG-04 on 2026-07-23, but it does not reinterpret existing classifications or `runnable_now` as recommendation tiers.

## 2. Normative position

Resolve conflicts in meaning or design in the following order:

1. Must requirements in `docs/requirements.md`
2. This specification
3. [Analysis Specification](analysis.md)
4. [CLI Interface Specification](interfaces.md)
5. `docs/basic-design.md`
6. examples, tests, help, and implementation

The terms `ready`, `blocked_now`, and effectively reached in this specification rely on the [Graph Semantics Specification](graph-semantics.md); precedence/resource analysis and `runnable_now` rely on the [Analysis Specification](analysis.md).

## 3. Scope

In scope:

- deciding whether to start a new task in a single project snapshot;
- unfinished tasks derived from the current frontier;
- current resource capacity including active allocations;
- recommendations based only on facts explicitly represented by the project model; and
- decision authority usable with the same meaning by AI and humans.

Out of scope:

- deciding whether to continue, interrupt, or cancel an active task;
- ranking input precedence, weights, and tie-breaks;
- the reason-code inventory and structured-expression schema;
- Core/CLI fields, JSON schema, text layout, options, and exit codes;
- a command for persisting overrides and audit storage;
- multiple plans, backlogs, and macro/detail composition in Issue #3;
- inferring rework risk, insufficient information, or release-specific meaning that is absent from the project model; and
- implementing recommendations.

## 4. Three orthogonal decisions

### 4.1 Lifecycle / eligibility classification

The existing classifications represent the task's process state.

| Classification | Meaning |
| --- | --- |
| `active` | Already in progress |
| `ready` | Can become a candidate for a new start based on precedence and status |
| `blocked_now` | Its source is reached, but it is externally blocked |
| `upcoming` | Its source milestone has not been reached |
| `done` | Completed. Not included as a task candidate in a Next result |

Do not replace these classifications with recommendation tiers.

### 4.2 Resource selection

`runnable_now` is the jointly feasible set of ready tasks selected in the current scheduler candidate order after subtracting active allocations. It is not a classification enum; it is orthogonal membership for ready tasks.

`runnable_now=false` does not mean that the task can never be executed. Even in the same snapshot, it may be possible to start it under resource constraints if the task set selected first changes.

### 4.3 Recommendation tier

A recommendation tier represents the decision authority that the project control plane gives to a new-start action. It takes eligibility, resource capacity, and process priority as inputs, but is not another name for any of them.

The conceptual set of tiers is:

```text
recommended | allowed | deferred | discouraged
```

It does not include `blocked`. Reasons that work is infeasible or unreached are represented through the existing classifications and resource facts.

## 5. Evaluation domain

The MVP action evaluated by recommendations is only `start`.

The task set `P` evaluated for recommendations is the actual set of `ready` tasks.

- `active`: has no recommendation because it is not a new-start action
- `ready`: always has exactly one recommendation tier
- `blocked_now`: has no recommendation
- `upcoming`: has no recommendation
- `done`: is not included in the result

In JSON, in accordance with the [Recommendation Interface Contract Specification](recommendation-interface.md), include only actual ready tasks in `task_decisions`; do not generate a tier field for non-ready tasks. Do not add `not_recommended` or `blocked` as convenience tiers.

## 6. Resource feasibility

Let the declared capacity of resource `r` be `capacity(r)`, usage by active tasks be `activeUsage(r)`, and the requirement of ready task `t` be `requirement(t, r)`.

For a ready-task set `S`, `startFeasible(S)` holds if all of the following hold:

```text
for every resource r:
  activeUsage(r) + sum(requirement(t, r) for t in S) <= capacity(r)
```

A task without a resource requirement requires 0 of that resource.

Let `R` be the recommended set selected by the recommendation ranking policy. `R` must at least satisfy:

```text
R is a subset of P
startFeasible(R) == true
```

Do not count the same task more than once. Do not include active tasks in `R`; subtract them from capacity as `activeUsage`.

The selection rules for `R`, conditions allowing an empty set, complete tie-breaks, and the algorithm version are fixed by the [Recommendation Ranking Policy Specification](recommendation-ranking.md).

The Ranking Policy also defines `policyDefers(t)`, an explicit decision to not additionally start ready task `t` in the current cycle and to send it to a later cycle. In Version 1 this is false for every task, retaining resource-feasible tasks outside the selection horizon as `allowed`.

## 7. Tier semantics

### 7.1 `recommended`

Task `t` is `recommended` if `t in R`.

- It is the first candidate for an AI to start in the current cycle.
- Starting the entire `recommended` task set concurrently does not exceed resource capacity.
- Multiple tasks can be recommended.
- Do not impose an implicit order between multiple recommended tasks.
- A recommendation does not prove a global optimum.

### 7.2 `allowed`

Task `t` is `allowed` if all of the following hold:

```text
t is in P
t is not in R
startFeasible(R union {t}) == true
explicitNegativeFact(t) == false
policyDefers(t) == false
```

- It can be started as additional work without obstructing the recommended set on resources.
- It is not permission to replace or defer recommended work.
- Each allowed task is guaranteed only to be individually addable to `R`.
- It is not guaranteed that a set of multiple allowed tasks added concurrently is feasible.
- Update state and re-analyze every time a task is started.

When an AI selects an allowed task instead of a recommended task, treat it as a human override. When it selects an allowed task with additional capacity while retaining recommended work, no override is required.

### 7.3 `deferred`

Task `t` is `deferred` if it is ready but is neither `recommended`, `allowed`, nor `discouraged`.

Typical conditions:

- it conflicts with the recommended set for resource capacity;
- it cannot be started in the current cycle without replacing higher-ranked work; or
- it is outside the selection horizon defined by the Ranking Policy.

`deferred` is a temporary process decision. Re-evaluate it after project state, capacity, active allocation, or ranking inputs change. An AI must not select it without human override.

### 7.4 `discouraged`

Task `t` is `discouraged` if it is ready and an explicit negative fact in the project model negates starting it now.

- Do not mark it discouraged merely because it is non-critical, has large float, or has low priority.
- Do not treat chat context, AI inference, or implementation interest as a negative fact.
- An AI must not select it without human override.
- Even during an override, retain and display the negative fact with the decision rationale.

Grammar version 1 has no authoritative fields for rework risk, replacement intent, information sufficiency, or release-specific semantics. Therefore, do not generate `discouraged` on those grounds. Interface v1 includes `discouraged` in the JSON enum in preparation for modeled negative facts in the future, but the normal producer for Taxonomy version 1.0 does not generate it.

## 8. Formal classification order

In normal analysis, classify every ready task `t` uniquely in the following order:

```text
if t is in R:
  recommended
else if explicitNegativeFact(t):
  discouraged
else if policyDefers(t):
  deferred
else if startFeasible(R union {t}):
  allowed
else:
  deferred
```

The Ranking Policy must not include a task with an explicit negative fact in `R` during normal analysis. Represent results produced by applying a human override separately from the normal recommendation.

Return the same `R` and tiers for the same snapshot, capacity override, and ranking algorithm version.

## 9. Classification consistency matrix

| Existing state | Recommendation applicability | Start authority |
| --- | --- | --- |
| `active` | Not applicable | Subject to continuation policy; do not newly start it |
| `ready` + `recommended` | Applicable | AI may select it |
| `ready` + `allowed` | Applicable | AI may select it as additional work that retains recommendations |
| `ready` + `deferred` | Applicable | Human override required |
| `ready` + `discouraged` | Applicable | Human override with the negative fact required |
| `blocked_now` | Not applicable | Do not start until the block is resolved |
| `upcoming` | Not applicable | Do not start until its predecessor is achieved |
| `done` | Not applicable | Do not include it in the result |

The absence of a tier on a ready task, or the presence of a tier on a non-ready task, is an analysis invariant failure.

## 10. Relationship to `runnable_now`

Let the current `runnable_now` set be `L` and the future recommended set be `R`.

- `L` is a resource-feasible subset obtained using the current scheduler candidate order.
- `R` is a preferred, resource-feasible subset obtained using the Ranking Policy.
- `L` and `R` need not be equal.
- Do not silently reinterpret `runnable_now` in `Perttool.NextResult.v2` in order to introduce `R`.
- If `L` and `R` differ, return a structured explanation of which tasks were substituted and the rules and facts used to decide it.

The [Recommendation Interface Contract Specification](recommendation-interface.md) is authoritative for backward compatibility, schema version, field names, and default text rendering. Do not change current CLI output until recommendations are implemented.

## 11. Explainability invariant

A recommendation must not be considered complete merely because it returns a tier.

For every ready task, require a model capable of explaining at least the following:

- the ranking rule applied;
- typed facts obtained from the project model;
- comparison between selected tasks and alternative tasks;
- the distinction between decisive and supporting rules;
- why it was or was not included in the recommended set;
- higher-ranked task IDs;
- resource feasibility or conflict; and
- stable keys and parameters from which human-facing descriptions are derived.

The [Recommendation Reason Taxonomy Specification](recommendation-reasons.md) is authoritative for reason codes and typed fact categories; the [Recommendation Structured Explanation Specification](recommendation-explanation.md) is authoritative for the restricted expression AST, decision trace, and description projection; and the [Recommendation Interface Contract Specification](recommendation-interface.md) is authoritative for concrete Core types, text/JSON fields, and schema migration. Natural-language text alone must not be the authoritative reason.

## 12. Human override boundary

In this specification, a human override means any of the following:

- selecting an allowed task instead of recommended work;
- starting a deferred task now; or
- starting a discouraged task with knowledge of its negative fact.

An override does not retroactively change the normal recommendation. The [Recommendation Human Override Contract Specification](recommendation-override.md) fixes the conditions that require or do not require an override, feasible replacement sets, caller-asserted actor, human reason, Git audit artifacts, single use, and re-analysis after an override. An override does not bypass non-ready tasks or capacity violations.

## 13. Re-analysis

Do not reuse an old recommendation after any of the following changes; re-analyze the complete document:

- task start, completion, block, or unblock;
- milestone reach or advance;
- capacity override or resource declaration;
- task priority, duration, dependency, or requirement;
- human override; or
- ranking algorithm version.

A recommendation result is conditioned on the source digest, capacity options, and algorithm version. The concrete fields are fixed by the [Recommendation Interface Contract Specification](recommendation-interface.md).

## 14. Inputs to follow-on design tasks

### [`RANKING_POLICY`](recommendation-ranking.md)

- project facts and priority rules for choosing `R`;
- selection horizon;
- conditions for an empty set and multiple recommendations;
- complete tie-breaks and algorithm version; and
- migration from the current scheduler order.

### [`REASON_CODE_TAXONOMY`](recommendation-reasons.md)

- stable reason codes for assigning tiers and selecting a set;
- supporting, opposing, and blocking polarity; and
- fact IDs and treatment of unmodeled facts.

### [`STRUCTURED_EXPLANATION_MODEL`](recommendation-explanation.md)

- typed facts;
- a restricted expression AST;
- winner/alternative comparison;
- decisive/supporting rules; and
- description keys, parameters, and derived text.

### [`INTERFACE_CONTRACT`](recommendation-interface.md)

- Core types and JSON schema;
- migration from `NextResult.v2`;
- text sections and ordering; and
- explanation level, size limit, and truncation.

### [`HUMAN_OVERRIDE_CONTRACT`](recommendation-override.md)

- correspondence between tiers and override requirements;
- override reason and audit; and
- write boundary and re-analysis.

## 15. Acceptance for this slice

- Eligibility and recommendation are defined as separate axes.
- `runnable_now` and the recommended set are not treated as identical.
- Recommendation evaluation is limited to the start action for ready tasks.
- The formal meaning and authority of four tiers are defined.
- `blocked` is excluded from recommendation tiers.
- Non-applicability to `active`, `blocked_now`, `upcoming`, and `done` is defined.
- Joint resource feasibility for the recommended set is defined.
- Individual addition of allowed tasks is distinguished from adding multiple tasks simultaneously.
- `discouraged` is restricted to explicit negative facts.
- Explainability, override, and re-analysis are connected to follow-on contracts.
- The current CLI/JSON is unchanged.
