# perttool Graph Semantics Specification

- Document status: Draft 0.3
- Semantics versions: 1 and 2 active
- Created: 2026-07-21
- Updated: 2026-07-28
- Related requirements: [../requirements.md](../requirements.md)
- Grammar specification: [dsl-grammar.md](dsl-grammar.md)
- Related basic design: [../basic-design.md](../basic-design.md)

## 1. Purpose

This document is the normative specification for resolving a syntactically valid `.pert` document as a DAG and determining milestone reachability, task/gate satisfaction, next-task classification, the frontier, the boundary with resources, and the minimal graph retained after `advance`.

`docs/specs/analysis.md` defines PERT/CPM formulas, resource-schedule event generation, resource arcs for capacity 2 or greater, and the schedule critical path. This document fixes the meaning of the valid graph and stored state that serve as their inputs.

## 2. Normative precedence

Resolve inconsistencies in the following order.

1. Must requirements in `docs/requirements.md`
2. The graph, state, and advance rules in this document
3. Syntax and field rules in the [DSL grammar specification](dsl-grammar.md)
4. Implementation structure in `docs/basic-design.md`
5. `docs/examples/*.pert` and help output

Syntactic acceptance does not imply graph validity. Do not apply the graph analysis in this document to a document with a parse or field-validation error.

## 3. Scope and exclusions

This document defines:

- entity-ID and reference resolution
- a DAG in which tasks and gates are edges
- roots, finish, and finish reachability
- stored milestone state and effective-reached closure
- task status and edge satisfaction
- the `active`, `ready`, `blocked_now`, and `upcoming` sets
- resource references and consistency of time-zero active allocation
- the frontier and project completion
- semantic rewriting and invariants for `advance`
- graph diagnostic codes, ordering, and source locations

This document does not define:

- formulas for duration, expected value, variance, and float
- final display ranking of ready tasks
- resource-schedule optimality
- selection of resource arcs that explain resource waits
- formatter rules for comment movement
- file writes, atomic replacement, and optimistic locking
- Mermaid metadata, CLI JSON Schema, and post-MVP adapter wire contracts

## 4. Canonical graph model

### 4.1 Notation

Represent the graph after reference resolution as follows.

```text
G = (V, E)
E = T union Q
```

- `V`: set of milestones
- `T`: set of task edges
- `Q`: set of gate edges
- `src(e)`: the `from` milestone of edge `e`
- `dst(e)`: the `to` milestone of edge `e`
- `In(v)`: set of edges for which `dst(e) = v`
- `Out(v)`: set of edges for which `src(e) = v`
- `finish`: milestone referenced by `project.finish`

Resources are neither vertices nor edges in `G`. Retain task-to-resource requirements as a separate bipartite relation.

### 4.2 ID domain

Project, resource, milestone, task, and gate IDs share one global namespace.

Rules:

- IDs are unique throughout the document.
- Exact lowercase reserved words are prohibited as entity IDs.
- Task/gate endpoints can reference only milestones.
- Task requirements can reference only resources.
- Do not use titles, declaration order, or source positions for reference resolution.
- Forward references are permitted.

### 4.3 Edge identity

The task/gate ID is the edge identity. Parallel edges with the same `from` and `to` are permitted and count as independent dependency conditions.

A milestone's indegree is the number of edges, not the number of endpoint pairs. Do not automatically merge parallel edges into one edge.

## 5. Graph build pipeline

Build a valid graph in the following order.

```text
field-valid AST
 -> collect global IDs
 -> resolve finish/endpoints/resources
 -> build stable adjacency
 -> self-loop/cycle validation
 -> finish/reachability validation
 -> effective reached closure
 -> state consistency validation
 -> active resource validation
 -> valid PertGraph
```

Rules:

- If one or more errors exist, do not pass `PertGraph` to a public analyzer.
- Report independent errors in the same check where feasible.
- Reachability and state errors that depend on a cycle may be suppressed to avoid misleading output.
- When only warnings exist, the graph can be generated and analysis can continue.
- Edges in an adjacency list are in lexicographic edge-ID order.

