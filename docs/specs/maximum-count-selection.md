# Maximum-count task selection public contract

- Contract revision 1.1, clarified during adoption on 2026-11-13
- Workstream Issue #48, task MAX_COUNT_PUBLIC_CONTRACT
- Governing decisions in [ADR 0011](../adr/0011-rank-backed-start-selection.md)
- Exact selection implementation in [the core contract](maximum-count-selection-core.md)
- Closed artifacts in [NextResult v10](../contracts/maximum-count-next.schema.json)
  [OverrideDecision v2](../contracts/maximum-count-override.schema.json)
  and [MCP Next v2](../contracts/maximum-count-mcp.schema.json)
- Runtime adoption belongs to MAX_COUNT_ADOPTION

## 1. Owner agreement and engineering decisions

The owner requires maximum simultaneous task count under the specified resource
capacity. The owner also requires the remaining units allocatable to the
same-ranked group at an overflowing resource boundary. The corresponding source
messages are the count-first choice and its boundary-tie clarification in this
chat on 2026-11-11. The implementation instruction followed those messages.

The owner explicitly authorized the remaining 18p and 12–24 engineer-hours in
the 2026-11-13 user message immediately following the current-state report,
and directed work to begin with the public contract. That message is the source
for the resumed budget. The earlier plan-registration approval identifies its
own exact candidate and scope.

This contract chooses existing semantic ranking as the secondary objective,
stable IDs as the final deterministic choice, the following successor
identities, and a complete typed input for explaining the chosen set. These
engineering choices implement the agreed count-first behavior.

## 2. Version and distribution identities

| Surface | Identity at adoption |
| --- | --- |
| CLI contract | 12 |
| Normal Next result | Perttool.NextResult.v10 |
| Recommendation interface | 2 |
| Selection algorithm | perttool.dispatch.maximum-count, version 1 |
| Algorithm metadata | optimal true, optimality_scope task_count |
| Authority policy | max_count_dispatch_v1_plus_release_gate_plus_plan_assurance_v1 |
| Reason taxonomy | 2.0 |
| Explanation model | 2 |
| Expression model | 1 |
| English description registry | 2 |
| Override result for a v10 source | Perttool.OverrideDecision.v2, override_contract_version 2 |
| MCP Next wire result | Perttool.McpNextResult.v2 |
| MCP transport protocol model | 1 |
| Accepted source grammar | 1 through 10 |

The public root and Node facade keep 155 runtime exports and the portable Core
subpath keeps 51. The existing selectNextTasks and validateOverride functions
carry the successor results. NextResult and NextResultV10 types describe the
new normal result. RecommendationAnalysis names the model-2 analysis, with
RecommendationAnalysisV1 preserving the model-1 definition. NextResultV9
preserves the previous result definition. OverrideRequest and
OverrideValidationResult discriminate their supported source/result versions,
so existing v8/v9 callers retain the model-1 path. Version-specific aliases
describe each supported branch explicitly. Normal recommendation record aliases
use model 2, with their V1 aliases retaining model 1. NextTask and NextGroups
use the v10 shapes, including nullable resource criticality, and retain the
original v3 shapes under version-specific aliases.
The portable Core subpath continues its document/session responsibilities.

The active command catalog contains 75 commands. The existing dag next operands
and options include repeatable --capacity RESOURCE=N. Capacity denotes units of
the named resource. Each selected task consumes its declared requirements, and
active tasks consume capacity before new selection.

At adoption, the 31-entry schema catalog gains NextResult v10 and OverrideDecision
v2, for 33 entries. NextResult v10 becomes the command result for dag next.
NextResult v9 becomes a library compatibility schema, retaining its Contract 11
identity. OverrideDecision v1 remains a library compatibility schema. The two
new closed schemas are registered together with their consumers.

Historical v8/v9 data, the Issue #37 expectation, and algorithm-1 ranking keep
their version-specific interpretation. Exact old packages provide the old CLI
entrypoint and rollback route. Current normal selection uses v10. Package
release selection and distribution are subsequent operations.

