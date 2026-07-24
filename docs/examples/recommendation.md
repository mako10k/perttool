# Normative Recommendation Examples

- Document status: Normative 1.1
- Created: 2026-07-22
- Related requirements: [../requirements.md](../requirements.md)
- Recommendation semantics: [../specs/recommendation.md](../specs/recommendation.md)
- Ranking policy: [../specs/recommendation-ranking.md](../specs/recommendation-ranking.md)
- Reason taxonomy: [../specs/recommendation-reasons.md](../specs/recommendation-reasons.md)
- Structured explanation: [../specs/recommendation-explanation.md](../specs/recommendation-explanation.md)
- Interface contract: [../specs/recommendation-interface.md](../specs/recommendation-interface.md)
- Human override: [../specs/recommendation-override.md](../specs/recommendation-override.md)
- Related issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. Purpose

This document is a normative example that fixes small, competing snapshots and expected decisions so that semantics do not change when the Recommendation specifications are transferred to implementation and tests.

Each example distinguishes the following:

- the lifecycle's actual `ready` set `P`
- selection horizon `H`
- resource-feasible recommended set `R`
- tier for each ready task
- winner, alternative, decisive rule, and typed facts
- canonical description projection
- boundaries where a human override is not needed, needed, or impossible

Fact snapshots in tables are analysis projections derived from the existing DSL, not new DSL syntax. `NextResult.v3` is implemented and expanded into minimal `.pert` fixtures, complete JSON goldens, and text goldens with the same semantics. Read-only override validation is implemented in the public library Core and goldens, but is not a CLI command; therefore do not treat override fragments in this document as current CLI output.

## 2. Common conditions

Unless otherwise stated, every example uses the following.

```text
action                       = start
algorithm_id                 = perttool.recommendation-ranking.lexicographic-frontier
algorithm_version            = 1
reason_taxonomy_version      = 1.0
explanation_model_version    = 1
expression_version           = 1
description_registry_version = 1
description_locale           = en
critical_epsilon             = 0
explicitNegativeFact(t)      = false
policyDefers(t)              = false
```

The Version 1 normal producer does not generate `discouraged`. Ranking keys not in a fact table are equal across tasks. For examples without a resource table, `startFeasible(S) = true`.

Arrays `H` and `R` are written in scan order, but `R` is a set and does not imply an execution order among multiple tasks.

## 3. Normal recommendation

### REC-001 Compare critical paths before explicit priority

Input facts:

| Task | Classification | Critical class | Total float | Priority | Resource |
| --- | --- | --- | ---: | ---: | --- |
| `CRITICAL_FIX` | `ready` | `driving` | `0p` | 10 | none |
| `OPTIONAL_POLISH` | `ready` | `non_critical` | `3/2p` | 100 | none |

Expected decision:

```text
P = [CRITICAL_FIX, OPTIONAL_POLISH]
H = [CRITICAL_FIX]
R = [CRITICAL_FIX]

CRITICAL_FIX   tier=recommended  recommended_set_member=true
OPTIONAL_POLISH tier=allowed     recommended_set_member=false
```

In the pairwise comparison of `CRITICAL_FIX` and `OPTIONAL_POLISH`, `critical_class`, which precedes priority, is the decisive rule. Although `OPTIONAL_POLISH` is outside the horizon, it is `allowed` because `startFeasible(R union {OPTIONAL_POLISH}) = true`; do not classify it as `deferred` or `discouraged` merely because it is non-critical.

Required explanation observations:

```text
winner_task_id              = CRITICAL_FIX
alternative_task_id         = OPTIONAL_POLISH
decisive_rule_id            = critical_class
decisive_winner_fact        = driving
decisive_alternative_fact   = non_critical
primary_higher_priority_task_id(OPTIONAL_POLISH) = CRITICAL_FIX
```

This example must be able to answer why the priority-10 task was chosen over the priority-100 task: not because priority was ignored, but because an earlier critical-class comparison settled the ordering.

### REC-002 Retain ties in preceding rules and the gate-proximity decisive rule

Input facts:

| Factor | `GATE_NEAR` | `GATE_FAR` |
| --- | ---: | ---: |
| Critical class | `driving` | `driving` |
| Total float | `0p` | `0p` |
| Priority | 50 | 50 |
| New ready task count | 1 | 1 |
| New satisfied gate count | 0 | 0 |
| New reached milestone count | 1 | 1 |
| Next gate task distance | 1 | 2 |
| Finish task distance | 2 | 3 |