## 6. Structural validity

### 6.1 Self-loops and the DAG

For every task/gate, `src(e) != dst(e)` is required.

The graph containing all edges, without distinguishing tasks from gates, must be a DAG. Do not include resource-sharing relationships, owners, or priority in cycle validation.

### 6.2 Stable topological order

Use Kahn's algorithm, choosing zero-indegree candidate milestones in lexicographic ID order. Process edges in lexicographic edge-ID order.

If all milestones cannot be processed, report a cycle error and return at least one cycle witness from the unprocessed subgraph.

Determine a cycle witness in the following order.

1. Perform DFS from the lexicographically first unprocessed milestone ID.
2. Traverse outgoing edges by edge ID and then target ID.
3. Select the cycle closed by the first back edge.
4. Rotate it for display so that it starts with the smallest milestone ID.
5. Return both the milestone-ID sequence and edge-ID sequence.

### 6.3 Finish

- `project.finish` references an existing milestone.
- `Out(finish)` must be empty.
- Finish itself is considered reachable from finish.
- A zero-task project can be a valid completed project when finish is the only milestone and is explicitly `reached`.

### 6.4 Finish reachability

Traverse all edges in reverse from finish.

The following holds for a valid graph.

```text
for every v in V: v can reach finish
for every e in E: dst(e) can reach finish
```

This includes not only unfinished edges but also temporarily retained done tasks and gates. Do not retain a past-only subgraph that does not lead to finish for historical purposes.

Resource declarations are outside finish reachability; declaring an unused resource is not a graph error.

### 6.5 Roots

A milestone with empty `In(v)` is a root.

- Every root must explicitly be `state reached`.
- Multiple roots are allowed; treat each as an independent entry into the current frontier.
- A non-root milestone can explicitly be `reached`, but it must satisfy the incoming consistency described below.

## 7. Stored state and edge satisfaction

### 7.1 Stored milestone state

A milestone's stored state has the following two values.

- `planned`: the default when omitted. Reachability is derived by closure.
- `reached`: an explicit fact that the current snapshot has reached the milestone.

`state` is not a computation cache. Use it to store the explicit frontier in a Git-manageable document.

### 7.2 Task status

Task statuses are mutually exclusive.

| Status | Execution state | edge satisfaction | Time-zero resource allocation |
| --- | --- | --- | --- |
| `planned` | Not started | unsatisfied | None |
| `active` | In progress | unsatisfied | All requirements |
| `blocked` | Not executing because of an external factor | unsatisfied | None |
| `done` | Work condition satisfied | satisfied if the source is reached | None |

The duration/estimate of an `active` task represents remaining work at the snapshot time.

Grammar version 1 cannot represent `active` and `blocked` simultaneously. Work that retains a resource while stopped, or releases and reacquires a resource partway through, is outside the representable domain.

### 7.3 Satisfaction function

Define edge satisfaction for a milestone set `R` as follows.

```text
sat(task e, R) = status(e) == done and src(e) in R
sat(gate e, R) = src(e) in R
```

Rules:

- A gate has no duration, status, or resource requirement.
- A gate becomes satisfied immediately in the same closure computation in which its source becomes reached.
- Do not treat a task whose source is unreached as satisfied merely because it is `done`.
- An `active` task's target does not become reached automatically, even if its remaining duration is zero.
- Resource availability does not affect satisfaction.

## 8. Effective reached closure

### 8.1 Least fixed point

Let `S` be the set of explicit `state reached` milestones. Apply the following function to a fixed point to obtain the effective-reached set `R*`.

```text
F(R) = R union {
  v |
  In(v) is not empty and
  every e in In(v) satisfies sat(e, R)
}

R* = least_fixed_point(F, S)
```

Because the graph is a DAG, one forward pass in stable topological order is sufficient. An implementation using a queue must return the same `R*`.

### 8.2 All-incoming join

A milestone becomes derivatively reached only when all, rather than one, of its incoming edges are satisfied.