## 3. Selection domain and objective

Application projects one validated source snapshot. It derives ready tasks,
effective reached milestones, active allocations, applied resource capacities,
exact precedence ranking facts, time eligibility and plan-assurance eligibility
from the shared owners. All ready tasks appear in the selection input.

Eligible candidates have eligible time and assurance states. Active, suspended,
blocked, upcoming and done tasks and gates retain their existing classifications.
Time eligibility uses the established release-bound rules. Assurance eligibility
uses the established not_applicable, conditional and verified statuses. Plan
Review advisories continue to be projected through their established advisory
surface. Milestone acceptance and global assurance/source failures retain their
existing result validity and authority consequences.

The exact primary objective is the size of S, a subset of eligible candidates,
subject to every applied resource capacity.

```text
maximize |S|
active_usage(r) + sum(requirement(t,r), t in S) <= applied_capacity(r)
```

For equal maximum counts, compare the vector of selected counts by semantic
rank group, best group first. Prefer the lexicographically larger vector.
The existing lexicographic ranking keys define groups through expected duration,
before the final task-ID comparison. Then prefer the earliest selected task-ID
vector within the semantic-rank/ID ordered candidates. Every tie-break retains
the primary maximum count.

Rank groups are zero-based consecutive integers assigned over all ready
candidates. Equal keys form one group. Candidate arrays use group order and
stable task ID order. The candidate domain extends through the entire ready
frontier. Free tasks consume their declared empty resource vector.

Next selection accepts zero as an applied capacity. A task whose requirement
exceeds an applied capacity remains a ready deferred candidate. Other feasible
tasks remain selectable. The complete-schedule analysis command retains its
existing input and validation contract. If its forecast owner cannot provide a
complete resource forecast under the applied capacities, v10 task
schedule_critical values and schedule_alerts are null. Precedence timing and
its exact velocity conversions retain their established values. Unknown
resources and an applied capacity below active allocation retain their existing
errors.

The registered solver is the exact requirement-profile dynamic program from
the core contract. It returns a terminal optimum before emitting optimal true.
That flag describes simultaneous task count. Forecast makespan and resource
utilization continue to have their own established algorithm qualifications.

## 4. One selected set

For every complete selection, these ordered arrays have identical contents.

```text
recommendation.recommended_task_ids
recommendation.result_decision.recommended_task_ids
recommendation.selection.selected_task_ids
groups.runnable_now
temporal.authority.startable_recommended_task_ids
```

tasks[].runnable_now and task-decision recommended_set_member are true exactly
for members of that set. The normal v2 tiers are recommended and deferred.
Recommended identifies selection members. Deferred identifies other ready
tasks and retains their time, assurance or resource exclusion evidence.

The optimal set is maximal under its constraints, so an eligible unselected
task has a resource conflict against the complete selected set. Resource
rejections name the actual selected occupants and active occupants of the
conflicting resource. Selected tasks have empty resource rejection arrays.
Time- or assurance-withheld tasks carry their own eligibility evidence.

Normal consumers require a successful result, recognized identities, complete
authority, and complete explanation. They can consume a subset using the
existing task-start workflow. A source or execution-state change requires a
fresh analysis through the established workflow. The tool returns the entire
maximum-count set in every complete result.

## 5. Typed selection input and identity

recommendation.selection has the following required fields. All objects use
closed properties, as defined by the linked schema.

| Field | Meaning |
| --- | --- |
| model_version | 1 |
| input_digest | SHA-256 commitment to the normalized input below |
| input | Complete source-bound optimizer input |
| selected_task_ids | One canonical optimum |
| maximum_task_count | Length of selected_task_ids |
| resources | Budget for the complete chosen set |
| boundary_groups | Overflowing eligible semantic-tie groups |

The input contains model_version, source_digest, grammar_version, duration_unit,
critical_epsilon, capacity_overrides, resources, active_tasks, candidates and
rank_groups. Resources carry resource_id, applied capacity, active_usage and
active_task_ids. Active tasks carry IDs and sorted requirements. Each candidate
carries task_id, rank_group, sorted requirements, time_eligibility and
assurance_eligibility. Time states are eligible, not_yet_eligible and unavailable.
Assurance states are eligible, withheld and unavailable.