Both tasks belong to the same horizon. Assume resource capacity is 1 and both require 1 unit of the same resource.

Expected decision:

```text
H = [GATE_NEAR, GATE_FAR]
R = [GATE_NEAR]
GATE_NEAR tier=recommended
GATE_FAR  tier=deferred
```

The comparison retains the following.

```text
prior_tied_rule_ids = [
  critical_class,
  lower_total_float,
  higher_explicit_priority,
  higher_new_ready_count,
  higher_new_gate_count,
  higher_new_milestone_count
]
decisive_rule_id = shorter_next_gate_distance
contributing_rule_ids = [shorter_finish_distance]
```

`shorter_finish_distance` supports the winner after the decisive rule, but must not be promoted to the decisive rule. Because reaching a gate from either task's destination requires at least one unfinished task, the completion counterfactual's new-satisfied-gate count remains 0 and ties. Do not use natural language in task titles or gate reasons as gate-proximity facts.

### REC-003 A successor-unlock count becomes decisive when it is the first difference

`UNLOCK_TWO` and `UNLOCK_ONE` are equal through critical class, total float, and priority; only the number of tasks newly made ready by each individual-completion counterfactual differs.

```text
new_ready_task_count(UNLOCK_TWO) = 2
new_ready_task_count(UNLOCK_ONE) = 1
```

The expected decisive rule for the pairwise comparison is `higher_new_ready_count`. Do not count a task whose other branch of an all-incoming join remains unfinished as unlocked, and do not substitute a mere successor-edge count.

### REC-004 Recommend feasible tasks in the same horizon in parallel

Input resource snapshot:

```text
capacity(DEV) = 2
activeUsage(DEV) = 0
requirement(PARALLEL_A, DEV) = 1
requirement(PARALLEL_B, DEV) = 1
```

Both tasks are `ready`, `driving`, and in the same horizon.

Expected decision:

```text
H = [PARALLEL_A, PARALLEL_B]
R = [PARALLEL_A, PARALLEL_B]
startFeasible(R) = true
PARALLEL_A tier=recommended
PARALLEL_B tier=recommended
```

Retain candidate order for scan reproducibility, but do not create a dependency or exclusive choice requiring `PARALLEL_A` to finish before `PARALLEL_B`.

### REC-005 Explain a resource conflict with a selected task as deferred

Input resource snapshot:

```text
capacity(ENV) = 1
activeUsage(ENV) = 0
requirement(ENV_HIGH, ENV) = 1
requirement(ENV_LOW, ENV) = 1
priority(ENV_HIGH) = 20
priority(ENV_LOW) = 10
```

Both tasks are `ready`, `driving`, have total float `0p`, and belong to the same horizon. Other preceding ranking keys are equal.

Expected decision:

```text
H = [ENV_HIGH, ENV_LOW]
R = [ENV_HIGH]
ENV_HIGH tier=recommended
ENV_LOW  tier=deferred
```

Required witness for `ENV_LOW`:

```text
resource_id       = ENV
capacity          = 1
active_usage      = 0
selected_usage    = 1
required          = 1
deficit           = 1
selected blockers = [ENV_HIGH]
active blockers   = []
```

The ranking comparison's decisive rule is `higher_explicit_priority`; the tier classification's decisive reason is `recommended_set_resource_conflict`. Do not collapse them into one opaque reason.

### REC-006 Do not fabricate a ready-task winner for an active-allocation-only rejection

Input resource snapshot:

```text
capacity(ENV) = 1
activeUsage(ENV) = 1 by ACTIVE_TEST
requirement(FRONTIER_TEST, ENV) = 1
requirement(SIDE_DOCS, ENV) = 0
```

`FRONTIER_TEST` is `ready` and `driving`; `SIDE_DOCS` is `ready` and `non_critical`.

Expected decision:

```text
H = [FRONTIER_TEST]
R = []
FRONTIER_TEST tier=deferred
SIDE_DOCS     tier=allowed
```

The resource comparison for `FRONTIER_TEST` meets the following.

```text
scope               = resource_selection
subject_task_id     = FRONTIER_TEST
alternative_task_id = null
winner_task_id      = null
loser_task_id       = null
decisive_rule       = joint_resource_feasibility
active blockers     = [ACTIVE_TEST]
selected blockers   = []
```