- Count tasks and gates alike as incoming conditions.
- Each parallel edge must also be satisfied.
- Blocked, active, and planned tasks do not satisfy a join.
- When a done branch and an unfinished branch join, the done edge remains necessary in the current graph until the unfinished branch completes.

### 8.3 State consistency

After computing the closure, validate the following.

- Every incoming edge of an explicit `reached` milestone must be satisfied with respect to `R*`.
- The source of an `active` or `done` task must be in `R*`.
- A root absent from `R*` is an error.
- A milestone stored as `planned` but reached by closure is valid, but returns an `advance`-available warning.

Do not use explicit `reached` to ignore that milestone's incomplete incoming conditions. Do not pass a graph with incoming inconsistency to analysis.

### 8.4 Project completion

For a valid graph, define the following.

```text
projectComplete = finish in R*
```

If the project is complete in a valid graph, all tasks leading to finish are `done`. The finish-reachability rule disallows off-path unfinished tasks.

## 9. Derived task classification

Derive task classification from status and `R*`; it is not a stored field.

```text
active = {
  t | status(t) == active
}

ready = {
  t | status(t) == planned and src(t) in R*
}

blocked_now = {
  t | status(t) == blocked and src(t) in R*
}

upcoming = {
  t |
  status(t) in {planned, blocked} and
  src(t) not in R*
}
```

Rules:

- Do not include `done` tasks among next candidates.
- Do not classify an `active` task redundantly as ready or upcoming.
- A blocked task with an unreached source is `upcoming`; it becomes `blocked_now` after dependency reachability.
- Do not include gates in task classification.
- Priority, resource capacity, owner, and duration do not change the ready determination.
- A task belongs to at most one of the sets above.

`runnable_now` is a subset of `ready`. Determine it by subtracting time-zero active allocation and applying the deterministic resource-selection rules in the analysis specification. A ready task requiring no resource is always a resource-feasible candidate.

## 10. Gate semantics

A gate is a dummy dependency edge in AoA.

- It is satisfied when its source is reached.
- Apply the same all-incoming rule as other incoming edges to target reachability.
- Its duration is always zero.
- Its variance and resource usage are zero.
- It has no task status, owner, priority, or requires field.
- It is subject to cycle validation, finish reachability, and advance retention.
- Do not implicitly convert it to a task; retain its kind in visualizations and diagnostics.

A gate chain can propagate continuously within closure. A user need not manually change a milestone reachable solely through gates to `reached`.

## 11. Resource semantics boundary

### 11.1 Resolved requirements

Resolve each task requirement as a `resource ID -> positive integer units` map.

- The resource ID exists and has resource kind.
- Units do not exceed declared capacity.
- A resource ID is unique within a task.
- Acquire all requirements simultaneously.

Resource requirements are not precedence edges and do not affect topological order, cycles, reached, or ready.

### 11.2 Active allocation

Define the usage of resource `r` at snapshot time zero as follows.

```text
activeUsage(r) = sum(requirement(t, r) for t in active)
```

For every resource, `activeUsage(r) <= capacity(r)` is required. An excess is a resource error that prevents analysis.

`planned`, `blocked`, `done`, and gates do not allocate resources at time zero. Do not infer an external wait duration for a `blocked` task; treat the future schedule as a conditional result in which the block is resolved at time zero.

### 11.3 Capacity override

A what-if capacity override is a temporary input to an analysis request.

- It does not rewrite the canonical resource declaration.
- Revalidate reference resolution and positive-integer constraints.
- An override below activeUsage is an error.
- It does not change the effective-reached or ready sets.
- It can change `runnable_now`, the resource schedule, and the schedule critical path.

## 12. Frontier

### 12.1 Future-required edges

Let `R*` be the effective-reached set of a valid graph, and define the following.

```text
E_keep = { e in E | dst(e) not in R* }
V_keep = { finish } union endpoints(E_keep)
```

For a valid graph with state consistency, the following holds.

- An edge whose target is reached is a satisfied past condition.
- An edge whose target is unreached is unfinished work or a satisfied condition required for an unreached join.
- The target of an unfinished task is always unreached.

