# Recommendation Ranking Policy Specification

- Document status: Normative 1.0
- Created: 2026-07-22
- Algorithm ID: `perttool.recommendation-ranking.lexicographic-frontier`
- Algorithm version: `1`
- Scope: deterministic selection of a recommended set for the AI Project Control Plane
- Structured explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Human override: [recommendation-override.md](recommendation-override.md)
- Temporal deadline semantics: [temporal-deadline.md](temporal-deadline.md)
- Related issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. Purpose

This specification fixes a ranking policy that deterministically selects the set `R` recommended to start in the current cycle from the actual `ready` task set `P` defined by the [Recommendation Semantics Specification](recommendation.md).

It defines:

- the ranking domain and typed facts obtained from the project model;
- priority rules for critical path, float, explicit priority, downstream unlocks, gates, and milestone distance;
- the selection horizon for recommendations;
- joint resource feasibility including active allocations;
- empty sets and parallel recommendations of multiple tasks;
- complete tie-breaking and algorithm identity;
- a non-cyclic boundary from the current resource scheduler and `runnable_now`; and
- winners, alternatives, and decisive rules passed to the downstream decision trace.

This policy is a deterministic heuristic and does not prove a global optimum for resource-constrained project completion.

## 2. Normative position

Resolve conflicts of meaning or design in the following order:

1. Must requirements in [Requirements](../requirements.md)
2. [Recommendation Semantics Specification](recommendation.md)
3. this specification
4. [Analysis Specification](analysis.md)
5. [Graph Semantics Specification](graph-semantics.md)
6. `docs/basic-design.md`, examples, tests, help, and implementation

This specification does not redefine recommendation tiers. The formal ordering in the Recommendation Semantics Specification determines the `recommended`, `allowed`, `deferred`, and `discouraged` classifications after selecting `R`.

## 3. Scope

In scope:

- a single valid project snapshot;
- decisions to newly `start` actual `ready` tasks;
- facts deterministically derivable from precedence CPM and the project graph;
- applied capacity, active allocations, and task requirements; and
- recommended-set selection within one analysis request.

Out of scope:

- continuing, interrupting, or cancelling active tasks;
- optimizing a resource schedule that includes future events;
- recommendation weight tuning, learning, or probabilistic scores;
- reason-code taxonomy and structured-expression schema;
- Core types, CLI, JSON, text layout, and schema migration;
- persistence of human overrides;
- ranking across multiple projects or macro/detail plans;
- ranking that infers meaning from titles, descriptions, tags, owners, sources, or chat history;
- inference of release-specific semantics, rework risk, information insufficiency, planned replacement, or the business importance of arbitrary milestones; and
- recommendation implementation.

Grammar version 1 has no normative fields for release, rework risk, or information sufficiency. IDs such as `RELEASE`, titles, tags, and natural-language descriptions MUST NOT be interpreted and converted into ranking facts.

## 4. Algorithm identity and determinism

The algorithm identity for version 1 is:

```text
algorithm_id      = perttool.recommendation-ranking.lexicographic-frontier
algorithm_version = 1
optimal           = false
```

The same canonical document, analysis options, applied capacity, critical epsilon, and algorithm ID/version MUST produce the same candidate facts, candidate order, selection horizon, `R`, and comparisons.

The following changes require an algorithm-version change:

- adding, removing, or reordering ranking keys;
- changing the selection-horizon conditions;
- changing the definition of counterfactual unlocks or distance;
- changing the resource-selection scan; or
- changing the string-comparison rule for tie-breaking.

Changes only to description wording, renderer layout, or field encoding are subject to versioning in the [Recommendation Interface Contract Specification](recommendation-interface.md) and do not automatically change the ranking algorithm version.

## 5. Ranking domain

Let `P` be the actual `ready` task set defined by the Recommendation Semantics Specification.

```text
P = { t | classification(t) == ready }
```

Let `N` be the task set with explicit negative facts, and let `C` be the normal ranking candidates.

```text
N = { t in P | explicitNegativeFact(t) == true }
C = P - N
```

Because grammar version 1 has no authoritative field for `explicitNegativeFact`, `N` is always empty for a version 1 document. If a future fact model makes `N` nonempty, update the normative specification for that fact and the ranking algorithm version.