`FRONTIER_TEST` is the higher-priority task for `SIDE_DOCS` in the ranking. Do not promote `SIDE_DOCS` to recommended because `FRONTIER_TEST` was resource-rejected; retain it as `allowed`.

### REC-007 All blocked tasks or zero ready tasks produce a normal empty result

Use a snapshot where only `TASK_BLOCKED` is `blocked_now` and there are no actual `ready` tasks.

Expected decision:

```text
P = []
H = []
R = []
task_decisions = []
startFeasible(R) = true
```

Do not omit the `recommendation` root, result decision, or the empty set's joint-feasibility fact. Text displays `RECOMMENDED SET -` and four empty tier sections, and retains `TASK_BLOCKED` in the existing `BLOCKED NOW` section. Do not generate a recommendation tier called `blocked` or a `PTREC-*` diagnostic.

## 4. Structured explanation and interface projection

### REC-008 Answer “why A and not B?” from a typed comparison

The comparison in REC-001 has at least the following meaning. This is not a JSON example that adds wire fields; it is a semantic projection representing relationships among records in complete `NextResult.v3`.

```text
comparison:
  scope              = ranking
  subject            = task:CRITICAL_FIX
  alternative        = task:OPTIONAL_POLISH
  winner             = task:CRITICAL_FIX
  loser              = task:OPTIONAL_POLISH
  decisive_rule      = policy_rule:critical_class
  prior_tied_rules   = []
  decisive_expression =
    Compare(
      fact(CRITICAL_FIX.precedence_critical_class),
      less_than,
      fact(OPTIONAL_POLISH.precedence_critical_class)
    )

facts:
  CRITICAL_FIX.precedence_critical_class =
    {type: enum, enum_type: precedence_critical_class, value: driving}
  OPTIONAL_POLISH.precedence_critical_class =
    {type: enum, enum_type: precedence_critical_class, value: non_critical}

description:
  key    = recommendation.reason.ranking_comparison
  locale = en
  text   = "CRITICAL_FIX ranks above OPTIONAL_POLISH by rule critical_class: driving less_than non_critical."
```

Actual wire records place facts in `facts[]`; comparisons refer to them with `fact_ids` and `decisive_expression`. Include record IDs, provenance, and description parameters in the complete graph according to the Interface Contract.

A consumer can compose an answer in the following order.

1. Read `primary_higher_priority_task_id` and the decisive step from the task decision.
2. Read the comparison ID from the decisive step.
3. Read the winner, alternative, rule, typed facts, and expression from the comparison.
4. Verify canonical text from the description key and typed parameters.

Do not reverse-infer rules or facts from description text alone.

### REC-009 Retain exact Rationals and canonical descriptions

When displaying supplemental total float for REC-001, the value `3/2p` for `OPTIONAL_POLISH` uses the following typed value and unit.

```json
{
  "value": {
    "type": "rational",
    "numerator": "3",
    "denominator": "2"
  },
  "unit": {
    "kind": "duration",
    "value": "point"
  }
}
```

Do not place binary floating-point `1.5` in authoritative facts; canonical text renders `3/2p`. An expression evaluates `less_than` between fact references exactly, and produces `PTREC-301` if its result and the winner do not agree.

### REC-010 Do not confuse complete JSON with a text summary

JSON for the same snapshot meets the following.

```text
explanation_status.level                   = full
explanation_status.complete                = true
explanation_status.decisive_chain_complete = true
explanation_status.truncated               = false
all omitted_counts                         = 0
```

The JSON golden includes the result decision, every ready-task decision, and steps, facts, comparisons, reasons, and descriptions that satisfy reference closure. Do not save an excerpt such as REC-008 as a complete result.

The text golden explicitly states the following as a summary projection.

```text
EXPLANATION detail=summary complete=false machine_trace="--format json"
```

Do not allow raw facts or ASTs to be reconstructed from text, and retain existing `ACTIVE`, `RUNNABLE NOW`, `READY / WAITING RESOURCE`, `BLOCKED NOW`, and `UPCOMING` sections.

Retain the fields and semantics of v2-derived `groups`, `tasks`, `tasks[].resource_rejections`, and `tasks[].explanation`. Goldens compare the v2 projection and same-named fields in v3, checking that adding the recommendation root has not changed scheduler rejections or upcoming dependency explanations.

### REC-011 Do not turn invariant failures into incomplete successful results

Make the following independent negative tests.

