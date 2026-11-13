# ADR 0011: Unify capacity-filling automatic task selection

- Status: Accepted
- Date: 2026-11-13
- Decision owner: user
- Related issue: [Issue #48](https://github.com/mako10k/perttool/issues/48)
- Evidence baseline: `origin/main` at `ec07884f58407712118f3c7531ae8d2937f83846`
- Scope: maximum-count selection architecture and authorized implementation
- Public contract: [Contract revision 1.0](../specs/maximum-count-selection.md)

## Context and agreement

The execution request is the user message requesting handling of the new Issue
in this Codex chat on 2026-11-11, immediately preceding the repository
investigation. Its original wording remains in the chat; this reference does
not broaden it into policy adoption or implementation approval. Issue #48 asks:
"Determine and document an owner-reviewed automatic next-task selection policy
that is operationally usable when R and L disagree, while preserving joint
resource feasibility, active allocations, temporal constraints, assurance, and
source-plan identity."

The [Issue #37 acceptance](../process/issue-37-next-authority-acceptance.md)
deliberately fixes `S = R intersection L intersection T intersection A`.
`R` is the ranked recommendation, `L` the scheduler-backed runnable selection,
`T` time eligibility, and `A` assurance eligibility. That accepted behavior is
still exercised by `test/issue-37-next-authority.test.mjs`, including v9 CLI
and closed-schema assertions. This proposal does not reinterpret that test as
a defect.

The installed 0.12.2 CLI reproduces the public `rec-008-runnable-authority.pert`
case: `R = [CRITICAL]`, `L = [HIGH_PRIORITY]`, and `S = []`. The reported
two-worker consumer case is Issue evidence; this investigation has not read or
changed that consumer's plan.

## Evidence and claims

- **E1:** `src/recommendation/ranking.ts` constructs a capacity snapshot,
  subtracts active allocations, selects jointly feasible tasks within the
  ranking horizon, and verifies final joint feasibility.
- **E2:** `src/application/next.ts::selectNextTasksFromAnalysis` creates the
  ranking/explanation and independently selects runnable tasks. The temporal
  and actuals composers call `selectRunnableRecommendedTaskIds`, retaining the
  Issue #37 intersection. Assurance subsequently narrows that result in
  `src/application/contract7-assurance.ts`.
- **E3:** `src/recommendation/override.ts` explicitly supports v8/v9 source
  identities. MCP `protocol.ts` identifies v9 and `projection.ts` projects Next
  results. A change confined to CLI text would leave those consumers unchanged.
- **E4:** The active ranking specification fixes a selection horizon; spare
  capacity does not require selecting a task outside it.
- **C1, supported by E1/E2:** A rank-backed start policy can address disagreement
  without replacing the priority-first forecast scheduler. This is an
  architectural inference, not implementation or installed-recovery evidence.
- **C2, supported by E2/E3:** Removing the intersection under the current v9
  identity would violate the accepted consumer contract.
- **C3, supported by E1/E4:** Proving the ranked set feasible does not establish
  a work-conserving dispatch policy or guarantee a second automatic selection.

## Decision for capacity-filling selection

### Agreement and status

The owner's user message in this chat on 2026-11-11, immediately after the
expanded ADR explanation, requires task management to select startable work
for the specified slots whenever such work exists. The subsequent message
requests reconsideration of the design. Those messages preserve the original
wording; the interpretation here is separate from those sources.

Accepted requirement: maximize the number of simultaneously startable tasks
within specified resource capacity. The owner selected task count over priority
in the user message following the priority-versus-count example in this chat.
The same message requires residual units for tied boundary groups; the next
clarification identifies ties at the overflowing selection boundary for an
available resource. These source messages preserve the original wording.
The interpretation is not a tie between whole sets merely sharing a count.
Superseded proposal: select only the old recommendation horizon, omit backfill,
or leave an additional usable worker slot unselected. The owner authorized
implementation and then explicitly approved the remaining 18p and 12–24 hours
on 2026-11-13, directing the public contract first. The public contract fixes
the engineering versions and wire details under that implementation authority.

The owner subsequently instructed implementation to begin in this chat. That
separate instruction authorizes the implementation work. The first internal
slice is defined in [the core contract](../specs/maximum-count-selection-core.md);
the public contract and consumer-adoption tasks follow that verified slice.

### Current input and meaning of slots

The current `dag next` contract exposes resource declarations and repeatable
`--capacity RESOURCE=N` overrides. It has no concurrent-task-count option.
`NextOptions.capacityOverrides` also maps resource IDs to capacity. Use those
existing inputs; do not add a second slot-count setting merely for this fix.

For a worker resource with capacity 2 and requirements of one unit per task,
two compatible tasks fill the two worker slots. Active usage consumes capacity
before new selection. A two-unit task consumes both units; it is not one unit
merely because it is one task. Every other required resource must also fit.
No resource requirement means no implicit worker demand. These are existing
resource meanings, not new prerequisites for task selection.

If the owner instead requires an independent task-count ceiling, that is a
separate input requirement to resolve; do not silently infer it from capacity.

### Selection objective and algorithm boundary

Use one versioned selector for the normal Next result. Capture one validated
source/options snapshot with applied capacities, active allocations, effective
reached state, temporal evaluation and assurance evaluation. Candidates are the
full actual ready set, excluding active, suspended, blocked, upcoming, done
and gates. Apply existing time and assurance start eligibility before selection;
ineligible candidates consume no capacity. Preserve existing whole-result
validity, complete-trace and assurance safe-stop requirements.

Let E be that eligible set and let S be a subset of E. The owner-selected
primary objective is:

```text
maximize |S|
subject to, for every resource r:
  active_usage(r) + sum(requirement(t, r) for t in S) <= capacity(r)
```

For capacity 2, if A requires 2 units and B and C require 1 each, select B+C
even if A ranks first. Rank-first greedy scanning is superseded: it can return
a smaller set and cannot satisfy this requirement in general. Removing the old
horizon alone is also insufficient.

The secondary objective is fixed as follows. Among maximum-count sets, prefer the existing
ranking comparison groups lexicographically by the number selected from each
group, best group first. This ranking preference must never reduce the primary
maximum count. Separate semantic rank groups from the final stable-ID tie-break;
an ID does not make otherwise equal-ranked work semantically higher priority.
For choices equal on both objectives, use stable-ID order for one
reproducible concrete selection, while exposing the tied boundary and capacity.
The public contract records these secondary and final tie-break choices.

Implementation must compute the optimum rather than label a heuristic result
as maximum. The detailed contract must assess exact search with pruning or
another exact approach over actual candidate/resource sizes. No dependency,
new candidate-count limit, mandatory configuration, timeout refusal or heuristic
fallback is adopted here. A larger exact-search cost is a feasibility question
for the owner, not authorization to weaken the requested objective or silently
add a runtime restriction.

Return the selected set and its joint resource witness, plus evidence supporting
maximum count under the adopted algorithm. Bind both to the same source,
capacities, requirements, active allocations and eligibility. Reanalyze after
lifecycle or input changes. Empty selection means no eligible task fits, or an
existing whole-result failure applies; it does not mean project completion.

### Tied boundary groups and residual units

At a contention boundary, expose eligible same-ranked tasks as a group before
using the final ID tie-break. The result exposes the following fields.

- the semantic comparison facts defining equality and all group task IDs;
- the applied capacity and active usage for each resource;
- allocations committed to tasks outside the group in the selected solution;
- the resource budget left for this group, before its own selected tasks;
- each group member's resource requirements;
- the actual selected group members and selected count;
- their used units and the unused units after that group allocation; and
- which other tied members are alternatives, not additional start authority.

For a boundary group G, project its budget for each resource r as:

```text
group_budget(G, r) = capacity(r) - active_usage(r)
                     - sum(requirement(t, r) for t in selected outside G)
group_used(G, r) = sum(requirement(t, r) for t in selected inside G)
group_unused(G, r) = group_budget(G, r) - group_used(G, r)
```

Label this as conditional on the displayed outside-group selection. Different
optimal combinations can give a group different budgets; do not present the
budget of one combination as unconditional. A resource vector is required:
CPU units, worker units and device units cannot be summed into one slot count.
Resource units are bounds, not a guarantee that all group tasks can be started.

Example: worker capacity 4, active usage 1, outside-group selection uses 1,
and equal-ranked X/Y/Z each require one worker unit. Show boundary group
[X,Y,Z], budget 2 worker units, selected 2 tasks, group usage 2 and unused 0;
show the concrete two selected IDs separately. Do not hide the third equal
candidate behind an arbitrary ID ranking, or mark all three startable together.
With unequal or multiple resource requirements, show the complete budget and
selected feasible combination rather than claiming budget 2 means two tasks.

The tied-group display is explanatory. The final startable IDs remain one
maximum-count jointly feasible set. It does not authorize a consumer to union
alternative groups or combine alternatives from different optimal solutions.

### One answer at the consumer entrypoint

Replace the independently selected Next runnable set with the shared selection
under the new result identity. For a complete successful result:

```text
recommendation.recommended_task_ids
  = groups.runnable_now
  = temporal.authority.startable_recommended_task_ids
  = selected
```

Task `runnable_now`, selected membership, per-task resource rejection witnesses,
and all human summaries describe that same decision. Eligibility exclusions
have temporal/assurance reasons rather than fabricated resource rejection.
Candidate ranking facts can remain visible without granting start authority.
There is no second executable set for consumers to intersect or union.

Recompute recommendation tiers and explanation links from the new selection;
do not leave a selected task marked `allowed` or `deferred` because algorithm 1
excluded it. The legacy optional one-allowed-addition workflow no longer limits
the automatically selected set. Override validation uses the new selected set,
not a stale horizon or old runnable membership. Human-directed replacements
remain subject to actual joint feasibility and existing override semantics.

This does not replace `parallel-sgs` resource forecasts. Direct inspection of
`src/application/next.ts::selectRunnable` confirms that Next runnable selection
is separate from forecast scheduling. The earlier alternative table overstated
the need to change forecasts to align Next fields. The consequence here is
that immediate dispatch can differ from the heuristic
forecast; label the forecast's algorithm and assumptions clearly, without
representing it as the selected dispatch sequence.

### Examples and acceptance obligations

| Input or condition | Required new-policy behavior |
| --- | --- |
| Two free worker units; three eligible one-unit tasks | Select the first two in adopted order, even across the old horizon |
| One of two worker units already active | Select one compatible new task; keep active work intact |
| Highest-ranked task blocked by release time | Reserve nothing for it; examine and select later eligible work |
| Highest-ranked task rejected by assurance | Preserve its rejection and examine later eligible work unless an existing global safe stop applies |
| First candidate cannot fit a scarce secondary resource | Continue scanning candidates that can fit all remaining resources |
| Individually fitting tasks jointly exceed capacity | Select only a jointly feasible set with occupant witnesses |
| Capacity 2; top A requires 2, B/C require 1 each | Select B+C despite A ranking higher |
| Equal-ranked X/Y/Z; only 2 units remain | Show the boundary group, remaining 2 units, selected 2 IDs, usage and final residual; do not imply all three fit |
| One-slot Issue #37 disagreement fixture | New result consistently recommends and selects CRITICAL; old v8/v9 behavior remains empty under its old identity |
| No ready eligible task fits | Empty selection with actual exclusions; no claim of completion |

Trace these through temporal and actuals producers, assurance composition,
public Core/Node, CLI JSON/text, schema, Guide, override validation, MCP and an
isolated installed package. Include exact rational and three-point inputs where
ranking uses duration, zero capacity, multiple resources, capacity overrides,
unknown/unavailable evidence, truncated traces, deterministic ties, and source
identity. Include a case where greedy selection is smaller than the optimum,
several equal-count sets, a semantic tie broken only by ID, active plus
outside-group usage, and a multi-resource boundary budget. Verify maximum
counts against independent exhaustive enumeration on bounded small fixtures.
Keep old Issue #37 expectations under the old semantic version.
The real consumer plan has not been replayed; use a two-worker public fixture
before claiming its reported case recovered.

### Compatibility and affected owners

Use selection algorithm perttool.dispatch.maximum-count version 1, recommendation interface 2,
`Perttool.NextResult.v10`, CLI Contract 12 and policy
`max_count_dispatch_v1_plus_release_gate_plus_plan_assurance_v1`. Names and versions
are fixed by the public contract and registered during consumer adoption. Grammar and persisted plan
semantics remain unchanged. The public contract uses the existing resource-capacity input. This is a beta-minor semantic change, not a compatible patch.

- Recommendation owner: full-ready-set ranking, selection, tiers and complete
  typed explanation; retain algorithm 1 semantics in old-version coverage.
- Application owner: compute temporal/assurance eligibility before selection;
  remove competing independent selection in temporal/actuals composition.
- Result owners: project the same selection into all Next memberships and
  witnesses; bind source digest, capacities and active allocations.
- Consumer owners: update closed schemas, CLI, Help/Guide, override source
  adoption, public facades, MCP protocol/projection and repository guidance.
- Forecast owner: preserve current forecast results and algorithm identity.
- Consumer readback on 2026-11-13 found Next-selection dependencies in the
  private editor DAG-focus service and Planning Pool execution context. Their
  recommended and startable IDs adopt the shared v10 selection. The previous
  no-consumer claim was incorrect. Existing graph forecasts retain their owners.

Old v8/v9 identities must retain their meaning. Prefer pinned old packages and
historical version coverage over adding a new dual-mode runtime by default;
exact legacy API support is a detailed-contract decision. New consumers must
adopt the new identity explicitly. This proposal does not authorize package
publication, installation, external Issue writes, or source-plan mutations.

### Alternatives reassessed

| Alternative | Assessment against clarified outcome |
| --- | --- |
| One maximum-count selector for recommendation/runnable/start | Meets the selected objective and gives consumers one coherent answer |
| Separate capacity-filling dispatch beside legacy runnable | Can fill capacity, but preserves two competing selections and complicates consumers |
| Change the entire forecast scheduler to rank-first | Broader than needed for current dispatch; forecast changes require a separate reason |
| Old-horizon rank authority without backfill | Insufficient: can leave usable capacity idle |
| Priority-first greedy full-set scan | Superseded: can select fewer tasks than another feasible combination |
| Retain current intersection or explain it better | Insufficient: leaves the reported empty-start behavior |

### Review and remaining work

**INSIDE:** The owner's maximum-count objective and tied-boundary resource
requirement are fixed. The public contract defines the secondary ranking,
canonical ID choice, closed result schemas, exact description registry, input
commitment and cross-consumer version identities. Executable examples verify
that contract against real source ranking and the exact private selector.

**OUTSIDE:** MAX_COUNT_ADOPTION connects the shared source/eligibility owners,
selector, authority, CLI, schemas, override and MCP. MAX_COUNT_ACCEPTANCE verifies
the complete real-entrypoint and installed-package trace. Those task outcomes
are recorded independently in the accepted PERT.

**BOUNDARY_DISPUTE:** The owner's clarification resolves the boundary group's
meaning. Resource capacities and requirements supply the specified units.

The resumed implementation budget is 12–24 engineer-hours for the remaining
18p as explicitly approved on 2026-11-13. Actual task events and the canonical
PERT carry progress through the contract, adoption and acceptance phases.
### Recovery and residual effects

The current revision edits documentation only. For later activation, an exact
old-package rollback restores old selection behavior without plan migration;
already started work still requires ordinary lifecycle accounting. The producer
must recompute after starts, completion, time, capacity and assurance changes.
Cross-plan contention is not proved by a single-plan resource snapshot.
Maximum task count may defer a larger high-priority task and does not optimize
makespan, total resource utilization or task value. Persistent starvation needs
an explicit future policy decision; no aging or automatic priority rewrite is
introduced by this requirement.

## 2026-11-13 public-contract decision record

The owner's continuation message immediately after the current-state report
explicitly selected the remaining 18p and 12–24 hours and directed public
contract work first. The architecture implements the owner's count-first and
boundary-budget decisions. The public contract fixes NextResult v10,
Recommendation Interface 2, CLI Contract 12, OverrideDecision v2 and MCP Next
wire v2. Closed schemas, description templates and source-bound examples carry
those decisions into MAX_COUNT_ADOPTION. Engineering review and fixture checks
are recorded in the public-contract acceptance record.