- `active`, `blocked_now`, `upcoming`, `done`, and gates are not included in `P`.
- Insufficient capacity does not exclude a task from the candidates.
- Tasks without resource requirements are also included in `C`.
- If `C` is empty, both the selection horizon and `R` are empty.

## 6. Ranking input facts

### 6.1 Authoritative input

Use only the following facts for ranking each candidate `t`.

| Fact | Type | Derived from |
| --- | --- | --- |
| `precedence_total_float` | exact Rational | precedence CPM |
| `precedence_critical_class` | `driving | near_critical | non_critical` | total float and project `critical_epsilon` |
| `explicit_priority` | Integer | task `priority`; 0 if omitted |
| `new_ready_task_count` | nonnegative Integer | completion counterfactual in §6.2 |
| `new_satisfied_gate_count` | nonnegative Integer | completion counterfactual in §6.2 |
| `new_reached_milestone_count` | nonnegative Integer | completion counterfactual in §6.2 |
| `next_gate_task_distance` | nonnegative Integer or `infinity` | residual-graph distance in §6.3 |
| `finish_task_distance` | nonnegative Integer | residual-graph distance in §6.3 |
| `expected_duration` | exact Rational | effective duration in the Analysis Specification |
| `task_id` | Identifier | canonical entity ID |
| `requirements` | map from resource ID to positive Integer | resolved requirements |

Set selection additionally uses the applied-capacity map, active usage for each resource, and active task IDs. When a capacity override is specified, use applied capacity rather than declared capacity.

Define `precedence_critical_class(t)` as follows. Total float is nonnegative in a valid analysis.

```text
driving       if precedence_total_float(t) == 0
near_critical if 0 < precedence_total_float(t) <= critical_epsilon
non_critical  otherwise
```

When `critical_epsilon = 0`, `near_critical` does not exist. Recognize near-critical tasks as in user-facing criticality determinations, but do not equate them with exact driving tasks.

### 6.2 Completion counterfactual

Derive downstream-unlock facts from a local counterfactual in which only candidate `t` completes in the current snapshot. Do not advance duration, progress of other tasks, or resource-release events.

1. Let `R*` be the current effective reached set.
2. Mark only `t` as satisfied with status `done`.
3. Do not change the status of other tasks or the stored state of milestones.
4. Apply the all-incoming rule and gate closure from the Graph Semantics Specification to a fixed point, obtaining `R*t`.

Define:

```text
new_reached_milestones(t) = R*t - R*

new_reached_milestone_count(t) = size(new_reached_milestones(t))

new_ready_tasks(t) = {
  u |
  u != t and
  status(u) == planned and
  src(u) in R*t and
  src(u) not in R*
}

new_ready_task_count(t) = size(new_ready_tasks(t))

new_satisfied_gates(t) = {
  g |
  kind(g) == gate and
  src(g) in R*t and
  src(g) not in R*
}

new_satisfied_gate_count(t) = size(new_satisfied_gates(t))
```

If another branch of an all-incoming join is unfinished, do not count milestones and downstream tasks that `t` alone does not reach as unlocks. Do not count blocked tasks in `new_ready_tasks`. `new_satisfied_gate_count` is the structural effect of explicit dependency gates; it does not represent business meaning such as release approval or quality gates.

### 6.3 Structural distance

Compute distance on the residual graph from candidate `t`'s destination milestone toward the project finish. Gates and retained `done` tasks have cost 0; all other unfinished task edges have cost 1.

```text
edgeTaskCost(e) = 0  if kind(e) == gate or status(e) == done
                  1  otherwise

finish_task_distance(t) =
  minimum sum(edgeTaskCost(e)) over paths dst(t) -> project.finish
```

In a valid graph, the finish is reachable, so `finish_task_distance` is finite.

`next_gate_task_distance(t)` is the minimum unfinished-task-edge cost from `dst(t)` until traversing the first gate edge. It is 0 if a gate is traversed directly from `dst(t)`, and `infinity` if there is no downstream gate. In comparisons, every finite value precedes `infinity`.