| Broken invariant | Expected diagnostic |
| --- | --- |
| Mismatch between tier and set membership, reference to a false expression as decisive winner, or missing reference closure | `PTREC-301` |
| Emitting a rule, reason, fact kind, or expression node not registered for the declared version | `PTREC-302` |
| Mismatch among description key, typed parameters, and canonical rendered text | `PTREC-303` |

None emit a successful `NextResult.v3`; the CLI uses internal-error exit `70`. Do not include zero ready tasks or a resource-caused empty `R` in these negative tests.

## 5. Human override

### OVR-001 An allowed task replaces a recommended task

In the normal result of REC-001, let the human selection be `O = [OPTIONAL_POLISH]`.

```text
override required                 = true
trigger_codes                     = [allowed_replaces_recommended]
retained_recommended_task_ids     = []
displaced_recommended_task_ids    = [CRITICAL_FIX]
selected_nonrecommended_task_ids  = [OPTIONAL_POLISH]
startFeasible(O)                  = true
```

Do not change normal comparisons or tiers; the override artifact refers to the normal decision, decisive step, reason, and comparison ID for `OPTIONAL_POLISH`.

### OVR-002 A feasible replacement with a deferred task is not a capacity violation

In the normal result of REC-005, let `O = [ENV_LOW]`.

```text
override required              = true
trigger_codes                  = [deferred_selected]
displaced_recommended_task_ids = [ENV_HIGH]
startFeasible(O)               = true
```

Distinguish `startFeasible(R union {ENV_LOW}) = false` from `startFeasible(O) = true`. An override does not approve exceeding capacity; it changes the replacement set to start now.

### OVR-003 Do not create an override for a selection within normal authority

The following require no override.

- a subset choosing at least one recommended task from `R` in REC-004
- a set that retains `R` in REC-001 and adds resource-feasible `OPTIONAL_POLISH`
- a decision not to start a task now

Passing either of the first two as an otherwise-valid validation request produces `PTOVR-106` and no artifact. For no task start, do not invoke validation because it does not meet the request contract requiring at least one `selected_task_ids`. Do not generate an override artifact merely to increase the audit count.

### OVR-004 Eligibility, active allocation, and stale snapshots cannot be overridden

| Input | Expected result |
| --- | --- |
| `selected_task_ids` contains a `blocked_now` or `upcoming` task | `PTOVR-103` |
| `O = [FRONTIER_TEST]` in REC-006 | `PTOVR-104` |
| The request's source digest or result decision ID mismatches the source result | `PTOVR-102` |
| Document, capacity, or task state changes after a valid artifact is generated | `PTOVR-201` at apply time |

Do not reinterpret these as success through a human reason.

### OVR-005 Discouraged risk acceptance is a reserved fixture for a future model

Taxonomy version 1.0 has no concrete negative fact kind, so fixtures that create a `discouraged` task from the current normal producer are prohibited.

When an authoritative field and concrete negative fact kind are added in a separate version in the future, enable fixtures meeting the following.

```text
normal tier                              = discouraged
override trigger                         = discouraged_selected
human reason code                        = risk_acceptance
acknowledged_negative_fact_reason_ids    = all decisive negative fact reason IDs
normal negative fact                     = unchanged
startFeasible(O)                         = true
```

Do not use a chat inference that “there may be a risk” as the negative fact for this fixture.

### OVR-006 Verify the override artifact identity and audit envelope

Fix the following as golden tests for a valid request.

1. Generate byte-identical canonical artifacts twice from the same source result and request.
2. Recalculate SHA-256 from compact JSON for the payload excluding `override_id`.
3. The recalculated value matches `override:sha256:<digest>`.
4. The actor remains `authentication=caller_asserted`, and the time remains the UTC value explicitly supplied in the request.
5. Refer to normal reasons by source record ID without copying or converting them to human reasons.
6. The same ID can be recalculated from the `Perttool-Override` and `Perttool-Override-Record` trailers in the commit message.

Until the MIG-08 override apply/audit gate is satisfied, do not apply trailers to real commits; perform only pure verification against fixture strings.

## 6. Test perspectives and fixture mapping

In the implementation slice, assign the same case IDs to at least the following test layers.