Each rank group carries rank_group, task_ids and rank_key. The key contains
critical_class, precedence_total_float, explicit_priority, new_ready_task_count,
new_satisfied_gate_count, new_reached_milestone_count, next_gate_task_distance,
finish_task_distance and expected_duration. Rationals use reduced decimal-string
numerator and positive denominator. Next-gate distance also permits infinity.

Resource arrays and requirements use stable resource-ID order. Active tasks
and IDs within a group use stable task-ID order. Capacity overrides preserve
the exact supplied override membership, sorted by resource ID. Rank groups and
candidates use the order from section 3. Safe integers represent counts and
units. Exact rational keys carry selection meaning independently of precision.

Compute input_digest as sha256 of UTF-8 RFC 8785 canonical JSON of input, with
the sha256 prefix. The existing model/rfc8785 serializer supplies this operation.
Arrays already have the specified order. The result decision ID is
rec:decision:result:R followed by a colon and the complete input_digest.
This reuses the existing source_result_decision_id request field to bind an
override to the selected source, capacities, allocations and eligibility.

CLI and registered-source adapters derive source_digest from their exact raw
source bytes. The library host retains its established sourceDigest ownership
when preparing source projections. The same supplied source identity is used
throughout input, facts, authority and result projections.

## 6. Boundary groups and allocatable units

A boundary group has at least two eligible same-ranked members and at least
one unselected member. Its candidates list includes every eligible member and
their exact requirements. It also carries rank_group, selected_task_ids,
unselected_task_ids, outside_selected_task_ids and resources. The rank_group
links to the complete comparison key in input.rank_groups.

For each resource the closed budget contains resource_id, capacity, active_usage,
outside_group_usage, allocatable_units, selected_usage and remaining_units.

```text
outside_group_usage = selected demand outside this group
allocatable_units = capacity - active_usage - outside_group_usage
selected_usage = selected demand inside this group
remaining_units = allocatable_units - selected_usage
```

The top-level resources budget uses zero outside_group_usage and the complete
selected demand. Group budgets are conditional on outside_selected_task_ids.
Different resource IDs retain separate unit values. Candidate requirements and
selected IDs establish how many tasks fit a given budget. Unselected IDs retain
their explicit unselected status through text and JSON presentation.

The boundary fixture has capacity 4, one active unit and one selected unit
outside X/Y/Z. Its group budget is 2 units, X/Y consume 2 and the remainder is 0.
All three eligible IDs appear in the boundary explanation.

## 7. Authority projection

The authority policy and recommendation_algorithm identify this contract's
selector. complete and safe_stop_reasons retain their existing proof-availability
role. deadline_facts_used_for_ranking is false for the inherited ranking keys.

time_eligible_task_ids, time_ineligible_task_ids,
time_eligibility_unavailable_task_ids and assurance_eligible_task_ids retain the
full evaluator facts. The following arrays concern ready candidates only.

| Field | Contents |
| --- | --- |
| eligible_task_ids | Both eligibility states are eligible |
| time_withheld_task_ids | Time state is not_yet_eligible |
| assurance_withheld_task_ids | Assurance state is withheld |
| unavailable_task_ids | Either eligibility state is unavailable |
| startable_recommended_task_ids | The shared selected set |

The v10 authority omits the v9 raw/intermediate recommendation arrays and the
recommended-only withholding arrays. The complete input supplies exclusion
facts for every ready task, including tasks beyond the old horizon.

A complete successful computation includes a recommendation object even when
the selected set is empty. An unavailable computation has recommendation null,
empty runnable membership and empty final start authority. Existing explicit
CLI warning-failure behavior can project completed evidence with ok false.
Normal consumers use the root success condition along with authority completeness.

## 8. Structured explanation and descriptions

