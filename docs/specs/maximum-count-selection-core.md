# Maximum-count selection: internal core contract

- Status: Implemented internal slice; public consumer adoption is unfinished
- Date: 2026-11-11
- Requirement and architecture: [ADR 0011](../adr/0011-rank-backed-start-selection.md)
- Issue: [#48](https://github.com/mako10k/perttool/issues/48)
- Implementation authority: the owner's instruction to begin implementation in
  this chat, following the count-first and boundary-tie clarifications
- Public identities: unchanged by this slice

## Requirement and boundary

Maximize the number of new tasks that can start simultaneously under the
current resource allocation. Task count takes precedence over semantic rank.
For a tied semantic rank group overflowing available resources, expose the
units allocatable to that group and its actual selected members.

The owner clarified that the tie is at the overflowing resource-selection
boundary, not simply two complete selections with equal counts. Preserve the
source user messages in this chat separately from this interpreted contract.

The pure internal function is implemented before changing public Next results.
It is not a new public command, export, permission, configuration, or alternate
default. Existing ranking algorithm 1, NextResult v9, CLI Contract 11, override,
assurance, LSP, VSIX and MCP retain their current behavior. This slice alone
does not recover the consumer's automatic-start entrypoint.

## Module ownership

| Module | Responsibility |
| --- | --- |
| `src/recommendation/maximum-count-types.ts` | Read-only dispatch input and output types |
| `src/recommendation/maximum-count-search.ts` | Exact optimization over requirement profiles and remaining capacities |
| `src/recommendation/maximum-count.ts` | Snapshot validation, selection projection and boundary-group budgets |
| `src/recommendation/maximum-count-ranking.ts` | Adapt complete existing ready-frontier ranking facts and explicit eligibility |

The dependency direction is ranking adapter to selection projection to search;
all share types. The adapter uses the existing neutral ranking owner. None
imports Application, the CLI, Node filesystem APIs, Git, editors, or MCP.
There is no production dependency addition or public package-root export.

## Input ownership and validation

Application must supply the same source-bound graph, precedence analysis,
applied capacities, active allocations, and temporal/assurance eligibility.
The adapter uses all ready candidate facts returned by the existing ranking
owner, including candidates outside its algorithm-1 recommendation horizon.
Missing candidate eligibility is an internal contract error. This is not a
new user-facing precondition: the existing Application producers already own
those eligibility decisions, and public activation must supply them directly.

The low-level selector accepts an exact source digest, capacities, active task
requirements, and ready candidates with rank-group and eligibility. It validates
unique resource/task IDs, disjoint active and ready identities, known distinct
resource requirements, positive safe-integer requirements, nonnegative
safe-integer capacity/rank groups, known eligibility, and active usage within
capacity. It throws on an internal contract violation. Public diagnostic
ownership belongs to the pending Application contract, not this pure function.

The digest is carried, not independently verified against source text by this
function. It cannot prove that a caller supplied the right graph or eligibility.
That binding remains the Application producer's responsibility. Ineligible
tasks reserve no capacity; a withheld task is not promoted by the optimizer.
Zero-resource tasks require no implicit worker resource and all can be selected.

## Exact objective and deterministic choices

For each resource, active usage plus all selected requirements must not exceed
the applied capacity. Compare feasible selections in this order:

1. Larger task count.
2. Lexicographically larger selected-count vector over semantic rank groups,
   best group first. The adapter uses every existing comparison key except the
   final task-ID tie-break to define semantic group equality.
3. Earlier stable task IDs within the otherwise tied ordered candidates.

Secondary rank and stable-ID choices implement the design candidate authorized
for this internal slice. They never reduce maximum task count. IDs provide one
reproducible selection; they do not hide resource-boundary semantic ties.

Tasks with identical resource-demand vectors have interchangeable feasibility.
For any chosen count k from such a profile, its best k ranked members dominate
any other k members on objectives 2 and 3 without changing resource usage.
Therefore the search groups identical vectors and considers every feasible k.
For each profile and remaining-resource vector it memoizes the best suffix.
The recurrence considers every possible profile count and compares exact
objective values, so induction over profile suffixes establishes optimality.

An explicit work stack avoids recursive call-depth restrictions. A suffix that
fits in full is selected without enumerating its subsets. Free profiles are
taken in full. Individually impossible profiles are omitted from search,
but their tasks remain in the exclusion projection. Capacity division uses
integer BigInt arithmetic; allocations are subtracted without accumulating a
potentially overflowing sum. Output units remain safe integers.

No candidate cutoff, timeout, refusal policy, heuristic fallback, solver package
or new setting is introduced. Exact search can still require many states for
diverse multi-resource inputs; profile compression is not a general complexity
guarantee. The internal measurements below do not establish a supported public
workload or justify silent approximation.

## Boundary group projection

Among eligible candidates, each semantic rank group with at least two members
and at least one unselected member is projected with all member requirements,
the selected IDs and unselected IDs. Unselected members are not asserted to be
feasible replacement alternatives.

For every resource show capacity, active usage, outside-group selected usage,
allocatable units, group selected usage and post-selection remaining units:

```text
allocatable = capacity - active_usage - selected_usage_outside_group
remaining   = allocatable - selected_usage_inside_group
```

These are conditional on the displayed outside-group selection. Resources are
listed separately in stable ID order; unlike units are not summed. A unit
budget does not establish a task count when tasks have unequal requirements.
Eligible tied candidates cannot all be treated as simultaneously startable
merely because they appear in this group. The selected IDs give one feasible
maximum-count set.

The complete result and its nested projections are immutable. Caller inputs
are not mutated. Selected IDs are in semantic-rank/ID order; resource, group,
and candidate presentation is deterministic under input permutations.

## Verification seam and current evidence

`test/issue-48-maximum-count.test.mjs` directly exercises the private core and
the adapter over a real validated public fixture. It checks:

- two one-unit tasks replacing a higher-ranked two-unit task;
- active plus outside-group allocations and exact tied-group budgets;
- semantic group counts before ID preference and multi-resource conditional
  budgets where some unselected tied members cannot replace the chosen member;
- temporal and assurance exclusions, zero capacity and free tasks;
- safe-integer arithmetic and invalid input contracts;
- 500 deterministic small inputs against a separately written exhaustive
  subset oracle, including permutations; and
- 1,000 tied one-unit candidates without group truncation; and
- 1,000 different requirement profiles that fit in full.

The real `rec-008-runnable-authority.pert` ranking adapter selects CRITICAL for
one REVIEWER unit and both CRITICAL/HIGH_PRIORITY for two units. The public
Next entrypoint still follows its preserved v9 contract. No consumer plan was
edited or operational recovery claimed.

Observed exploratory measurements on this session's Node.js 25.1.0 host:
1,000 equal-profile candidates completed in roughly 2–11 ms; 20/40/80 candidates
with two resources in roughly 78–108 ms; one 25-candidate three-resource case
in roughly 422 ms. These measurements include projection costs, are host/load
dependent, and are neither benchmarks on supported Node 22/24 nor upper bounds.

## Remaining work

Fix the new public Next/explanation/schema contract and compose existing
temporal/assurance eligibility before selection. Adopt it consistently through
CLI text/JSON, public library facades, override validation and MCP. Preserve
old-version regression expectations and verify exact/beta installed entrypoints
only after a separately selected release. Plan recording uses the existing
governance API; a candidate preview is not evidence that it was persisted.