### 12.2 Frontier set

Define the current frontier as follows.

```text
frontier = R* intersection V_keep
```

For a complete project, `frontier = {finish}`.

The frontier includes both of the following.

- Reached milestones that are sources of planned, active, or blocked tasks.
- Reached milestones that retain a partial join as sources of done tasks or satisfied gates entering an unreached join.

Therefore, the frontier is not merely the "starting point of unfinished tasks." It also includes roots required to retain join conditions.

## 13. Advance semantics

### 13.1 precondition

The `advance` planner generates a candidate only when all of the following hold.

- There are no errors in parse, field, reference, DAG, state, or resource validation.
- The effective reached closure can be determined.
- The input digest and source text correspond at invocation time.

Warnings do not prevent a preview, but they are included and displayed in the candidate.

### 13.2 canonical rewrite

Determine `R*`, `E_keep`, and `V_keep` as specified in the preceding section, then construct the following graph.

```text
V' = V_keep
E' = E_keep

storedState'(v) =
  reached  if v in R*
  planned  otherwise
```

Rules:

- Do not change the IDs, fields, statuses, or requirements of tasks/gates in `E'`.
- Preserve the IDs and user fields of milestones in `V'`.
- Set every retained milestone in `R*` to explicit `state reached`.
- Remove milestones outside `V'` and edges outside `E'`.
- Do not automatically remove resource declarations.
- Do not change the project ID, finish, duration unit, or target duration.
- Do not derive `as_of` automatically from the wall clock; change it as a separate mutation only when the caller explicitly requests it.
- The text-edit rules for declarations and comments are specified by the mutation specification.

### 13.3 retention rule

An edge is retained solely according to whether its target is unreached.

| Edge state | Target | Advance |
| --- | --- | --- |
| done task | reached | remove as past work |
| gate | reached | remove as past work |
| done task | unreached join | retain as partial satisfaction |
| satisfied gate | unreached join | retain as partial satisfaction |
| planned/active/blocked task | unreached | retain as future work |
| gate from unreached source | unreached | retain as future dependency |

This rule prevents incorrect removal of a done branch before a join.

### 13.4 postcondition

An advance candidate must be reparsed and revalidated, and must satisfy all of the following.

- Global IDs, references, the DAG, and finish reachability are valid.
- Every root of the residual graph is explicitly `reached`.
- The effective reached set of retained milestones matches the input.
- The IDs, statuses, durations/estimates, and resource requirements of unfinished tasks match.
- `active`, `ready`, `blocked_now`, and `upcoming` match by task ID.
- The current-boundary inputs to precedence/resource analysis are semantically equivalent.
- The project-completion determination matches.
- Running `advance` on the same candidate again produces an empty semantic diff.

The preview result lists removed entities, state changes, retained done tasks/gates, and the reason for each retention.

### 13.5 minimality

Under the expressive power of grammar version 1, every edge in `E_keep` is an incoming condition of an unreached target and cannot be removed. Every milestone in `V_keep` is either the finish or an endpoint of a retained edge and cannot be removed.

Conversely, an edge whose target is reached does not affect future reachability decisions, and a milestone referenced only by such edges is unnecessary in the future graph. In this sense, the canonical rewrite is the smallest residual graph that can be constructed without synthesizing new IDs.

## 14. Determinism

The following must be identical for the same document text, semantics version, and options.

- reference resolution result
- stable topological order
- cycle witness
- effective reached set
- task classification
- frontier
- advance keep/remove set
- diagnostics order

Unless otherwise specified, JSON/text representations of sets are sorted lexicographically by entity ID.

Diagnostics are ordered by the following keys.

1. primary-span start offset; diagnostics without a span follow those with a span
2. severity: error, warning, info
3. diagnostic code
4. entity ID

## 15. Graph diagnostic code

### 15.1 reference and kind