RecommendationAnalysis model 2 retains the typed decision/fact/comparison/
reason/description record containers and expression model 1. It adds selection
and the scoped optimality metadata from section 2. Every ready task has one
task decision. Facts share the source identity and all graph references resolve.

Allowed phases are eligibility, candidate_ranking, set_optimization,
resource_selection, boundary_budget, set_membership and tier_classification.
The closed reason taxonomy contains the following codes.

| Code | Required supporting facts |
| --- | --- |
| task_ready | Source classification |
| time_eligible | Evaluated release state |
| time_ineligible | Evaluated future release state |
| time_eligibility_unavailable | Evaluated unavailable cause |
| assurance_eligible | Evaluated allowed assurance status |
| assurance_withheld | Evaluated withheld status and cause |
| assurance_unavailable | Evaluated unavailable status and cause |
| maximum_task_count | Eligible domain, completed exact algorithm, selected count |
| rank_group_counts | Chosen count vector and all comparison keys |
| task_id_tiebreak | Canonical selected ID vector after count objectives |
| recommended_set_selected | Membership in the shared set |
| recommended_set_not_selected | Absence from the shared set |
| recommended_set_feasible | Active and selected resource witnesses |
| recommended_set_resource_conflict | Actual deficit against the shared set |
| ranking_rule_supports_task | Typed candidate comparison |
| ranking_rule_opposes_task | Typed candidate comparison |
| ranking_rule_tied | Typed equality before the decisive comparison key |
| boundary_group_capacity | Complete conditional group budget and member IDs |

The result decision depends on the complete optimization input and the chosen
objective vector. Task membership decisions depend on that result. Unselected
decisive reasons use their own eligibility or final resource deficit. Candidate
comparison winners describe rank order. Adjacent ordered candidate comparisons
and complete rank keys provide deterministic comparison evidence.

The schema fixes the fact-kind vocabulary for exact ranking keys, source
classification, eligibility, the input commitment, objective values, selected
membership and resource budgets. Resource-specific facts carry the resource
entity and its unit. Boundary facts also identify their rank group. Canonical
rational strings and reduced fractions are validated against the source facts.

explanation_status is full, complete and decisive_chain_complete true, truncated
false and all omitted counts zero. explain-depth changes the inherited task
presentation depth while selection input and boundary groups remain complete.
The registered producer owns exactness. Shape and reference validation establish
coherence, and independent exact-oracle tests establish optimizer correctness.

Registry 2 renders canonical English descriptions from typed parameters. Keys
use recommendation.reason followed by the exact reason code, and each task has
a recommendation.summary.recommended or recommendation.summary.deferred key.
Selected summaries identify membership and the count-first objective. Deferred
summaries identify the task's recorded exclusion. Boundary descriptions carry
resource_id, allocatable_units, selected_usage and remaining_units. Formatting
uses existing exact quantity rendering and stable ID order. Text bindings,
template parameters and cross-references are validated with PTREC-303.

The [complete registry](../contracts/maximum-count-descriptions.json) fixes all
20 keys, parameter names, parameter kinds and exact templates. Integer values
render as decimal digits. Entity values render their IDs. List values render
in their defined order between square brackets, separated by comma and space.
Resource-unit parameters carry the matching resource unit in their unit field.
The task-decision object uses the linked schema's fields and the v2 membership
trace. Its v1 primary_higher_priority_task_id field is retired in v2.

The result, snapshot, rank keys, memberships and resource relations are checked
with PTREC-301. Registered version, code and phase identity uses PTREC-302.
Existing internal-invariant exit 70 applies through the CLI owner. Source,
temporal, assurance and acceptance diagnostics retain their own owners.

## 9. CLI and MCP projection

CLI JSON uses the full closed v10 artifact. Human output includes these
mandatory selection and boundary lines, along with existing task sections.

```text
SELECTION OBJECTIVE maximum_startable_task_count
MAXIMUM STARTABLE TASKS 3
STARTABLE RECOMMENDED P X Y
BOUNDARY RANK GROUP 1
TIED ELIGIBLE X Y Z
OUTSIDE SELECTED P
SELECTED X Y
UNSELECTED Z
RESOURCE WORKER capacity=4 active=1 outside=1 allocatable=2 selected=2 remaining=0
```