Distance is a count of unfinished tasks, not edges, and does not score duration twice. Natural language in milestone titles or gate reasons does not affect distance.

### 6.4 Excluded analysis facts

Version 1 does not use the following as ranking inputs:

- scheduled start or finish in the resource schedule;
- resource wait, resource arc, schedule float, or schedule critical path;
- resource makespan, utilization, or peak usage;
- current `runnable_now` membership or scheduler scan position;
- PERT variance, target duration, or velocity forecast; or
- `not_before`, task or milestone deadline, projected calendar value, deadline
  margin or lateness, and deadline assessment; or
- owner, tag, description, blocked reason, or source text.

Even if these are displayed in the future as supporting information, they MUST NOT change the version 1 ranking.

## 7. Complete candidate order

Compare candidates in ascending order of the following tuple.

```text
(
  critical_class_rank,
  precedence_total_float,
  -explicit_priority,
  -new_ready_task_count,
  -new_satisfied_gate_count,
  -new_reached_milestone_count,
  next_gate_task_distance,
  finish_task_distance,
  -expected_duration,
  task_id
)
```

Set `critical_class_rank` to `driving = 0`, `near_critical = 1`, and `non_critical = 2`. Compare Rationals exactly; do not use display decimals. A negative Integer indicates the comparison direction "larger values first" and does not require conversion to a machine integer that could overflow. Compare `task_id` in ASCII code-point lexical order for grammar Identifiers, not by UTF-8 byte sequence or locale collation.

This tuple is a complete order. The final `task_id` always orders distinct tasks.

The priority rules mean:

1. exact driving tasks precede near-critical and non-critical tasks;
2. within the same critical class, tasks with lower total float precede;
3. with the same schedule slack, tasks with higher human-specified priority precede;
4. tasks that alone newly make more tasks ready precede;
5. tasks with greater direct effects on dependency gates and milestone closure precede;
6. tasks structurally closer to the next gate and finish milestone precede;
7. if still tied, tasks with greater expected duration precede as a longest-processing-time heuristic; and
8. finally, task ID stabilizes the order.

This order does not create an opaque composite score. The first differing key uniquely determines the reason for a comparison.

## 8. Selection horizon

The selection horizon is the boundary that limits recommendations to the most urgent cohort in the current schedule rather than automatically promoting every ready task to `recommended`.

When candidate set `C` is nonempty, let `k` be the best critical-class value.

```text
k = minimum critical_class_rank(t) for t in C
```

Define horizon `H` as follows.

```text
if k in {driving, near_critical}:
  H = { t in C | critical_class_rank(t) == k }
else:
  f = minimum precedence_total_float(t) for t in C
  H = { t in C | precedence_total_float(t) == f }
```

Thus, if actual ready tasks include exact driving tasks, all exact driving tasks belong to the same horizon. If there are no exact driving tasks but there are near-critical tasks, all near-critical tasks belong to it. If neither exists, the tasks with minimum total float belong to it.

Being outside the horizon alone MUST NOT be grounds for `policyDefers(t)`. Version 1 has no additional explicit defer rule, and `policyDefers(t)` is `false` for every task in normal analysis. A task outside the horizon is `allowed` if individually adding it to `R` is resource-feasible, or `deferred` if it conflicts.

The selection horizon concerns only new starts at snapshot time 0. It does not forecast candidates after future resource release, the horizon after active-task completion, or start order over the entire project duration.

## 9. Recommended set selection

### 9.1 Resource feasibility

Use `startFeasible(S)` from the [Recommendation Semantics Specification](recommendation.md).

```text
for every resource r:
  activeUsage(r) + sum(requirement(t, r) for t in S) <= appliedCapacity(r)
```

Do not convert resource requirements into precedence. A candidate may be unable to start now because of active usage even if its requirement does not exceed applied capacity.

### 9.2 Deterministic scan

Select `R` as follows.

```text
R = empty ordered selection

for t in sort(H, complete candidate order):
  if startFeasible(R union {t}):
    append t to R
  else:
    record rejection snapshot for t

recommended_set = task IDs in R
```

`recommended_set` denotes a set and does not impose an implicit execution order between multiple recommended tasks. Preserve scan order so that selection and explanations can be reproduced.