| Layer | Fixed content |
| --- | --- |
| `.pert` fixture | lifecycle, dependency, gate, duration, priority, resource, active allocation |
| Ranking unit | `P`, candidate facts, complete order, `H`, scan, `R` |
| Explanation unit | decisive chain, prior tie, contributing rule, resource witness, expression evaluation |
| Core result | tier of every ready task, reference closure, canonical ordering, byte determinism |
| JSON golden | complete `Perttool.NextResult.v3`, exact values, entity references, descriptions |
| Text golden | four-tier summary, `complete=false`, JSON route, retention of existing v2 sections |
| Invariant test | `PTREC-301` through `PTREC-303`, safe handling of unknown decisive semantics |
| Override unit | not needed, needed, impossible, deterministic IDs, single use, stale determination |

Minimum case coverage:

| Case | Ranking | Resource | Empty | Explanation | Override |
| --- | --- | --- | --- | --- | --- |
| REC-001 | critical versus priority, allowed outside horizon | none | no | higher-priority comparison | OVR-001, OVR-003 |
| REC-002 | prior tie, gate proximity, contributing | selected conflict | no | decisive chain | - |
| REC-003 | successor unlock | none | no | counterfactual fact | - |
| REC-004 | parallel recommended | jointly feasible | no | set semantics | OVR-003 |
| REC-005 | priority scan | selected blocker | no | separation of ranking and tier reasons | OVR-002 |
| REC-006 | allowed outside horizon | active-only blocker | `R=[]` | null task winner | OVR-004 |
| REC-007 | no candidate | none | `P=[]`, `R=[]` | result-level closure | - |
| REC-008..011 | - | - | - | typed comparison, Rational, projection, invariant | - |
| OVR-005 | future version only | feasible replacement | no | normal/override trace separation | discouraged acknowledgement |

Fixtures may be consolidated during implementation, but must not lose the observations in the table above. In particular, do not collapse REC-006 and REC-007 into the same empty result: separately test “a ready task exists but active allocation makes `R` empty” and “there are zero ready tasks.”

MIG-01 consists of REC-001 through REC-007 `.pert` files in `test/fixtures/recommendation/`, `cases.json` containing REC-008 through REC-011 unit inputs, and `test/golden/recommendation/v2-projection.expected.json`. Fixture baselines separate future expected decisions from the current `NextResult.v2` projection and do not change the public schema or text before v3 publication.

MIG-02 consists of the private ranking pure Core in `src/recommendation/` and `test/recommendation-ranking.test.mjs`. In addition to REC-001 through REC-007 candidate facts, selection horizons, recommended sets, tiers, and resource witnesses, it fixes all ranking rules, near-critical/minimum-float horizons, and capacity overrides.

MIG-03 consists of `src/recommendation/explanation*.ts` and `test/recommendation-explanation.test.mjs`. It builds exact typed facts, restricted expressions, minimal comparisons, decision traces, reason occurrences, and canonical English descriptions from MIG-02 results; it maps reference/tier/expression invariants to `PTREC-301`, version/rule/code/fact invariants to `PTREC-302`, and description invariants to `PTREC-303`. It fixes REC-001 through REC-011, active-only rejection, zero ready tasks, and fail-closed behavior, but does not treat this private Core as public `NextResult.v3` until MIG-04.

MIG-04 consists of `src/application/next.ts`, `src/recommendation/json.ts`, `src/cli.ts`, `src/index.ts`, help, `test/recommendation-publication.test.mjs`, and v3 JSON/text goldens. It fixes public `NextResultV3`, Core/CLI parity, the complete empty graph, the four-tier summary, byte determinism, prevention of partial PTREC results, retention of the v2 operational projection, and the package-installed API/CLI. Consumers follow the [migration guide](../process/next-v3-consumer-migration.md), checking the schema and decisive semantics first.

## 7. Acceptance

- Fixed critical versus priority, unlocks, gate proximity, and parallel recommendations.
- Separated selected blockers from active-only blockers.
- Fixed cases that do not automatically promote allowed work outside the horizon to the first candidate.
- Separated zero ready tasks from a resource-caused empty recommended set.
- Fixed winners, alternatives, decisive rules, prior ties, and contributing rules.
- Fixed observations for exact Rationals, typed entities, expressions, and canonical descriptions.
- Separated responsibilities between complete JSON and summary text.
- Fixed retention of v2 fields and negative tests for `PTREC-301` through `PTREC-303`.
- Fixed no override, allowed/deferred replacement, impossible, stale, and audit identity cases.
- Did not fabricate `discouraged` in the current version and fixed conditions for enabling future fixtures.
- Did not change override apply, the write path, or provider-specific adapters.