Each boundary group and each resource receives its own lines. Recommended,
runnable and startable sections describe the shared selected set. Empty
selection renders the count and the recorded task exclusions.

The existing MCP tool name perttool_next advertises NextResult v10 and
McpNextResult v2. Its protocol model remains 1. Its semantic result uses the
same projection and carries the complete selection. Source binding matches
the raw digest and the selection input. The adapter-owned schema is derived
from v10, including every local definition and Common dependency. Discovery
metadata, wire identity, semantic result identity and Guide change together.
The derivation retains semantic allOf conditions, including complete authority
and required selection data for successful results. Removing facade metadata
preserves those conditions on the nested semantic result.

The existing MCP source/request/output limits and cancellation/deadline behavior
apply. Expiry follows the existing PTMCP-107 result path. Oversized output uses
the established output-limit error. Successful output contains the full boundary
group membership. The Application uses the registered exact solver for its
normal synchronous library and CLI entrypoints.

The private editor DAG-focus service and Planning Pool execution context also
consume the shared selection for recommended and startable IDs. Their existing
wire fields and source bindings retain their definitions. Editor graph forecasts
continue through the analysis service. These dependencies were directly traced
during adoption on 2026-11-13.

## 10. Override model 2

validateOverride accepts a v10 source with the existing request shape and its
source_schema_version discriminator. The source_result_decision_id contains the
input digest from section 5. It must match the complete supplied source result.
The source's selected IDs, input, source digest, capacities and resource usage
are validated against the actual source result before producing evidence.

A v10 source returns OverrideDecision v2. Its source projection contains
selection_algorithm and selection_input_digest, along with the versioned
explanation identities and normal recommendation. Its existing selected,
retained, displaced and nonrecommended membership fields preserve the chosen
human deviation. source capacities and active allocations determine joint
feasibility of the requested replacement. Time and assurance eligibility use
the actual source facts for every selected task, including unselected ready
candidates. Existing actor/reason, single-use and read-only validation semantics
apply. Legacy source versions follow their own v1 validation path.

The v2 normal tiers make deferred_selected the applicable override trigger.
Retaining a subset of the normal selected set follows the established subset
workflow. A selected deferred task still needs the source's ready, temporal,
assurance and resource feasibility conditions to hold for the requested set.

Compute override_id as override followed by a colon and the SHA-256 digest of
UTF-8 RFC 8785 canonical JSON of the entire override decision excluding its
override_id field. The digest uses the sha256 prefix. Existing request
normalization applies, and selected task IDs use the source candidate order.

## 11. Adoption and verification

Application exposes one source-bound selection after shared source, temporal
and assurance evaluation. The recommendation owner handles exact packing,
semantic grouping and the typed explanation. Authority and override validate
their registered model identities. CLI, schema registry, Guide and MCP project
that same result. Forecast scheduling uses its established implementation.

Adoption must trace these obligations through real entrypoints.

1. Issue #37 under its historical identity and the one-slot v10 disagreement.
2. Two available units across the former horizon and an already active unit.
3. Count-first packing where the highest-ranked task loses to two smaller tasks.
4. Time and assurance withholding before optimization, including unavailable
   evidence and existing whole-result failures.
5. Tied-boundary budgets, distinct resources, unequal demands, and a tied member
   unable to replace a chosen member under the displayed conditional budget.
6. Input digest changes for capacity, active, source or eligibility changes,
   stable digest for equivalent normalized input ordering, and stale override IDs.
7. Closed schemas, exact objective metadata, reference closure, description
   binding and rejection of conflicting selected memberships.
8. Core/Node facade, file/stdin CLI, text/JSON, Guide, MCP and isolated-package
   parity with complete source and filesystem readback.

This task prepares the linked closed schemas and executable contract examples.
MAX_COUNT_ADOPTION connects them to the normal runtime entrypoints, followed
by MAX_COUNT_ACCEPTANCE for the complete cross-surface trace.