| Code | Severity | Meaning | Primary span |
| --- | --- | --- | --- |
| `PTSEM-201` | error | duplicate global entity ID | later ID |
| `PTSEM-202` | error | reserved word used as an entity ID | entity ID |
| `PTSEM-203` | error | undefined `project.finish` | finish value |
| `PTSEM-204` | error | undefined task/gate endpoint | endpoint ID |
| `PTSEM-205` | error | endpoint is not a milestone kind | endpoint ID |
| `PTSEM-206` | error | undefined resource requirement | resource ID |
| `PTSEM-207` | error | requirement reference is not a resource kind | resource ID |
| `PTSEM-208` | error | requirement units exceed capacity | units |

### 15.2 DAG and state

| Code | Severity | Meaning | Primary span |
| --- | --- | --- | --- |
| `PTDAG-201` | error | task/gate self-loop | arrow |
| `PTDAG-202` | error | directed cycle | first witness edge |
| `PTDAG-203` | error | finish has an outgoing edge | outgoing edge header |
| `PTDAG-204` | error | milestone/edge cannot reach finish | entity ID |
| `PTDAG-205` | error | root is not explicitly `reached` | milestone ID/state |
| `PTDAG-206` | error | explicit reached milestone has unsatisfied incoming edges | milestone state |
| `PTDAG-207` | error | source of active/done task is not effectively reached | task status |
| `PTDAG-208` | warning | planned milestone is effectively reached by closure | milestone ID/state |
| `PTDAG-209` | warning | past entity can be removed by canonical advance | first applicable entity |

### 15.3 resource state

| Code | Severity | Meaning | Primary span |
| --- | --- | --- | --- |
| `PTRES-201` | error | total active-task usage exceeds capacity | resource capacity |
| `PTRES-202` | error | what-if capacity is below `activeUsage` | override value |

For duplicate, cycle, and capacity errors, return the earlier declaration, the edges forming the cycle, and the occupying active tasks as related locations.

## 16. Source mapping and result boundary

Graph entities retain source references to the originating AST/CST.

- An entity diagnostic uses the ID or the smallest field value as its primary span.
- An undefined reference points to the reference token.
- A state contradiction points to the `state` or `status` value.
- A root error when the `state` field is omitted points to the milestone ID.
- A cycle uses every witness edge as a related location.
- Finish-unreachable errors may be returned for each entity, subject to the caller's maximum count.

The `check` result returns parse/field diagnostics and graph diagnostics in the same common model. When graph errors exist, analysis/next/advance results must not be returned as successful.

## 17. Normative examples

### 17.1 minimal

Expected values for [minimal.pert](../examples/minimal.pert):

```text
effective reached = [NOW]
frontier           = [NOW]
active             = []
ready              = [WORK]
blocked_now        = []
upcoming           = []
project complete   = false
```

When `WORK` changes to `done`, `DONE` becomes effectively reached and the project is complete. After canonical advance, only the project and `DONE` with `state reached` remain as graph entities.

### 17.2 resource-parallel

Initial expected values for [parallel.pert](../examples/parallel.pert):

```text
effective reached = [NOW]
ready              = [CLI, CORE, DOCS]
runnable_now       = [CORE, CLI]
```

`runnable_now` follows the default capacity and the initial resource-priority rule. Overriding DEVELOPERS capacity to 3 does not change effective reached or ready; it adds `DOCS` to runnable_now.

### 17.3 partial join before advance

In [advance-partial-before.pert](../examples/advance-partial-before.pert), `BRANCH_A` and `A_JOIN_WORK` are done, and `BRANCH_B` is active.

```text
effective reached = [A_DONE, NOW]
frontier           = [A_DONE, NOW]
active             = [BRANCH_B]
ready              = []
upcoming           = [RELEASE]
```

`JOINED` is unreached because only `A_JOIN_WORK` is satisfied. `A_DONE` has stored state planned but is effectively reached, so `PTDAG-208` is returned.

Canonical advance removes `BRANCH_A` as past work, but retains the done task `A_JOIN_WORK`, which is a condition of unreached `JOINED`. The result is semantically equivalent to [advance-partial-after.pert](../examples/advance-partial-after.pert).

### 17.4 partial join after advance