This selection guarantees that:

- `R` is a subset of `P`;
- `R` as a whole is jointly feasible, including active allocations;
- after the scan, `R` is inclusion-maximal with respect to `H`;
- `R` is not guaranteed to optimize task count, total priority, resource makespan, or project completion; and
- tasks outside the horizon are not automatically added to `R`, even when resources are available.

## 10. Empty sets and parallel recommendations

`R` can be empty when:

- `P` is empty;
- `C` is empty; or
- every task in `H` is not resource-feasible now because of applied capacity and active allocations.

If `H` contains one or more tasks without resource requirements, each such task is always included in `R`. When tasks in `H` use different resources or can coexist within capacity, multiple tasks are `recommended` concurrently.

A parallel recommendation means "can start concurrently and belongs to the same selection horizon." It neither adds dependencies between tasks nor means that selecting exactly one task is exclusive.

Even if `R` is empty, do not automatically promote a feasible task outside the horizon to `recommended`. That task can be `allowed` according to the Recommendation Semantics Specification. This distinguishes the fact that the first schedule candidate is waiting for resources from work that can start with surplus resources.

## 11. Connection to tier classification

Because `explicitNegativeFact(t)` and `policyDefers(t)` are always false in version 1, the normal tiers for ready tasks are:

```text
if t in R:
  recommended
else if startFeasible(R union {t}):
  allowed
else:
  deferred
```

Version 1 does not produce `discouraged`. Until a normative negative fact is added in the future, an implementation MUST NOT return `discouraged` based on inferred risk or release meaning.

The `allowed` determination is a counterfactual that individually adds each task to `R`. It does not guarantee that multiple allowed tasks can be started together.

## 12. Non-cyclic boundary from the current scheduler

The current scheduler, `parallel-sgs` version 1, and `runnable_now` are not inputs to this policy.

```text
precedence CPM facts ─┐
project graph facts  ├─> recommendation ranking ─> R
current capacity     ┘

precedence CPM facts ─┐
project graph facts  ├─> parallel-sgs v1 ─> resource schedule / runnable_now
current capacity     ┘
```

- Do not derive `R` from scheduler candidate order.
- Do not use `runnable_now` membership as a ranking key.
- Do not feed scheduler resource arcs, schedule critical path, or resource waits back into ranking.
- Do not inject `R` as hard precedence into the resource schedule.
- Introducing `R` does not change the meaning of current `runnable_now` or scheduler version 1.

Using resource-schedule criticality as a ranking input would create a cycle in which candidate order changes the schedule and changed schedule criticality changes candidate order again. Version 1 explicitly prohibits this.

If resource-schedule facts are adopted in the future, first fix a baseline scheduler independent of recommendations, or normatively define an iterative algorithm with a convergence condition as another version. Do not merely add the current schedule result to version 1.

## 13. Output contract for the decision trace

This section defines the semantic inputs passed to the [Recommendation Structured Explanation Specification](recommendation-explanation.md). It does not fix JSON field names or a serialization schema.

### 13.1 Stable rule IDs

Assign the following stable rule IDs to candidate-comparison keys.

| Order | Rule ID | Winner condition |
| ---: | --- | --- |
| 1 | `critical_class` | higher critical class |
| 2 | `lower_total_float` | lower exact total float |
| 3 | `higher_explicit_priority` | higher priority |
| 4 | `higher_new_ready_count` | greater number of newly ready tasks |
| 5 | `higher_new_gate_count` | greater number of newly satisfied gates |
| 6 | `higher_new_milestone_count` | greater number of newly reached milestones |
| 7 | `shorter_next_gate_distance` | fewer tasks to the next gate |
| 8 | `shorter_finish_distance` | fewer tasks to the finish |
| 9 | `longer_expected_duration` | greater expected duration |
| 10 | `task_id_tiebreak` | lower task ID in ASCII lexical order |

Use `joint_resource_feasibility` for resource selection and `selection_horizon` for the selection horizon. These are rule IDs that identify ranking decisions, not reason-code taxonomy.

### 13.2 Pairwise comparison

