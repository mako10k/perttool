# perttool Analysis Specification

- Document status: Draft 0.6
- Analysis version: 1
- Scheduler: `parallel-sgs` version 1
- Created: 2026-07-21
- Updated: 2026-07-25
- Related requirements: [../requirements.md](../requirements.md)
- Graph semantics: [graph-semantics.md](graph-semantics.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Recommendation explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Temporal calendar semantics: [temporal-calendar.md](temporal-calendar.md)
- Temporal deadline semantics: [temporal-deadline.md](temporal-deadline.md)
- Accepted Grammar 8 temporal successor: [temporal-schedule.md](temporal-schedule.md)
- Unit migration semantics: [unit-migration.md](unit-migration.md)
- Grammar specification: [dsl-grammar.md](dsl-grammar.md)
- Related basic design: [../basic-design.md](../basic-design.md)

## 1. Purpose

This document is the normative specification for deterministically calculating the following from a valid perttool graph.

- Duration, PERT expected value, and variance using exact Rational values
- Forward and backward passes for precedence-only CPM
- Total float, free float, the critical subgraph, and a representative critical path
- A feasible schedule that respects renewable resource capacity
- `runnable_now` and explanations of insufficient resources
- Resource-release witness arcs supporting capacity of 2 or greater and multiple resources
- The schedule constraint graph and schedule critical path, including resource waits
- Rounding, tie-breaking, path counts, and diagnostics

Return the ordinary precedence critical path and the schedule critical path of the selected resource schedule as separate results. The MVP resource schedule MUST NOT be presented as an optimal solution.

## 2. Normative precedence and boundaries

Resolve conflicts in the following order.

1. Must requirements in `docs/requirements.md`
2. Valid graphs, states, and frontiers in the [Graph Semantics specification](graph-semantics.md)
3. The numeric, analysis, and scheduler rules in this document
4. Literal rules in the [DSL Grammar specification](dsl-grammar.md)
5. `docs/basic-design.md` and `docs/examples/`

This document does not reimplement parsing, reference resolution, cycle detection, or state consistency. Analysis MUST NOT start when the graph has an error.

Out of scope for this document:

- Calendar projection, which composes over exact Analysis version 1 results
  through the [Temporal Calendar Semantics specification](temporal-calendar.md)
- Temporal release scheduling and deadline evaluation, which preserve the
  unqualified Analysis version 1 results and are independently versioned by
  the [Temporal Deadline Semantics specification](temporal-deadline.md)
- Source migration between Points and a linked time unit, which rewrites the
  document before reanalysis under the independently versioned
  [Unit Migration Semantics specification](unit-migration.md)
- Holidays, shifts, named time zones, setup time, and skills
- Consumable resources, preemption, and changes to requirements during execution
- Making an exact solver the MVP default path
- Completion probability for a target duration, Monte Carlo simulation, and exact completion probability for multiple paths
- JSON Schema, CLI option spelling, and post-MVP adapter wire contracts

## 3. Analysis input view

### 3.1 Canonical residual view

Analysis uses the canonical residual view from the Graph Semantics specification, rather than the entire source document.

```text
R       = effective reached set
E_a     = { e | dst(e) not in R }
V_a     = { project.finish } union endpoints(E_a)
F_a     = R intersection V_a
G_a     = (V_a, E_a)
```

- `F_a` is the current frontier.
- `E_a` retains unfinished tasks and done tasks/gates required for unreached joins.
- Historical edges whose target is reached are outside the analysis scope.
- All resource declarations remain available from the original graph.
- If the project is complete, `V_a = {finish}`, `E_a = empty`, and the makespan is 0.

This view ensures that analysis results for retained tasks do not change before and after canonical advance.

Normalize the project `critical_epsilon` to an exact Rational of 0 or greater in the project unit; when omitted, it is 0. Retain `target_duration` as input metadata, but Analysis version 1 does not calculate completion probability.

### 3.2 Analysis options

Options interpreted semantically by Analysis version 1:

- Resource schedule: `precedence`, `resource`, or `both`
- resource capacity override map
- Display precision
- Critical-path enumeration limit

The interface specification fixes the concrete CLI/JSON names of options. Option ordering does not affect the result.

### 3.3 Result separation

The primary result separates at least the following.

```text
analysis
├── numeric metadata
├── precedence result
├── resource result        optional by mode
├── next-task annotations
└── diagnostics/qualifiers
```

Do not overwrite precedence fields with resource results. Do not return `makespan` alone without context; distinguish `precedenceMakespan` and `resourceMakespan`.

## 4. Rational arithmetic

### 4.1 Canonical form

Calculate all durations, times, floats, variances, and utilization values as exact Rational values.

```ts
interface Rational {
  numerator: bigint;
  denominator: bigint;
}
```

Canonical invariants:

- The denominator is positive.
- `gcd(abs(numerator), denominator) = 1`.
- Zero is `0/1`.
- Only the numerator carries the sign.
- Do not convert to JavaScript `number` during arithmetic.

### 4.2 Decimal conversion

Convert a finite decimal `whole.fraction` exactly as follows.

```text
digits      = concatenate(whole, fraction)
scale       = length(fraction)
rational    = integer(digits) / 10^scale
```

Reduce the result after conversion. `0.10` and `0.1` are the same Rational. This assumes that the duration unit has already undergone field validation against the project unit.

### 4.3 Operations

Implement addition, subtraction, multiplication, division, comparison, absolute value, and squaring with BigInt.

- Division by zero is an internal error.
- Compare by cross multiplication.
- On equality, `max` and `min` return only the value; the caller performs entity tie-breaking.
- Reduce the variance denominator as well.
- Keep resource quantity and priority as integers; do not mix them with duration Rationals.

### 4.4 Exact output

Machine-readable results MUST NOT lose exact values.

```text
numerator: signed decimal integer string
denominator: positive decimal integer string
unit: day | hour | point | day^2 | hour^2 | point^2 | ratio
```

Human-readable decimals are derived displays and MUST NOT be reused for comparison, criticality decisions, or tie-breaking.

### 4.5 Velocity conversion

Let project velocity be `P point / T calendar-unit`. If the base unit is point, calculate the calendar forecast exactly as `x * T / P`; if the base unit is a day/hour matching the velocity period, calculate the point forecast exactly as `x * P / T`.

- Both `P` and `T` are positive Rationals.
- Do not round during conversion.
- State the source unit and target unit in the result.
- Attach the `velocity_forecast` qualifier to converted values; run PERT/CPM and resource scheduling on values in the base unit.
- Retain variance in the square of the base unit. The MVP velocity forecast covers duration/expected/float/makespan and does not output forecast variance.
- Do not implicitly convert between day and hour through velocity or a fixed ratio.
- These formulas also define exact numeric scaling for unit migration, but an
  Analysis `velocity_forecast` remains read-only. Source-field inventory,
  canonical Decimal-or-fraction serialization, source-grammar selection,
  atomic rewriting, and round-trip behavior belong to the Unit Migration
  Semantics specification.

## 5. Duration and variance

### 5.1 Effective duration

Define the analysis edge duration `d(e)` as follows.

```text
d(gate) = 0
d(done task) = 0
d(deterministic unfinished task) = declared duration
d(PERT unfinished task) = expected duration
```

`unfinished` includes `planned`, `active`, and `blocked`. The estimate for `active` is the remaining amount at the snapshot time.

### 5.2 PERT expected value and variance

For the three-point estimates `O`, `M`, and `P`:

```text
expected = (O + 4M + P) / 6
variance = ((P - O) / 6)^2
```

- Do not round during calculation.
- The variance of a deterministic task is 0.
- The remaining variance of a gate or done task is 0.
- The variance unit is the square of the project duration unit; for points, `point^2`.
- Under the approximation that tasks are independent, path variance is the sum of task variances.
- Do not infer the mean or variance of external wait time for blocked tasks.

### 5.3 Blocked qualifier

When the residual graph contains one or more `blocked` tasks, attach the following to both the precedence and resource results.

```text
conditionalOnBlocksResolved = true
blockedTaskIds = sorted IDs
```

The displayed completion forecast is conditional: blocks resolve at time 0 and require only the stated remaining duration.

## 6. Precedence CPM

### 6.1 Virtual boundary

Add a virtual source `@START` and virtual sink `@FINISH` to `G_a`.

- Connect `@START -> v` to every `v in F_a` with weight 0.
- Connect `finish -> @FINISH` with weight 0.
- Do not persist virtual elements as DSL entities or in the Mermaid source of truth.

For a complete project, treat this as the zero-duration path `@START -> finish -> @FINISH`.

### 6.2 Forward pass

Set the earliest time of frontier milestones to 0.

```text
E(v) = 0                                      if v in F_a
ES(e) = E(src(e))
EF(e) = ES(e) + d(e)
E(v) = max(EF(e) for e in In_a(v))           otherwise
precedenceMakespan = E(finish)
```

Process milestones in the stable topological order from the Graph Semantics specification, filtered to `V_a`. When incoming edges tie, the value is the same; use edge ID only to tie-break path-predecessor selection.

### 6.3 Backward pass

```text
L(finish) = precedenceMakespan
LF(e) = L(dst(e))
LS(e) = LF(e) - d(e)
L(v) = min(LS(e) for e in Out_a(v))
```

Use reverse stable topological order. Every milestone other than `finish` is finish-reachable and therefore has at least one outgoing edge.

### 6.4 Float

```text
totalFloat(e) = LS(e) - ES(e)
              = L(dst(e)) - E(src(e)) - d(e)

freeFloat(e) = E(dst(e)) - EF(e)
             = E(dst(e)) - E(src(e)) - d(e)

milestoneSlack(v) = L(v) - E(v)
```

For valid input, float and milestone slack are 0 or greater. Do not correct negative values to 0 by rounding; treat them as an analysis invariant failure.

## 7. Precedence critical result

### 7.1 Critical and driving

User-facing criticality decision:

```text
isCritical(e) = abs(totalFloat(e)) <= criticalEpsilon
```

Driving decision for constructing the exact longest path:

```text
isDriving(e) = totalFloat(e) == 0
```

When `criticalEpsilon > 0`, the critical subgraph can include near-critical edges. Construct the representative critical path and path count only from exact driving edges that actually achieve the makespan.

### 7.2 Critical subgraph

Include the following in the result.

- Critical milestone IDs
- Critical task IDs
- Critical gate IDs
- Driving edge IDs
- ES, EF, LS, LF, total/free float, expected value, and variance for each edge
- Earliest, latest, and slack for each milestone

Display critical elements in stable topological position order, then in lexicographic ID order at the same position.

### 7.3 Representative path

Retain only arcs in the driving subgraph that can reach `@FINISH` from `@START`.

For the representative path, at each node select the outgoing arc with the smallest arc ID among those with a driving path to the sink. A virtual frontier arc ID is `frontier:<milestone-id>`; a task/gate arc ID is its entity ID.

The returned path is the sequence of task/gate IDs excluding virtual arcs. Return an empty path when the project is complete.

### 7.4 Path count and enumeration

Calculate the number of exact driving paths with reverse-topological dynamic programming using BigInt, and return it as a decimal integer string.

```text
count(@FINISH) = 1
count(v) = sum(count(dst(a)) for driving outgoing arc a)
```

- Calculate the path count even when paths are not enumerated.
- Path enumeration does not exceed `maxPaths`.
- Enumerate in lexicographic order of arc-ID sequences.
- If `pathCount > emittedPaths`, set `pathsTruncated=true`.
- Return the sum of task variances for each path as an exact Rational.

## 8. Display rounding

### 8.1 Default

The default display precision is three decimal places. The caller can specify a finite number of places of 0 or greater. The interface specification sets a safe maximum.

### 8.2 Rule

Use round half away from zero only when displaying a Rational in decimal form.

```text
13/6 -> 2.167  at precision 3
-1/8 -> -0.13  at precision 2
```

- A renderer option can distinguish compact display, which omits trailing zeros, from fixed-digit display.
- Do not output negative zero.
- Always retain the exact numerator/denominator.
- Attach the project unit to durations and the squared unit to variances.
- Do not feed rounded values into subsequent calculations.

## 9. Resource scheduling model

### 9.1 Scheduler identity

MVP scheduler identifiers:

```text
algorithm = parallel-sgs
version = 1
optimal = false
```

Return the same schedule for the same residual graph, capacity, and scheduler version.

### 9.2 Execution assumptions

- Renewable integer capacity
- Non-preemptive tasks
- A task acquires all required resources simultaneously.
- The allocation interval is `[start, finish)`.
- Use expected duration as schedule duration.
- Fix active tasks at start 0 and retain resources for their entire remaining duration.
- Done tasks and gates have duration/resource usage of 0.
- Include blocked tasks in the schedule as conditional tasks whose blocks resolve at time 0.
- Process tasks that require no resources in the same event loop.
- Do not convert to calendar time.

### 9.3 Simulated milestone state

At simulation start:

1. Mark frontier milestones as reached at time 0.
2. Mark retained done tasks as completed at time 0.
3. Mark gates whose source is reached as satisfied at time 0.
4. Propagate the all-incoming rule to a fixed point.
5. Register active tasks as running with start 0 and finish `d(t)`.
6. Subtract active requirements from capacity.

On task completion, mark the edge as satisfied and propagate milestone/gate closure at that time. The milestone reached time is the maximum of all incoming satisfaction times.

### 9.4 Eligibility

An unstarted task `t` is schedule-eligible when the following holds.

```text
simulated source milestone is reached
and status(t) in {planned, blocked}
```

Active tasks are already running and done tasks are completed; neither is included in candidates.

### 9.5 Candidate order

Compare eligible tasks at the same time in ascending order of the following tuple.

```text
(-priority, precedenceTotalFloat, -expectedDuration, taskId)
```

- Higher priority comes first.
- Smaller total float comes first.
- Longer expected duration comes first.
- Task IDs use ASCII lexicographic order.
- Do not use a separate critical boolean key; determine ordering from exact/near-critical float values.

Do not apply this ordering to the fixed starts of active tasks.

### 9.6 Event loop

```text
t = 0
register active tasks and allocations
propagate time-0 done/gates

while finish milestone is not reached:
  complete every running task with finish == t, task ID order
  release all of their resources
  propagate milestone/gate closure at t
  collect newly/all eligible unscheduled tasks
  sort by candidate order
  scan once:
    if all requirements fit current availability:
      start task at t and allocate all requirements
    else:
      record rejection snapshot and continue scanning
  if finish reached: stop
  if running is empty and unfinished tasks remain: error
  t = minimum finish among running tasks
```

Rules:

- At the same time, process completion/release, then closure, then starts.
- If a candidate does not fit, start a later candidate when it fits.
- Allocations of tasks started during a scan are visible to later candidates.
- Do not rescan tasks started in the same event.
- Positive duration prevents a started task from completing in the same event.
- The result is inclusion-maximal, but not necessarily a set that optimizes task count, total priority, or makespan.

## 10. Resource schedule result

### 10.1 task interval

For each residual task, return:

- status
- expected duration and variance
- eligible time
- scheduled start and finish
- resource wait
- requirements
- conditional-blocked flag
- selected priority tuple

```text
resourceWait(t) = scheduledStart(t) - eligibleTime(t)
```

Active tasks have eligible/start 0, and done tasks have start/finish 0. Resource wait is 0 or greater.

### 10.2 makespan and delay

```text
resourceMakespan = simulated reached time of project.finish
resourceDelay = resourceMakespan - precedenceMakespan
```

`resourceDelay` MUST be 0 or greater. Do not present the makespan of a heuristic schedule as best possible or optimal.

### 10.3 resource statistics

For resource `r`:

```text
amountTime(r) = sum(units(t,r) * duration(t) for scheduled non-done t)
utilization(r) = amountTime(r) / (capacity(r) * resourceMakespan)
peakUsage(r) = max simultaneous allocated units
lastRelease(r) = max finish of tasks using r, or 0
```

If resource makespan is 0, utilization is 0. Return amount-time and utilization as exact Rationals. A timeline interval includes start, finish, task ID, and units, with stable ordering by start, finish, then task ID.

### 10.4 qualifiers

Include the following in the resource result:

- algorithm and version
- `optimal=false`
- applied capacity map and override source
- conditional blocked task IDs
- precedence lower bound
- resource delay
- resource arc list
- constraint graph replay status

## 11. runnable_now

### 11.1 selection

`runnable_now` covers only actual `ready` tasks as defined by the Graph Semantics specification. It is distinct from a resource forecast that assumes blocked tasks resolve immediately.

1. Subtract time-0 allocations of active tasks from capacity.
2. Sort ready tasks by scheduler candidate order.
3. Scan once, selecting and provisionally allocating tasks that fit.
4. Return the set of selected task IDs as `runnable_now`.

Always select ready tasks with no resource requirements. The result is inclusion-maximal, but does not guarantee the largest task count or optimal combination.

### 11.2 rejection explanation

For every ready task that was not selected, return the snapshot from the moment that task was scanned.

For each resource:

- capacity
- active usage
- usage selected earlier
- total used before the decision
- units required by the task
- available units
- deficit units
- IDs of occupying active tasks
- IDs of tasks selected earlier in the same selection

Return insufficient resources in resource-ID lexicographic order. Do not retrospectively add allocations of later candidates to the explanation.

### 11.3 presentation order

For presentation order in a Next result, use the following separately from resource selection order.

```text
(-priority, -isPrecedenceCritical, totalFloat, earliestStart, taskId)
```

Do not recompute `runnable_now` membership using presentation sorting.

### 11.4 recommendation boundary

`runnable_now` is a jointly feasible subset selected by the current scheduler candidate order; it is not a project-control-plane recommendation. [Recommendation Semantics specification](recommendation.md) is authoritative for `recommended`, `allowed`, `deferred`, and `discouraged` new-start actions.

[Recommendation Ranking Policy specification](recommendation-ranking.md) independently selects the recommended set as a subset of ready tasks and makes it jointly resource-feasible including active allocations. The [Recommendation Structured Explanation specification](recommendation-explanation.md) is authoritative for semantic explanation graphs when the current `runnable_now` and recommended set differ, and the [Recommendation Interface Contract specification](recommendation-interface.md) is authoritative for interface versioning. Until Recommendation is implemented, do not change the scheduler-version-1 candidate order or `runnable_now`.

## 12. Resource release witness arcs

### 12.1 purpose

Resource arcs are derived information that explain capacity contention delaying task starts in the selected schedule and reproduce the same start times in the schedule constraint graph.

- Do not persist them in the authoritative DSL.
- Visually distinguish them from hard precedence.
- Regenerate them when the schedule, capacity, or scheduler version changes.
- Do not generate them for tasks with `resourceWait` 0.
- Do not make active or done tasks arc targets.

### 12.2 start-event quantities

Let task `t`, which has resource wait, start at time `s`. For resource `r`, represent event information immediately before scanning task `t` as follows.

- `C(r)`: usage of running tasks that continue after `s`
- `F(r)`: total usage of tasks that complete and release at `s`
- `A(r)`: usage of tasks started before `t` during the scan at the same time `s`
- `q(r)`: requirement of `t`
- `cap(r)`: effective capacity

The release quantity required for `t` to fit in the counterfactual with no releases is:

```text
neededRelease(t,r) = max(0, C(r) + F(r) + A(r) + q(r) - cap(r))
```

Because the actual schedule is feasible, `neededRelease(t,r) <= F(r)`. If resource wait is positive, `neededRelease` is positive for at least one required resource.

### 12.3 deterministic witness selection

Process each resource independently in resource-ID lexicographic order.

1. Collect tasks that complete at `s` and release resource `r`.
2. Sort descending by released units, then by task-ID lexicographic order on ties.
3. Select tasks until accumulated units are at least `neededRelease(t,r)`.
4. Limit the final task's contribution to the remaining needed units.

This set is a deterministic, small witness per resource; a global minimum arc set across multiple resources is not required.

When the same `fromTask -> toTask` is selected for multiple resources, merge it into one arc with a per-resource contribution map.

### 12.4 arc record

A resource arc has at least the following fields.

```text
id = resource:<from-task-id>:<to-task-id>
fromTask
toTask
atTime
waitFrom
resources: { resourceId -> contributedUnits }
```

`waitFrom` is the target task's `eligibleTime`, `atTime` is its `scheduledStart`, and `atTime - waitFrom` equals the target's resource wait.

The arc source task satisfies `finish(fromTask) == start(toTask)`. Positive duration and event order ensure that resource arcs do not go backward in time or create cycles in the schedule constraint graph.

## 13. Schedule constraint graph

### 13.1 nodes

Create analysis-only graph `H` derived from the selected schedule.

- `@START` and `@FINISH`
- `M:<milestone-id>` for each `V_a` milestone
- `S:<task-id>` and `F:<task-id>` for each residual task

This graph does not replace the DSL AoA model; it is solely for explaining the resource schedule.

### 13.2 constraint arcs

| Arc kind | From | To | Weight | Stable ID |
| --- | --- | --- | ---: | --- |
| frontier | `@START` | `M:v` | 0 | `frontier:<v>` |
| task start | `M:src(t)` | `S:t` | 0 | `task-start:<t>` |
| task duration | `S:t` | `F:t` | `d(t)` | `task-duration:<t>` |
| task finish | `F:t` | `M:dst(t)` | 0 | `task-finish:<t>` |
| gate | `M:src(q)` | `M:dst(q)` | 0 | `gate:<q>` |
| resource | `F:u` | `S:t` | 0 | `resource:<u>:<t>` |
| project finish | `M:finish` | `@FINISH` | 0 | `project-finish` |

Add a frontier arc for every `v in F_a`. The duration weight of a done task is 0.

### 13.3 replay invariant

Calculate the longest-path earliest time in `H` for every node.

```text
distance(@START) = 0
distance(y) = max(distance(x) + weight(x,y))
```

The following MUST match the actual schedule.

```text
distance(S:t) = scheduledStart(t)
distance(F:t) = scheduledFinish(t)
distance(M:v) = simulatedReachedTime(v)
distance(@FINISH) = resourceMakespan
```

A mismatch is an internal error in resource-arc generation or the scheduler; do not return the schedule as successful.

## 14. Schedule critical result

### 14.1 schedule float

Calculate backward latest time in `H` from forward longest distances and `resourceMakespan`.

For constraint arc `a: x -> y`:

```text
scheduleFloat(a) = latest(y) - earliest(x) - weight(a)
```

For user-facing schedule-critical classification, use `abs(scheduleFloat) <= criticalEpsilon`; for exact-driving classification, use `scheduleFloat == 0`.

### 14.2 schedule critical tasks and arcs

- A task is schedule-critical when its task-duration arc is critical.
- A done task with weight 0 may appear in a path as a connector, but exclude it from the positive-duration critical-task list.
- A resource constraint arc is a critical resource arc when it is critical.
- Return precedence, gate, and resource constraints with their types.
- Use separate fields for precedence-critical IDs and schedule-critical IDs.

### 14.3 representative schedule critical path

In the exact-driving constraint subgraph, choose the arc with the smallest stable arc ID at each step from `@START` to `@FINISH`.

The user-facing chain retains:

- ordered positive-duration task IDs
- constraint kind between tasks: precedence, gate, or resource
- resource contribution map for a resource arc
- zero-duration connector IDs

Path counting and enumeration use the same BigInt DP, limit, and lexicographic rules as the precedence critical path.

### 14.4 capacity sensitivity

Include the capacity map used, resource arcs, and schedule critical path in the resource schedule result. Comparisons between capacity overrides can compare at least:

- resource makespan
- difference from the precedence lower bound
- differences in task starts and finishes
- added and removed resource arcs
- differences in schedule-critical tasks and chains

The precedence result MUST NOT change when capacity changes.

## 15. Normative examples

### 15.1 exact PERT estimate

[pert-estimate.pert](../examples/pert-estimate.pert):

```text
DESIGN expected        = 13/6 d
DESIGN variance        = 1/4 d^2
BUILD expected         = 3 d
precedence makespan    = 31/6 d
critical tasks         = [DESIGN, BUILD]
representative variance = 1/4 d^2
```

At default precision 3, display DESIGN expected as `2.167d` and makespan as `5.167d`. Do not round exact results.

### 15.2 parallel precedence result

Task results for [parallel.pert](../examples/parallel.pert):

| Task | d | ES | EF | LS | LF | TF | FF | Critical |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `CORE` | 4 | 0 | 4 | 0 | 4 | 0 | 0 | yes |
| `CLI` | 3 | 0 | 3 | 1 | 4 | 1 | 0 | no |
| `DOCS` | 2 | 0 | 2 | 2 | 4 | 2 | 0 | no |
| `TEST` | 2 | 4 | 6 | 4 | 6 | 0 | 0 | yes |
| `PACKAGE` | 1 | 4 | 5 | 5 | 6 | 1 | 0 | no |

```text
precedence makespan = 6d
critical edge IDs = [CORE, CORE_READY, TEST, TEST_RELEASE_GATE]
representative critical task IDs = [CORE, TEST]
```

### 15.3 parallel resource schedules

| DEVELOPERS | TEST_ENV | Makespan | Resource arcs | Representative schedule-critical tasks |
| ---: | ---: | ---: | --- | --- |
| 2 | 1 | 8d | `CLI -> DOCS`, `TEST -> PACKAGE` | `CLI, DOCS, TEST, PACKAGE` |
| 3 | 1 | 7d | `TEST -> PACKAGE` | `CORE, TEST, PACKAGE` |
| 2 | 2 | 7d | `CLI -> DOCS` | `CLI, DOCS, TEST` |
| 3 | 2 | 6d | none | `CORE, TEST` |

Timeline at default capacity:

```text
CORE     [0, 4)  DEVELOPERS 1
CLI      [0, 3)  DEVELOPERS 1
DOCS     [3, 5)  DEVELOPERS 1
TEST     [5, 7)  TEST_ENV 1
PACKAGE  [7, 8)  TEST_ENV 1
```

Resource witness at default capacity:

```text
resource:CLI:DOCS
  atTime 3d
  resources { DEVELOPERS: 1 }

resource:TEST:PACKAGE
  atTime 7d
  resources { TEST_ENV: 1 }
```

DEVELOPERS utilization is `9/16`, and TEST_ENV utilization is `3/8`.

### 15.4 runnable now

At the default capacity of `parallel.pert`, candidate order is `CORE`, `CLI`, `DOCS`.

```text
runnable_now = [CORE, CLI]
DOCS rejection:
  DEVELOPERS capacity = 2
  used before decision = 2
  required = 1
  available = 0
  deficit = 1
  selected occupants = [CORE, CLI]
```

Overriding DEVELOPERS to 3 makes `runnable_now = [CORE, CLI, DOCS]`, but does not change the ready set or precedence result.

## 16. Diagnostics and invariants

| Code | Severity | Meaning |
| --- | --- | --- |
| `PTDAG-301` | error | precedence float/longest-path invariant failure |
| `PTDAG-302` | warning | requested path enumeration was truncated at its limit |
| `PTRES-301` | error | unable to generate the next event while unfinished tasks remain |
| `PTRES-302` | error | constraint graph replay does not match the schedule |
| `PTRES-303` | warning | conditional schedule that assumes blocked tasks resolve immediately |
| `PTRES-304` | warning | optional exact/near-optimal solver timeout |

Do not disguise an internal invariant failure as an input error. Include related tasks, resources, and constraint arcs in diagnostics.

## 17. Complexity

- PERT duration calculation: `O(T)`
- CPM forward/backward: `O(V + E)`, excluding BigInt arithmetic cost
- critical path count: `O(V + E)`, excluding BigInt arithmetic cost
- path enumeration: proportional to emitted-path size and limited by `maxPaths`
- parallel SGS: including candidate sort/scan at each event, the worst case of a simple implementation is `O(T^2 log T + T^2 R)`
- resource witness: proportional to released tasks at a start event and the number of required resources
- schedule constraint graph longest path: `O(|V_H| + |E_H|)`

Do not present the resource scheduler as having the same `O(V + E)` complexity as CPM. At larger scale, optimize eligible queues and resource indexes without changing results.

## 18. Optional exact/near-optimal solver boundary

A future solver adapter takes the same residual graph, effective durations, fixed intervals for active tasks, capacity, and conditional-blocked policy as input.

Must if implemented:

- Return a solver ID/version distinct from the heuristic.
- Revalidate the feasible schedule with the shared validator.
- Regenerate resource witnesses and the constraint graph from the returned schedule.
- Distinguish statuses `optimal`, `feasible`, `timeout`, and `infeasible`.
- Return lower bound, best found, gap, and timeout.
- Do not present a result as optimal without an optimality proof.
- Do not silently replace the default `parallel-sgs` result.

MVP acceptance does not require this adapter.

## 19. Analysis acceptance

At minimum, an implementation automatically verifies the following.

1. Retain decimals and PERT `/6` as exact Rationals.
2. Deterministic, gate, and done variance is 0.
3. Precedence and results match before and after canonical advance.
4. CPM for diamonds, parallel edges, and multiple frontiers matches golden results.
5. Total/free float and milestone slack are non-negative.
6. Distinguish critical-epsilon classification from the exact driving path.
7. Critical path counts match without enumeration.
8. Path enumeration has stable ordering and a limit.
9. Schedule active tasks fixed at time 0.
10. Explicitly identify blocked tasks as conditional.
11. A multi-resource task acquires all requirements simultaneously.
12. Skip a higher-ranked candidate that does not fit and start a later task that fits.
13. The `runnable_now` rejection snapshot matches the time of scanning.
14. An exclusive capacity-1 schedule matches the golden result.
15. At capacity 2 or greater, `neededRelease` and witness contributions match.
16. Resource-arc merging is deterministic across multiple resources.
17. The constraint graph reproduces all task starts/finishes and makespan.
18. Schedule-critical tasks, arcs, and paths match golden results for each capacity.
19. The precedence result does not change with a capacity override.
20. Utilization, peak, and last release match exact values.
21. Same-time completion-before-start and ID tie-breaking are deterministic.
22. Do not treat scheduler deadlock or replay invariant failure as success.

## 20. Versioning and next specification

Analysis version 1 targets grammar version 1 and semantics version 1.

The [CLI Interface specification](interfaces.md) fixes AnalysisResult/ResourceScheduleResult/NextResult JSON, exact Rational and display fields, CLI options, exit codes, text layout, path enumeration, and capacity overrides. MCP actions and schema parity are outside the MVP and are deferred to a separate future adapter specification.

When changing an Analysis rule incompatibly, distinguish whether the analysis version or scheduler version changes. When changing candidate order, event order, or witness selection, increase the scheduler version; do not return a different schedule under the same version.