In [advance-partial-after.pert](../examples/advance-partial-after.pert), `NOW` and `A_DONE` are explicit roots. Running `advance` again produces an empty diff.

When `BRANCH_B` changes to done, `JOINED` becomes effectively reached. The next advance removes both `A_JOIN_WORK` and `BRANCH_B` as past work, makes `JOINED` explicitly reached, and retains `RELEASE` as ready.

## 18. Invalid-state examples

At minimum, fixtures must reject the following.

1. planned root
2. active task from an unreached milestone
3. done task from an unreached milestone
4. explicit reached join with planned/active/blocked incoming edges
5. cycle containing a task/gate
6. outgoing edge from finish
7. finish-unreachable past subgraph
8. endpoint that is a resource ID
9. requirement that is a milestone ID
10. active resource over-allocation

## 19. Semantics acceptance

The implementation must automatically verify at least the following.

1. return the same resolved graph regardless of declaration order
2. retain parallel edges as independent incoming edges
3. make stable topological order and cycle witnesses deterministic
4. validate roots, finish, and finish reachability
5. return least-fixed-point closure through gate chains and done tasks
6. do not mark a target reached while an unfinished branch remains at a partial join
7. validate active/done source consistency
8. classify tasks into active/ready/blocked_now/upcoming without duplication
9. ensure resource-capacity changes do not change reached/ready
10. detect active-allocation overage
11. ensure canonical advance retains done tasks/gates at a partial join
12. ensure unfinished-task classification matches before and after advance
13. ensure advance is idempotent
14. reduce a complete project to a residual graph containing only finish
15. match golden diagnostic codes, primary spans, related locations, and order
16. classify each suspended task exactly once and never as active, ready,
    blocked, upcoming, runnable, or new-start recommended
17. require a reached source, retain edge dissatisfaction, and exclude
    suspended requirements from snapshot allocation
18. identify precedence and resource schedules as conditional on the exact
    suspended task set resuming at relative time zero
19. reject a start or resume candidate that would over-allocate active
    resources
20. make advance remove and report exactly the work events owned by each
    removed task

## 20. Versioning and next specification

Semantics version 1 applies to grammar version 1.

The [Analysis specification](analysis.md) defines duration, PERT/CPM, resource scheduling, `runnable_now`, resource arcs, schedule critical paths, rounding, and tie-breaking using the valid graph in this document as input. The [CLI Interface specification](interfaces.md) defines external result and CLI operation contracts.

For a breaking change to graph semantics, explicitly state the semantics version, fixtures, and migration impact whether or not it also changes the grammar.

Graph semantics version 2 is the active Grammar 5 delta. It
inherits version 1 and adds the following exact rules.

- A `work_event` ID joins the global document-ID namespace, and its task
  reference resolves to a task, but the event is not a vertex or edge in
  `G`.
- `suspended` means intentionally paused. It is unfinished, does not satisfy
  its edge, occupies no snapshot resource, and requires an effectively
  reached source.
- `suspended` is a separate complete classification set containing every
  suspended task. Its IDs occur in none of `active`, `ready`, `blocked_now`,
  `upcoming`, or `runnable_now`.
- Precedence and heuristic resource analysis retain a suspended task and its
  remaining duration, but the schedule is explicitly conditional on every
  reported suspended task resuming at relative time zero. Analysis never
  chooses a resume time.
- New-start recommendation and temporal start authority exclude suspended
  tasks. Resume is an explicit lifecycle action, not a recommendation of a
  new task.
- Time-zero active usage continues to sum only `active` tasks. Starting or
  resuming a task revalidates the complete active allocation.
- Advance treats work events as owned records. When it removes a task, it
  removes and reports exactly that task's events. It never removes an event
  owned by a retained task. Suspended tasks are unfinished and retained.

Version 2 adds `suspended_task_ids` and
`conditional_on_suspensions_resumed` to both analysis views and their
temporal projections. These meanings are active through the coordinated
Grammar 5 and CLI Contract 6 source cutover; semantics version 1 remains
unchanged for Grammar 1 through 4.