For any distinct candidates `a` and `b`, the one earlier in complete candidate order is the `winner`, and the later one is the `alternative`. `decisive_rule` is the rule ID for the first differing key in the tuple. Earlier equal keys and later keys that support the winner may be retained as `supporting_rules`, but MUST NOT be confused with the decisive rule.

Comparison input MUST preserve at least the following meanings.

```text
winner_task_id
alternative_task_id
decisive_rule_id
decisive_winner_fact
decisive_alternative_fact
supporting_rule_ids
```

Facts retain the types and exact values in §6. Do not pass natural-language descriptions as fact values.

### 13.3 Per-task selection decision

For every ready task, the following MUST be passed to the downstream decision trace:

- whether it is a candidate or excluded by a negative fact;
- critical class and horizon membership;
- complete ranking key and scan position;
- whether it was selected into `R`;
- for tasks in the horizon: active usage, earlier selected usage, available capacity, required capacity, and deficit immediately before selection;
- `startFeasible(R union {t})` used for tier classification;
- for tasks outside the horizon: pairwise comparison with the first task in the horizon; and
- for tasks in the horizon rejected for resources: earlier selected conflicting tasks and active blockers.

For a resource rejection, the ready-task winner is the first task by lexical order of deficient resource ID, scan order of earlier selected tasks occupying that resource, and task ID. When a deficit arises only from the aggregate of multiple tasks, retain all contributors. When active allocations alone cause rejection, do not fabricate a ready-task winner: make `winner_task_id` inapplicable, and use the active-blocker task IDs and `joint_resource_feasibility` as the decisive reason.

The comparison winner for a task outside the horizon is the first task in `sort(H)`. Even if that task was not selected into `R` because of active resources, distinguish that it is a ranking winner, not a selected task.

### 13.4 Distinguishing winner from selection

`winner` represents a task preferred in a pairwise ranking or resource-allocation decision and does not necessarily mean `recommended` membership. Downstream models MUST distinguish at least:

- the ranking winner;
- horizon membership;
- a task selected by the resource scan; and
- the final recommendation tier.

Therefore, even when the first candidate is waiting for active resources and `R` is empty, the ranking and resource facts can explain why another task is `allowed` rather than `recommended`.

## 14. Re-analysis and cache boundary

Recompute ranking facts, horizon, `R`, and comparisons after any of the following changes:

- task start, completion, block, or unblock;
- milestone state or effective reached closure;
- dependency, gate, or finish milestone;
- duration, estimate, priority, or requirement;
- resource capacity or capacity override;
- `critical_epsilon`; or
- ranking algorithm version.

If results are cached, condition the cache on canonical source digest, analysis options, applied-capacity map, precedence-analysis version, and ranking algorithm ID/version. Do not reuse only an old `R` for a new snapshot.

## 15. Version 1 non-goals and future extensions

Version 1 prioritizes a bounded heuristic explainable only from explicit facts. The following require a future fact model or another algorithm version:

- business distinction between release gates and ordinary dependency gates;
- using task or milestone deadline facts defined by the
  [Temporal Deadline Semantics specification](temporal-deadline.md);
- rework or replacement risk and information sufficiency;
- exact resource-constrained completion optimization;
- iterative ranking using resource-schedule criticality;
- priority across backlogs, sprints, or macro/detail composition; and
- learning weights from empirical outcomes.

An AI MUST NOT compensate for the absence of these facts through inference or natural-language interpretation.

## 16. Acceptance for this slice

- The ranking domain is limited to actual ready tasks.
- Typed facts available in version 1 and excluded facts are enumerated.
- Complete priority rules for critical class, float, priority, unlocks, gates, and milestone distance are defined.
- The selection horizon and the possibility of `allowed` outside it are defined.
- The deterministic scan for the recommended set and joint resource feasibility are defined.
- Empty sets and parallel recommendations are defined.
- Complete tie-breaking through task ID is fixed.
- The algorithm ID/version and conditions requiring a version change are fixed.
- Cycles involving the scheduler, schedule criticality, and `runnable_now` are excluded.
- The contract passing winner, alternative, and decisive rule to the structured decision trace is defined.
- Release semantics, rework risk, and information insufficiency are not inferred.
- The current interface and implementation are not changed.
