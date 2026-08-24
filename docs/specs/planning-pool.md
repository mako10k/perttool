# Work-centered Planning Pool and Window Contract

- Status: Normative 1.0
- Contract ID: `PLAN-POOL-001`
- Target source grammar: 9
- Target CLI contract: 10
- Source model: `Perttool.PlanningPoolModel.v1`
- Created: 2026-08-24
- Decision record: [ADR 0008](../adr/0008-work-and-windows-for-draft-planning.md)
- Backlog item: [PLAN-POOL-001](../backlog.md#plan-pool-001-add-a-planning-pool-and-bounded-work-windows)
- Selected workstream: [`plans/planning-pool.pert`](../../plans/planning-pool.pert)
- Separate composition scope: [Issue #3](https://github.com/mako10k/perttool/issues/3)

## 1. Purpose and precedence

This contract turns ADR 0008 into one implementation boundary for incomplete
single-document planning, Work backlog operation, and persisted or ad hoc
Windows around the existing strict Activity-on-Arrow execution DAG. It fixes
source syntax, semantic ownership, mutation requests, guided preflight,
observation, history, command and result identities, diagnostics, limits,
migration, and compatibility before runtime work begins.

Normative precedence for this feature is:

1. Must requirements in [`requirements.md`](../requirements.md);
2. this contract;
3. [ADR 0008](../adr/0008-work-and-windows-for-draft-planning.md);
4. [`basic-design.md`](../basic-design.md);
5. the machine cases in
   [`planning-pool-contract-v1.json`](../../test/fixtures/planning-pool-contract-v1.json);
6. Help, Guide, examples, and implementation structure.

The machine fixture is normative where it supplies an exact identifier,
limit, vector, command path, or dependency-ordered case. It does not claim
that the currently active runtime already implements the target.

## 2. Closed scope

The contract has three use cases:

1. keep incomplete Work in the canonical `.pert` document before a complete
   strict PERT can be stated;
2. refine a backlog through project-owned Event and Activity AoA primitives,
   then move their meaning once into Milestone and Task owners; and
3. select Work into Scrum-like, Kanban-like, release, team, or thematic
   Windows without making selection executable.

The strict DAG remains the only executable and schedulable plan. Work order,
Work dependency, Event, Activity, projection link, Window membership, Window
objective, or elapsed Window time grants no Task start authority and changes
no PERT/CPM, resource, acceptance, assurance, actual, velocity, or project
finish meaning.

This contract does not add multiple `.pert` files, imports, mounts, aliases,
nested namespaces, parent or child plans, hierarchical recommendation, a
generic `related_to` relation, editor mutation, MCP mutation, a release,
publication, remote write, Issue mutation, or plan advance. Those remain
separate decisions.

## 3. Grammar 9 source model

### 3.1 Additive declarations

Grammar 9 inherits every Grammar 8 declaration, field, exact value, validation
rule, source-ownership rule, and continuous or calendar temporal meaning. It
adds exactly five top-level forms:

```ebnf
PlanningDeclV9 = WorkDeclV9
               | PlanningEventDeclV9
               | PlanningActivityDeclV9
               | WindowDeclV9
               | WorkOrderDeclV9 ;

WorkDeclV9 = "work", HSPACE, Identifier, ":", NEWLINE,
             INDENT, WorkFieldV9, { NEWLINE, WorkFieldV9 }, DEDENT ;

WorkFieldV9 = TitleField
            | DescriptionField
            | EventRefsField
            | ActivityRefsField
            | MilestoneLinksField
            | TaskLinksField
            | DependsOnField ;

EventRefsField       = "events:", NEWLINE, RefBlock ;
ActivityRefsField    = "activities:", NEWLINE, RefBlock ;
MilestoneLinksField  = "milestone_links:", NEWLINE, RefBlock ;
TaskLinksField       = "task_links:", NEWLINE, RefBlock ;
DependsOnField       = "depends_on:", NEWLINE, RefBlock ;
RefBlock             = INDENT, Identifier,
                       { NEWLINE, Identifier }, DEDENT ;

PlanningEventDeclV9 = "event", HSPACE, Identifier, ":", NEWLINE,
                      INDENT, EventFieldV9,
                      { NEWLINE, EventFieldV9 }, DEDENT ;
EventFieldV9 = TitleField | DescriptionField | TagsField | SourceField ;

PlanningActivityDeclV9 = "activity", HSPACE, Identifier, HSPACE,
                         Identifier, HSPACE, "->", HSPACE, Identifier,
                         ":", NEWLINE,
                         INDENT, ActivityFieldV9,
                         { NEWLINE, ActivityFieldV9 }, DEDENT ;
ActivityFieldV9 = TitleField | DescriptionField | DurationField
                | EstimateField | PriorityField | RequiresField
                | OwnerField | TagsField | SourceField | CalendarField
                | WhenField | DeadlineField ;

WindowDeclV9 = "window", HSPACE, Identifier, ":", NEWLINE,
               INDENT, WindowFieldV9,
               { NEWLINE, WindowFieldV9 }, DEDENT ;
WindowFieldV9 = TitleField | ObjectiveField | WindowStartField
              | WindowEndField | WindowWorksField ;
ObjectiveField   = "objective", HSPACE, StringValue, NEWLINE ;
WindowStartField = "start", HSPACE, ( IsoDate | IsoDateTime ), NEWLINE ;
WindowEndField   = "end", HSPACE, ( IsoDate | IsoDateTime ), NEWLINE ;
WindowWorksField = "works:", NEWLINE, RefBlock ;

WorkOrderDeclV9 = "work_order:", NEWLINE,
                  INDENT, Identifier,
                  { NEWLINE, Identifier }, DEDENT ;
```

`TitleField`, `DescriptionField`, task-plan fields, temporal values, strings,
indentation, comments, and identifiers reuse Grammar 8 exactly. `event`,
`activity`, `work`, `window`, `work_order`, `events`, `activities`,
`milestone_links`, `task_links`, `depends_on`, `objective`, `start`, `end`,
and `works` are contextual only in the positions above. Grammar 1 through 8
continue to reject the new top-level declarations.

### 3.2 Example

```pert
project DELIVERY:
  version 9
  title "Delivery"
  duration_unit point
  finish RELEASED

work LOGIN:
  title "Trusted sign-in"
  description "A user can establish a trusted session."
  events:
    SESSION_NEEDED
  activities:
    BUILD_SESSION
  depends_on:
    IDENTITY

event SESSION_NEEDED:
  title "Trusted session is needed"

activity BUILD_SESSION SESSION_NEEDED -> RELEASED:
  title "Make a trusted session possible"
  duration 5p
  requires:
    DEVELOPERS 1

window SPRINT_42:
  title "Sprint 42"
  objective "Users can test the trusted-session path."
  start 2026-08-24
  end 2026-09-07
  works:
    LOGIN

work_order:
  IDENTITY
  LOGIN
```

The example assumes declarations for `IDENTITY`, `DEVELOPERS`, and the strict
boundary Milestone `RELEASED`. The Activity is not executable even though it
already carries a candidate duration and resource requirement.

### 3.3 Field presence and canonical order

| Declaration | Required | Optional | Forbidden |
| --- | --- | --- | --- |
| Work | one non-empty `title` | one non-empty `description`; each reference block | lifecycle, estimate, resource, acceptance, or status fields |
| Event | one non-empty `title` | `description`, `tags`, `source` | Milestone state, deadline, criterion, or receipt fields |
| Activity | one non-empty `title`; two header endpoints | Task plan fields listed in the EBNF | status, work event, actual, task outcome, plan seal, or execution fields |
| persisted Window | one non-empty `title`, one non-empty `objective`, one non-empty `works` block | `start`, `end` | lifecycle, achieved, completion, Task, Milestone, or acceptance fields |
| `work_order` | every current Work exactly once | none | duplicate, missing, unknown, or non-Work entries |

An omitted Work `description` is the empty residual-description value. A
present value is non-empty. The same rule applies to optional Event and
Activity descriptions. A persisted Window always selects at least one Work;
an empty ad hoc selection is valid request input for comparative reporting.

Canonical Work field order is `title`, `description`, `events`, `activities`,
`milestone_links`, `task_links`, `depends_on`. Canonical Event field order is
`title`, `description`, `tags`, `source`. Canonical Activity plan fields follow
the Grammar 8 Task-plan order after its required `title`. Canonical Window
field order is `title`, `objective`, `start`, `end`, `works`.

New planning declarations are inserted after project, calendar, and resource
declarations and before strict Milestone and edge declarations in the order
Work, Event, Activity, Window, then the singleton `work_order`. Within each
kind, a multi-create request uses local ID order. Existing source-preserving
operations do not globally reorder declarations, comments, or unrelated
bytes.

### 3.4 Identity and references

The effective root namespace is the project ID. A current local entity `X`
has machine identity `PROJECT::X`; source references remain the unqualified
local ID. The source lexer reserves `::` and Grammar 9 rejects qualified
references because mounting and cross-document resolution belong to Issue #3.

Work, Event, Activity, Window, Resource, Milestone, Task, Gate, work-event,
and independently identified relation records share the existing global local
ID namespace. Owner records whose header repeats the identity of their owned
Task or Milestone retain their accepted Grammar 6 or 7 exception and do not
allocate a second entity ID. Results return both `id` and `qualified_id`.

`title` is required, mutable, Unicode-capable, non-unique display text. It is
never a reference. Human output shows title first and local ID second; machine
output never resolves by title.

A source-valid current document proves only current uniqueness. A mutating
creation against a tracked file additionally uses bounded first-parent Git
evidence to reject reuse of a retired fully qualified identity for different
meaning. An untracked new document has no retired identities. Missing,
shallow, raced, invalid, or over-limit history makes a history-sensitive
creation unavailable; direct text editing receives no false history proof.

## 4. Work, AoA, order, and dependency semantics

### 4.1 Work boundary

Work is an independently orderable and selectable backlog organization
boundary. It has no stored status, completion, acceptance, or lifecycle. Its
optional description owns only residual intent not currently owned by a
project-owned Event, Activity, or strict DAG entity.

An Event owns one premise, intermediate condition, or desired state. An
Activity owns one directed transition. Event and Activity are Temporary Draft
entities and do not participate in strict scheduling or execution.

Every current Event or Activity has at least one Work association. Work owns
the association, not the Event or Activity meaning. Removing a non-last
association preserves the entity. Removing the last association requires one
explicit re-association, projection, or discard in the same final candidate.
No orphan Temporary Draft remains.

An Activity endpoint resolves to either a planning Event or a strict
Milestone. Both endpoints are always present. Draft fragments may be
disconnected or cyclic and remain source-valid. They become projectable only
as a closed endpoint-complete acyclic strict candidate.

### 4.2 Project-wide order

If the document contains Work, it contains exactly one `work_order`. If it
contains no Work, it contains no `work_order`. The order is a total,
duplicate-free sequence of every current Work and is independent from source
placement, identity, title, dependency, Window, and strict topology.

Creation and split state an insertion anchor. Merge keeps the surviving
Work's former position and removes absorbed positions. Partial reshape keeps
all positions unless the request supplies a complete changed sequence.
Archival removes the Work and order entry atomically. A Window filters this
global sequence and never owns another order.

### 4.3 Work dependency

`A depends_on B` is stored only in A and means that B must be considered or
sufficiently refined to shape A responsibly. It has no satisfied, complete,
blocked, or ready state. It creates no Event, Activity, Task, Gate, Milestone,
or start authority.

Self-dependency and duplicate pairs are invalid current source. Cycles are
valid but have no advisory ready order. A prerequisite after its dependent in
`work_order`, a cycle, and a dependency outside a selected Window are reported
independently and never reorder or auto-select Work.

Every operation affecting a Work enumerates all incident dependencies with
exactly one disposition:

| Disposition | Final meaning |
| --- | --- |
| `retain` | preserve the same endpoints |
| `rebind` | replace one or both endpoints with identified final Work |
| `represented` | remove the relation and cite existing final Event, Activity, Milestone, or Task owners |
| `no_longer_required` | remove the planning premise explicitly |

Rebinding coalesces duplicate pairs. A rebound self-dependency requires an
explicit `represented` or `no_longer_required` internalization; otherwise it
fails. A cited owner proves only existence and final ownership, not natural-
language equivalence. Any undisposed incident relation blocks archival.

## 5. Semantic reshape and guided preflight

### 5.1 Request identities

The typed request is `Perttool.PlanningReshapeRequest.v1`, normalized by
`perttool.planning-reshape-normalization@1`. Its closed top-level fields are:

| Field | Meaning |
| --- | --- |
| `request_schema_version` | exact request identity |
| `normalization_contract` | exact normalization identity |
| `source_digest` | exact SHA-256 raw source binding |
| `intent` | `reshape`, `project`, `defer`, `archive`, or `composite` |
| `affected_work_ids` | complete affected fully qualified Work set |
| `created_works` / `removed_work_ids` | exact boundary changes and insertion anchors |
| `semantic_elements` | complete residual-description origin and destination rows |
| `planning_entity_dispositions` | every affected Event or Activity creation, retention, projection, deferral, or discard |
| `association_dispositions` | every affected Work-to-planning-element association |
| `projection_link_dispositions` | every affected Work-to-strict-entity trace link |
| `dependency_dispositions` | every incident Work dependency |
| `window_membership_dispositions` | every affected reference from an active Window |
| `final_work_order` | complete final Work sequence when it changes |
| `add_residual_description` | explicit Work ID and final residual text values |
| `strict_fragment` | typed projection or deferral selection, otherwise `null` |
| `window_close` | optional audited composite close, otherwise `null` |

Unknown fields, duplicate rows, incomplete affected-Work coverage, ambiguous
references, and unknown enum values fail. Governance inputs, actor, owner
assertions, output options, and the token are excluded because they do not
change reshape meaning.

### 5.2 Description inventory

Each existing semantic row identifies an operation-local `element_id`, source
Work, exact UTF-16 span in the parsed description, exact source text, and one
destination. Source spans for an affected non-empty description form one
ordered, gap-free, non-overlapping partition of the complete decoded value.
Each created row contains exact text and `asserted_new_meaning: true` bound to
the source digest. A destination is either:

- one final Work with a unique zero-based position and exact destination text;
  or
- `discard` with an optional reason.

Concatenating destination text by position reconstructs the exact final parsed
description; perttool inserts no separator. An unchanged row remains explicit.
The audit can prove coverage, one destination, exact reconstruction, and a
byte-identical no-op. It cannot prove conceptual element boundaries, semantic
novelty, equivalence, or wisdom of a discard.

The full operation inventory is the union of description rows and every typed
entity, association, link, dependency, membership, projection, deferral, and
archive disposition. Those operation-local rows are result evidence only;
they are never persisted as statements, transfer records, redirects, lineage,
or tombstones.

### 5.3 Normalization and hash

Normalization produces canonical UTF-8 JSON with no BOM or insignificant
whitespace. Object keys use ascending Unicode scalar-value order. Integers use
minimal decimal spelling. Strings preserve the parsed value exactly with no
Unicode, case, temporal, or line-ending normalization. Arrays whose contract
is a set sort by their fully qualified identity or closed composite key;
`semantic_elements`, destination positions, `final_work_order`, and cited
path evidence retain their semantic order. The exact rules and fixed vectors
are in the machine fixture.

```text
preflight_hash = "sha256:" + lowercase_hex(
  SHA-256(canonical_normalized_request_utf8)
)
```

The source raw-byte digest and final-candidate raw-byte digest remain separate
bindings. Two requests with identical raw bytes but different meaning-bearing
array order do not normalize together.

### 5.4 Preflight result and token

`work reshape preflight` is read-only. It parses, normalizes, audits, plans the
complete final candidate, and returns `Perttool.PlanningReshapePreflightResult.v1`
with:

- source, normalized-request, preflight-hash, and candidate bindings;
- actual before and candidate Work descriptions;
- before and after decompositions and exact origin-to-destination mapping;
- entity, association, projection-link, dependency, membership, order,
  projection, deferral, archive, and Window-close changes;
- complete mechanical diagnostics and authority impact preview; and
- on successful audit, one opaque `preflight_token` returned in a distinct
  field.

The token uses at least 256 bits from a cryptographically secure random source.
It is not caller-supplied, salted into the hash, or derived from request bytes.
The transient registry stores only a token digest and binds it to the hash,
source digest, candidate digest, normalization identity, issued and expiry
times, and state. Its fixed lifetime is 3,600 seconds. Expired records may be
removed; an unexpired record is not evicted to admit another request.

The clear token is returned once and is never written into `.pert`, Git,
ordinary diagnostics, or cleartext registry storage. It is an operation-
navigation receipt, not an authentication secret.

### 5.5 Apply, consumption, and user response

`work reshape apply` requires the same request, exact `preflight_hash`, and
matching unexpired unused `preflight_token`. It re-normalizes, re-hashes,
re-audits, and reproduces the exact candidate before authority or persistence.
A changed source, request, candidate, normalization contract, expired token,
unknown token, mismatch, or consumed token fails with no force path and
requires a new preflight.

The token enters `committing` only after every validation, governance,
assurance, history, source, and race gate passes. Successful exact execution,
including a bound no-op, consumes it. Failure before mutation leaves it unused
until expiry. If interruption occurs while committing, retry is recoverably
idempotent: exact old source returns the token to unused, exact candidate bytes
complete consumption and return the same success, and any third digest fails
unavailable. Replay after consumed state never repeats a write.

The LLM reviews the preflight evidence internally and submits a new request
when its decomposition is unsatisfactory. No self-review field, assertion,
receipt, or log is required or persisted. When the reproduced candidate
affects an existing governance scope, the apply preview marks
`user_response_required: true`, identifies the exact required owner and
candidate digest, and instructs the LLM to wait for a new user response before
supplying the ordinary candidate-bound assertion. The token cannot stand in
for that response.

This is guided LLM-operation navigation. It does not claim OS-user separation,
authentication, signing, secure transport, resistance to deliberate local
tampering, or protection against an intentionally false caller assertion.

### 5.6 Residual-description action and no-op assistance

Both reshape commands expose the user action `Add residual description`, CLI
option `--add-residual-description`, and JSON field
`add_residual_description`. The repeatable CLI value is
`WORK_ID=<JSON string>` or `WORK_ID=@<UTF-8 path>`; file bytes are decoded
without trimming and `@-` is invalid when either document or request already
uses stdin. The merged normalized request is identical across preflight and
apply.

`PTPOOL-112` is one prominent non-blocking warning only when the original
parsed Work description is non-empty, the candidate materializes at least one
associated Event, Activity, Milestone, or Task, the final parsed description
is equal to the original value, and the action was not used for that Work.
Changing, clearing, or explicitly supplying the final residual suppresses it.

`PTPOOL-117` reports a complete byte-identical reshape candidate. It is
non-blocking by default and is the only general no-op assistance required.
Neither warning performs semantic equivalence or coverage inference.

## 6. Projection, archival, advance, and deferral

### 6.1 Same-identity global projection

Projection selects project-owned entities, never one Work association.

- Event becomes one same-identity strict Milestone and the Event declaration
  disappears.
- Activity becomes one same-identity strict Task and the Activity declaration
  disappears.
- Every associated Work is affected, and every association becomes one
  same-target `milestone_link` or `task_link` atomically.
- Title, description, candidate estimate, resources, temporal fields, and all
  other selected facts move to the strict owner and are no longer editable on
  the planning side.

An Activity projects only when both endpoints resolve to an existing strict
Milestone or an Event projected in the same candidate, every required strict
Task fact is complete, and the final strict DAG is closed, acyclic, valid, and
connected to `project.finish`. A planning cycle can remain draft but cannot be
projected as a strict cycle. Projection does not invent plan seals, milestone
criteria, acceptance evidence, actuals, or Work dependency edges.

Direct strict Milestone and Task creation remains valid and creates no Work
link. A projection link can be created only by projection and restored only by
eligible deferral; it is not a generic relation to an arbitrary strict entity.

### 6.2 Shared Task and Milestone ownership

A shared Activity projects once to one Task. The Task alone owns estimate,
resources, state, work events, active time, actual effort, completion, and
velocity contribution. Every linked Work detail may display the complete fact
and complete linked-Work set, but no Work percentage, weight, effort, points,
or duration allocation exists. Aggregates union fully qualified Task IDs and
count each once. A Task also linked outside the selection is `non_exclusive`.

Symmetrically, a shared Event projects once to one Milestone. The Milestone
alone owns reach, criterion sets, receipts, and acceptance. Every linked Work
may display the complete fact; aggregates union fully qualified Milestone IDs
once and mark selected-and-unselected contribution non-exclusive. Acceptance
contributes only to the Work or Window outcome axis. It does not complete
Work, achieve a Window objective, or prove `project.finish`.

Independent execution or outcome accounting requires a semantic split before
the Task has any execution evidence and before the Milestone is reached or has
criterion or receipt evidence. Actual-bearing Tasks and evidence-bearing
Milestones are never copied, split, or reallocated retroactively.

### 6.3 Temporary Draft and canonical history

Event and Activity declarations are Temporary Draft. Preview reports their
exact removal, but an in-place reshape, projection, or explicit discard does
not require Git recoverability for ranges owned only by those declarations.
Expected digest, candidate validation, source binding, race checks, and atomic
replacement still apply.

Work, Work description, Work order, dependency, projection link, Window, and
Window membership are canonical current planning facts. An in-place mutation
that removes or replaces their bytes requires exact `HEAD` and stage-0
recoverability for each destructive range. Separate output remains Git-
independent. Planning commands have no history-force option.

Archive is contraction, not a state. A Work is archiveable only with no
residual description, planning association, live dependency, Window
membership, other current non-DAG relation, or useful projection link. Archive
removes Work, links, and its order entry atomically and persists no tombstone.

Grammar 9 `dag advance` always prunes links to strict targets removed by the
same candidate. It never auto-archives Work. The optional
`--archive-empty-work` selects only Work made archiveable by those pruned
links. `Perttool.AdvanceResult.v4` adds the exact removed link and archived
Work sets. Existing advance history safety and its already narrow
`--force-history-loss` option cover the complete advance candidate; no other
planning command gains that option.

### 6.4 Narrow deferral

Deferral is a `PlanningReshapeRequest.v1` intent and never follows from Window
operation. Every selected Task must have a live Work projection link, be
planned and unstarted, and have no status transition, work event, actual,
active time, suspension, completion, task outcome, or other execution evidence.
It becomes one same-identity Activity and all links become Work associations.

An explicitly selected internal Milestone may become one same-identity Event
only when unreached, unaccepted, free of criterion and receipt evidence, and
unused by retained Task, Gate, or `project.finish`. Boundary Milestones remain
strict and may be Activity endpoints. Plan-assurance, acceptance, governance,
history-owned, actual, or ambiguous protected evidence makes the operation
unavailable unless this contract gives its exact disposition. The remaining
strict DAG must remain valid, closed, acyclic, and finish-connected.

Deferral preserves Work descriptions, dependencies, order, and Window
membership unless a separately enumerated composite reshape changes them. It
is not a copy, Git revert, raw deletion, or actual-history rewrite.

## 7. Windows

### 7.1 Persisted and ad hoc identity

A persisted Window is active exactly while its declaration is present. It has
no open, closed, archived, elapsed, or achieved field. One Work may belong to
many persisted Windows; each Window-Work pair is unique. Windows may overlap
in membership and time, and no primary Window exists.

An ad hoc Window is `Perttool.PlanningObservationRequest.v1` input only. It
may omit title and objective, selects zero or more Work, and persists no ID,
membership, result, or lifecycle.

### 7.2 Objective and timebox

The required persisted objective is exact temporary, outcome-oriented
coordination rationale, not a Do list, Work meaning, Activity transition,
Task description, Milestone criterion, or acceptance owner. Reports return it
without an achieved Boolean.

`start` and `end` independently accept the existing ISO date or fixed-offset
date-time kinds. If both exist they have the same kind, require `start < end`,
and form `[start,end)`. One absent side is unbounded. Position uses an explicit
compatible observation value, then compatible `project.as_of`; otherwise it
is unavailable. No wall clock, locale, host zone, midnight, Git timestamp,
named-zone conversion, or external calendar is inferred.

Passing a bound mutates nothing. Comparable intervals report exact
intersection and emptiness; incomparable or unavailable kinds return an
unavailable overlap fact. Bounds are not Task constraints, deadlines,
resource availability, dependency edges, or `dag next` authority.

### 7.3 Mutations and close

`Perttool.WindowMutationRequest.v1` is the typed request for add, set, and
close. Add and set state complete final fields and membership changes. Close
must state `objective_disposition: "discard"`, an explicit carry-over list,
and either an existing target Window or complete fields for a new next Window.
An empty list means no carry-over; incomplete Work is not carried implicitly.

Close returns one source-bound report and removes the Window, objective, and
memberships in the same candidate. Carry-over creates only missing target
memberships and reports already-selected pairs without duplication. Other
Window memberships, Work, planning elements, strict DAG, execution, and
acceptance remain unchanged.

If objective meaning must survive under Work, Event, Activity, Milestone, or
Task, the caller first changes the proper owner or uses an audited composite
Work reshape with `window_close`; simple `window close` performs no semantic
copy. Current source retains no closed Window or durable close report. Git owns
former persisted state.

Window mutations use ordinary preview, governance classification, source
digest, canonical history proof, race detection, and safe persistence. They do
not use the semantic-reshape token unless composed with Work meaning movement.

## 8. Observation and Git evidence

`Perttool.PlanningPoolResult.v1` reports source-bound Work and Window facts on
independent axes:

| Axis | Closed facts |
| --- | --- |
| refinement | residual presence; associated Events/Activities; projected links; uncovered dependencies |
| execution | linked Task lifecycle, event, actual, completion, and selected-execution coverage |
| outcome | linked Milestone reach, criteria, receipts, acceptance, and evidence completeness |
| organization | global rank, dependencies, cycles, Window memberships, trace usefulness, archiveability |
| temporal | Window before, inside, after, unbounded, overlap, or unavailable facts |
| close disposition | carried over, retained as backlog, explicitly archive-requested, or not applicable |

There is no Work `complete` field and no Window `objective_achieved` field.
Selected execution is `complete` only when at least one Activity obligation is
identified, none remains unprojected, every corresponding Task is complete,
and evidence is complete. No identified coverage is `uncovered`; missing or
pruned evidence is `unknown` or `unavailable`, never complete.

Window views filter the global Work order. They show dependency coverage and
global `dag next` facts separately and never hide a higher-priority executable
Task outside the Window.

Membership occurrences and unique aggregates are separate. Unique Work, Task,
Milestone, actual, completion, velocity, and outcome totals use fully qualified
identity sets. Shared facts count once, while each Work and Window detail may
show the complete authoritative fact.

Current `.pert` bytes and digest are the only authority for current facts.
Historical observation may use bounded immutable same-path first-parent Git
evidence to reconstruct association, projection-link, strict Task or
Milestone, actual, acceptance, advance, Window, membership, and close lineage.
An ID match without continuous association and projection evidence is not a
Work attribution.

The evidence basis contains repository and path identity, requested and
resolved endpoints, commit, parent, blob, raw source digest, source validity,
continuity gaps, and applicable limits. Missing, shallow, forced-loss,
invalid, ambiguous, unavailable, raced, or over-limit evidence yields an
axis-local unknown or unavailable result. Historical evidence never restores
current source or overrides a current declaration.

## 9. CLI Contract 10 and result boundary

### 9.1 Closed command delta

The later public task adds exactly these eleven command paths:

```text
work list
work show
work observe
work reshape preflight
work reshape apply
window list
window show
window observe
window add
window set
window close
```

`work list`, `work show`, `window list`, and `window show` take the document
and optional identity only. Both observe commands require
`--request <json-path-or-stdin>`. Both reshape commands require
`--request`; apply additionally requires `--preflight-hash` and
`--preflight-token`. Window mutations take document, Window ID, and required
`--request`. Standard result, diagnostic, governance, preview, write, output,
and expected-digest groups keep their Contract 9 meanings. A document and JSON
request cannot both consume stdin.

The active catalog moves from 56 to 67 commands. `document migrate` gains
target 9 without adding a command. `dag advance` gains
`--archive-empty-work` without adding a command. No editor or MCP mutation is
implied.

### 9.2 Closed identities

The target reserves:

```text
Perttool.PlanningPoolModel.v1
Perttool.PlanningReshapeRequest.v1
Perttool.WindowMutationRequest.v1
Perttool.PlanningObservationRequest.v1
Perttool.PlanningPoolResult.v1
Perttool.PlanningReshapePreflightResult.v1
Perttool.PlanningMutationResult.v1
Perttool.AdvanceResult.v4
Perttool.UnitMigrationResult.v5
```

The three new command-result identities add three active root schemas;
`AdvanceResult.v4` and `UnitMigrationResult.v5` replace their previous active
identities. The active root catalog therefore moves from 23 to 26. Exact
root, Node, and Core export counts are frozen by the public task after the
implementation owners exist. Until that task, these identities and command
paths are reserved but inactive.

`PlanningPoolResult.v1` owns read and observation operations. It contains
operation/query, source binding, complete/incomplete/unavailable state, Work
order, typed Work and Window details, membership occurrences, unique
aggregates, global execution context, evidence basis, and diagnostics.

`PlanningReshapePreflightResult.v1` owns the normalized request, complete audit,
candidate, authority impact preview, hash, and optional token. It is never a
mutation authority result.

`PlanningMutationResult.v1` owns reproduced preflight binding when applicable,
exact candidate and edits, dependency and meaning dispositions, Window close
report, governance, assurance impact, destructive records, history guard,
write result, and diagnostics. Preview, separate output, denied, invalid, and
stale operations never consume a token or write source.

## 10. Governance, assurance, and safe persistence

Governance semantics retain exactly `goal` and `dag`. Work-only, Event-only,
Activity-only, dependency, order, and Window changes are ordinary maintenance.
A projection or deferral that adds, removes, or changes strict Milestone, Task,
Gate, or endpoint structure affects `dag` exactly as the current classifier
defines. A mixed candidate takes the union; no new `planning_owner` is added.

Plan assurance continues to hash strict Tasks and accepted planning
dependencies, not Work or Window. A projected Task is unsealed until the
existing explicit seal workflow accepts its exact basis. Projection never
invents or reuses a seal. A deferral with any assurance-owned record is
unavailable.

All final candidates use source-preserving TextEdits, complete Grammar 9
validation, source digest binding, regular-file and symlink checks, race
detection, atomic replacement, and post-write verification. A transient token
does not relax any gate.

## 11. Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `PTPOOL-101` | error | unknown, duplicate, or invalid Grammar 9 planning declaration or field |
| `PTPOOL-102` | error | namespace, local identity, title, qualified-reference, or retired-ID rule failed |
| `PTPOOL-103` | error | `work_order` is missing, duplicated, incomplete, or invalid |
| `PTPOOL-104` | error | Work association, projection link, reference kind, or last-consumer rule failed |
| `PTPOOL-105` | error | Activity endpoint or candidate plan field is invalid |
| `PTPOOL-106` | error | Work dependency or required incident-relation disposition is invalid |
| `PTPOOL-107` | error | Window objective, bound, membership, or close/carry-over request is invalid |
| `PTPOOL-108` | error | projection coverage, shared impact, strict endpoint, or final DAG check failed |
| `PTPOOL-109` | error | deferral is ineligible or protected evidence has no accepted disposition |
| `PTPOOL-110` | error | reshape normalization, semantic inventory, source coverage, or reconstruction failed |
| `PTPOOL-111` | error | preflight hash, token, source, candidate, expiry, replay, or recovery binding failed |
| `PTPOOL-112` | warning | projection left a non-empty Work description unchanged without `Add residual description` |
| `PTPOOL-113` | error | Work archival, link cleanup, membership, or canonical history requirement failed |
| `PTPOOL-114` | warning | requested historical observation is incomplete or unavailable; affected axes remain explicit |
| `PTPOOL-115` | error | a source, request, registry, history, or derived-record hard limit was exceeded |
| `PTPOOL-116` | error | Grammar migration or requested compatibility profile is unavailable |
| `PTPOOL-117` | warning | audited reshape produces a byte-identical final candidate |

Historical warnings do not convert an unavailable fact into success evidence.
An explicitly required historical query with no usable result exits 1. Usage
errors remain exit 2, input/filesystem failures exit 3, optimistic or source
races exit 5, and internal invariant or schema failures exit 70.

## 12. Exact limits

| Limit | Exact value |
| --- | ---: |
| source or final candidate UTF-8 bytes | 8,388,608 |
| Work declarations | 10,000 |
| Event declarations | 20,000 |
| Activity declarations | 20,000 |
| Work associations plus projection links | 100,000 |
| Work dependencies | 100,000 |
| persisted Windows | 2,048 |
| persisted Window memberships | 100,000 |
| reshape request UTF-8 bytes | 8,388,608 |
| affected Work per reshape | 2,048 |
| description semantic rows per reshape | 50,000 |
| typed relationship dispositions per reshape | 200,000 |
| unexpired preflight tokens per registry | 256 |
| preflight token lifetime | 3,600 seconds |
| first-parent commits per observation | 2,048 |
| raw bytes per historical snapshot | 8,388,608 |
| aggregate historical raw bytes | 134,217,728 |
| derived observation entity records | 100,000 |

Counts are checked before allocation or expansion. The registry may remove
expired tokens but fails rather than evicting a live token. Historical limits
make affected axes unavailable; source, request, registry, and complete-result
limits fail without silently truncating a candidate, mapping, authority fact,
or unique aggregate.

## 13. Migration and compatibility

`document migrate --target-grammar 9` is the only automatic Grammar 9 entry.
It accepts a valid Grammar 8 source, changes only the version field and owned
migration trivia, inserts no Work, Event, Activity, Window, order, association,
link, dependency, namespace, owner, objective, estimate, or evidence, and
preserves every Grammar 8 meaning. Older documents first use their existing
accepted migration path to Grammar 8. There is no automatic downgrade.

Planning mutations require Grammar 9 and return `PTPOOL-116` on older input;
they never migrate implicitly. Grammar 1 through 8 remain readable for their
currently supported check, analysis, history, render, and migration behavior.
A Grammar 9 document with no planning declaration produces the same strict
DAG analysis, recommendation, acceptance, assurance, actual, and velocity
semantics as its Grammar 8 body.

Unit migration version 5 converts Activity candidate duration and estimate
values together with the existing complete base-unit inventory and never
changes Event, Work, dependency, order, Window, objective, or temporal-bound
meaning. It preserves Grammar 9 and cannot make an incomplete Activity
projectable by inference.

`dag render`, `dag history`, `project history`, LSP GraphView, historical
GraphView, and MCP retain strict-DAG or accepted read-only meanings. Planning
views use the new commands. Current package `0.10.5`, Grammar 8, CLI Contract
9, 56 commands, 23 schemas, 129 root and Node exports, and 45 Core exports
remain unchanged by this contract task.

## 14. Evidence chain and implementation gate

- **E-POOL-001:** ADR 0008 is accepted by the decision owner and fixes Work,
  AoA elements, projection, reshape, token, Window, history, and attribution
  boundaries.
- **E-POOL-002:** The selected and initially sealed
  `plans/planning-pool.pert` makes `PLANNING_POOL_CONTRACT` the only initial
  recommended and startable task.
- **E-POOL-003:** Direct runtime inspection on 2026-08-24 measured package
  `0.10.5`, 56 active commands, 23 active root schemas, 129 root and Node
  exports, and 45 Core exports.
- **E-POOL-004:** The dependency-ordered `PPC-001` through `PPC-040` fixture
  fixes this contract's exact target cases and hash vectors.

- **C-POOL-001 `high`:** One Grammar 9 and CLI Contract 10 boundary is
  sufficient for the three accepted Issue #12 use cases without changing the
  strict execution owner. References: E-POOL-001, E-POOL-004.
- **C-POOL-002 `high`:** Runtime implementation may begin with the private
  source Core only after this specification, fixture, focused test, and
  acceptance record agree while the active runtime remains unchanged.
  References: E-POOL-002, E-POOL-003, E-POOL-004.

- **A-POOL-001 `implementation permitted`, executed:** accept only the
  normative contract artifacts and non-activation checks in this task.
  Reference: C-POOL-002.
- **A-POOL-002 `implementation permitted`, pending:** implement the private
  Grammar 9 source and semantic Core in `PLANNING_POOL_SOURCE_CORE` after the
  current task has a separately accepted assurance outcome. Reference:
  C-POOL-001.

## 15. Normative cases and verification

The fixture contains contiguous `PPC-001` through `PPC-040`. Each case depends
only on earlier IDs and covers incomplete Work, AoA refinement, order,
dependencies, reshape, normalization, token behavior, projection, shared Task
and Milestone ownership, residual assistance, Temporary Draft, archival,
advance cleanup, deferral, Window selection and close, timeboxes, objectives,
unique aggregation, current and Git evidence, migration, compatibility,
diagnostics, limits, commands, schemas, and non-activation.

Contract acceptance requires:

```sh
npm run build
node --test test/planning-pool-contract.test.mjs
npm run check:self-use
npm run check:english
npm run check:docs
git diff --check
```

The contract task performs no runtime source implementation, plan advance,
release selection, publication, remote write, Issue mutation, editor mutation,
or MCP mutation.
