# ADR 0008: Use backlog Work, residual intent, AoA elements, and Windows

- Status: Accepted
- Date: 2026-08-24
- Decision owner: user
- Supersedes: [ADR 0007](0007-outcome-driven-planning-pool.md)
- Related backlog: [PLAN-POOL-001](../backlog.md#plan-pool-001-add-a-planning-pool-and-bounded-work-windows)
- Related issue: [GitHub Issue #12](https://github.com/mako10k/perttool/issues/12)
- Separate multi-document issue: [GitHub Issue #3](https://github.com/mako10k/perttool/issues/3)
- Related decisions: [ADR 0001](0001-activity-on-arrow.md), [ADR 0006](0006-explicit-work-events-in-git-history.md)
- Related specifications: [Mutation Semantics](../specs/mutation.md), [Milestone Outcome Acceptance](../specs/milestone-acceptance.md), [Advance History Safety](../specs/advance-history-safety.md)

## Context

The strict Activity-on-Arrow execution graph requires complete Task endpoints,
estimates, valid finish reachability, and the other facts needed for analysis
and execution authority. Requiring that complete form at the first moment of
planning prevents the canonical project document from expressing incomplete
work while it is still being refined.

Issue #12 has three distinct use cases:

1. use a planning pool as a draft area around the canonical DAG in the same
   project document;
2. use planning above the current DAG, which belongs to the separate
   multi-document hierarchy and composition scope in Issue #3; and
3. maintain a product backlog and Scrum-like sprint or other bounded selection,
   then promote sufficiently shaped work into the strict DAG without making
   selection itself executable.

ADR 0007 made a non-executable Planning Event and Change Intent AoA the
canonical pool. That model centered the second use case, introduced a second
planning graph as the primary abstraction, and displaced the first and third
use cases. Issue #12 instead needs stable work continuity, progressive shaping,
and windows around one strict execution DAG.

## Decision

### Use-case and scope boundary

Issue #12 is a single-project, single-document planning feature around the
existing strict DAG. Its first contract must serve draft refinement and
backlog/window operation directly.

Multi-file inclusion, macro/detail planning, parent/child plans, cross-document
identity, roll-up, hierarchical recommendation, and multi-source mutation
remain exclusively under Issue #3 and `MULTI-001`. No Issue #12 concept is an
upper plan over another `.pert` document.

### Work and the planning pool

`Work` is a stable project-owned backlog item. It is independently orderable
and selectable and also provides an organization boundary for progressive
planning:

- The minimum Work declaration has one stable ID and one non-empty `title`.
- An optional `description` owns the current residual backlog intent: the
  problem, value, hypothesis, constraint, or other meaning that has not yet
  been allocated to an Event or Activity, plus non-DAG rationale that remains
  useful after such allocation.
- Work can be registered before its premise, desired state, transition,
  duration, resources, or complete dependency structure are known.
- Work may be associated with zero or more project-owned planning Events and
  Activities and may retain backlog metadata, Window membership, and non-DAG
  relationships.
- Work semantic reshape may create or remove Work boundaries and redistribute
  residual description, planning-element associations, and relationships; it
  does not copy their meaning.
- A Work can simultaneously retain associations with unprojected planning
  elements and links to elements already projected into the strict DAG.
- Existing strict Milestones and Tasks without a Work origin remain valid.

The planning pool is the inventory and refinement boundary for current Work
that still has an unprojected planning role. It is not a second executable
plan, and pool-versus-DAG placement is not an exclusive lifecycle flag on
Work. A Work with a residual description but no associated Event or Activity
is a valid unrefined backlog item rather than an incomplete graph declaration.

### AoA planning primitives

Planning meaning associated with Work is divided into two explicit
Activity-on-Arrow primitive kinds. There is no generic untyped planning
element:

- an `Event` states a premise, intermediate condition, or desired state and is
  the planning-side counterpart of a strict Milestone; and
- an `Activity` states one directed transition between exactly one identified
  source Event and one identified target Event and is the planning-side
  counterpart of a strict Task.

An Event can exist without an Activity. Incomplete refinement is therefore
represented by Work with no associated element or with one or more associated
Events whose transition has not yet been stated, rather than by an endpoint-free
Do or an Activity with zero or one endpoint.

Events and Activities are declared once as project-owned semantic entities;
Work does not own or contain them. A Work may associate with multiple planning
elements, and multiple Work may associate with the same Event or Activity.
These many-to-many associations organize current backlog meaning but do not
duplicate the associated element's premise, desired state, transition, title,
estimate, or resource facts.

Removing one Work association does not remove the project-owned element while
another Work association remains. Removing the last association is valid only
when the same final candidate explicitly re-associates the element with another
Work, projects it to its strict same-identity owner, or labels it for discard.
An unassociated planning Event or Activity is not retained as an orphan
Temporary Draft, and neither association removal nor discard recursively
disposes of another connected element unless that disposition is also explicit.

Planning Events have no execution Milestone state or outcome acceptance, and
planning Activities have no execution authority. They may carry candidate
facts such as estimates or resources, but those facts do not participate in
PERT/CPM analysis, resource scheduling, critical paths, float, `dag next`,
start authority, milestone closure, acceptance, actuals, velocity, or canonical
advance while the planning side owns them.

Disconnected and cyclic planning fragments may remain in a valid draft because
forcing complete strict topology would defeat refinement. They are not
projectable as strict structure. Projection must select a closed,
endpoint-complete, acyclic fragment and make every fact required by the strict
execution grammar explicit in its final candidate. A projected Activity must
resolve each endpoint either to an existing strict Milestone that already owns
the same identity or to an Event projected in the same candidate. The planning
AoA is never independently schedulable.

### Work dependencies

Work has one directional planning relationship: `depends_on`. If Work A
depends on Work B, A requires B to be considered or sufficiently refined to
shape A responsibly. The relationship is many-to-many and belongs to backlog
planning, not to the execution graph.

A Work dependency may affect advisory backlog readiness, refinement order, and
Window coverage reporting. It never by itself affects PERT/CPM analysis,
resource scheduling, critical paths, float, `dag next`, Task start authority,
Milestone reachability or acceptance, `project.finish`, or canonical advance.
It is not automatically converted into an Event connection, Activity, Task, or
strict DAG edge. When the dependency becomes an execution constraint, the user
must state that constraint explicitly through Event and Activity structure and
project a valid strict fragment.

Window selection and partial projection remain permitted when a dependency is
outside the selected Window or otherwise unresolved; the interface reports the
uncovered dependency without treating it as execution authority. A Work
dependency cycle is valid planning-pool input but has no advisory ready order
inside the cycle and must be reported prominently. It is not a valid execution
DAG cycle and cannot be projected as one.

The model stores only the `depends_on` direction; an inverse `blocks` view may
be derived for display but is not a second relationship. A dependency remains
only while it carries current non-DAG planning meaning. It must be removed when
that meaning has moved completely into the planning AoA or strict DAG, and a
Work with a current dependency is not archiveable. A generic symmetric
`related_to` relationship is deferred until a demonstrated interaction or
navigation use case establishes useful behavior.

### Project-wide backlog order

Every current Work appears exactly once in one explicit project-wide total
order. The order is a current planning fact independent from source declaration
placement, ID, title, `depends_on`, Window membership, and strict-DAG topology.
The exact list, rank, or anchor serialization remains grammar-contract work,
but every accepted representation must resolve deterministically to the same
complete duplicate-free Work sequence. Formatting or moving declarations does
not reorder Work.

Order changes are explicit, previewable, source-digest-bound mutations. Their
candidate and result show the complete affected before and after sequence. A
Work creation or split must state the final insertion position of every new
Work, including an explicit first or last position when selected. Merge removes
every absorbed Work from the order while the selected surviving Work keeps its
prior position. Partial semantic movement preserves every position unless the
same candidate declares a separate reorder. Work archival removes the archived
Work's order entry atomically. No operation derives an insertion or reorder
from title, ID, estimate, projection status, Task lifecycle, or outcome state.

`depends_on` can report that a prerequisite appears later than its dependent,
but the diagnostic is advisory and never reorders either Work. A dependency
cycle remains representable and cannot define a total order. A persisted or ad
hoc Window has no second semantic order: its selected Work are presented by
filtering the project-wide order. A different desired execution sequence must
be stated in the strict AoA DAG rather than in Window membership.

Backlog order does not grant execution priority or authority. `dag next`,
critical-path and resource facts, and globally executable Tasks remain
authoritative even when they differ from the backlog sequence. Window-oriented
output shows both the selected Work's backlog positions and any applicable
global execution recommendation without allowing either fact to overwrite the
other.

### Work semantic reshape and operation-local audit

Work creation, removal, split, merge, and partial movement are special cases of
one atomic `Work semantic reshape` across Work boundaries. The mutation operates
on one source-digest-bound project snapshot and declares all directly changed
Work plus every otherwise unchanged Work whose ownership is relevant to a new
meaning assertion. It never uses an intermediate duplicated source state as a
candidate. An operation that changes or projects a shared Event or Activity
must declare every Work currently associated with that element as affected,
even when a particular Work's residual description is unchanged. Omitting one
of those Work makes the request incomplete and preflight fails.

The reshape request carries one normalized operation-local semantic inventory.
It enumerates every semantic element in every directly affected Work, including
elements that will be removed, plus every newly introduced element. Each row
has exactly one origin and exactly one destination:

- an origin is either one source-digest-bound existing Work element or explicit
  creation with an assertion, bound to the complete project snapshot, that the
  meaning is not already owned by any existing Work; and
- a destination is either one existing or newly created Work, with final
  wording and order, or the explicit `discard` label. A discard reason may be
  supplied but is not required for structural accounting.

The same Work as origin and destination means retention; a different Work means
movement; a creation origin means addition; and a discard destination means
deletion. Split, merge, partial movement, Work creation, and Work removal are
derived from this one mapping plus the set of created and removed Work
boundaries rather than represented as different semantic operations.

Operation-local element IDs exist only to bind this request, preview, audit,
and result. They are not project entities, do not enter the project namespace,
and are not persisted as statement declarations, lineage, or tombstones in the
canonical `.pert`. A wording change is explicit and remains linked to its
source element; the tool does not infer that two differently worded statements
have equal meaning. A user-supplied new-meaning assertion is similarly explicit
and digest-bound, but the tool does not pretend to prove semantic novelty
against natural language in unchanged Work.

The machine audit verifies the useful structural claims: complete and
non-overlapping coverage of every affected source description, exactly one
origin and destination for every listed element, no affected source element
omitted, no element assigned to two Work, explicit creation and discard, exact
reconstruction of every final description from destination order and wording,
no dangling reference to a removed Work, and a valid final project candidate.
It may report exact parsed-text duplication or a byte-identical no-op as narrow
assistance. It cannot verify that the chosen elements are conceptually correct,
that a rewrite preserves meaning, that a creation is not a paraphrase of
meaning elsewhere, or that a discard is wise.

#### Preflight and execution

Work semantic reshape follows one closed sequence:

1. the LLM prepares the complete reshape plan and semantic inventory, then
   invokes a read-only preflight;
2. preflight normalizes and hashes the input, mechanically audits it against
   the current source and exact final candidate, registers a tool-managed
   one-time token, and returns the token with the pre-reshape semantic
   decomposition, post-reshape semantic decomposition, origin-to-destination
   mapping, and actual description fragments from which each side is
   reconstructed;
3. the LLM internally reassesses element boundaries, wording changes, creation
   labels, movements, and discard labels and, when needed, reconstructs the
   input and invokes a new preflight; and
4. execution requires that exact `preflight_hash` and `preflight_token`,
   revalidates the same input, and attempts the mutation through the existing
   authority, history, source-binding, race, and atomic-write gates.

This is guided LLM-operation navigation. The token makes successful preflight
an explicit standard-path step before execution; it is not authentication or
an adversarial security boundary. After inspecting the preflight result, an
LLM that reaches a separately applicable owner-confirmation boundary must
present the exact operation and candidate to the user and wait for a new user
response before declaring that confirmation. The token does not claim that
this response boundary occurred and cannot substitute for the resulting
caller assertion.

The preflight result binds the complete source digest, reshape-request digest,
final-candidate digest, before and after inventories, mapping, reconstructed
descriptions, typed relationship changes, and mechanical diagnostics. It is
explanatory evidence rather than only a pass/fail flag. Preflight performs no
write and grants no mutation authority.

Before auditing, preflight parses the supplied reshape input into one closed,
typed normalized model and serializes it with a versioned canonical byte
encoding. Unknown fields, duplicate identities, ambiguous references, or an
invalid inventory fail instead of being ignored or repaired. Normalization
canonicalizes representation-only differences such as object-field and
unordered-set order, but preserves case-sensitive IDs, natural-language string
values, semantic element order within each final description, and every other
meaningful distinction.

The normalized input includes its normalization-contract identity, the exact
source raw-byte digest, affected and created or removed Work identities, the
complete semantic inventory and origin-to-destination mapping, final wording
and order, typed relationship changes, and all explicit semantic-reshape
assertions. Separately applicable governance inputs such as `actor` and owner
confirmation are not reshape meaning and are excluded from this model and
hash. The first preflight can therefore remain owner-assertion-free; those
inputs are evaluated later against the unchanged exact candidate. Preflight
computes `preflight_hash` as SHA-256 over the canonical bytes and returns it
with the normalized projection and audit output. The exact final-candidate
raw-byte digest remains a separate bound result fact because normalization must
not replace or disguise the bytes proposed for persistence.

After a successful mechanical audit, preflight generates an opaque
`preflight_token` from at least 256 bits of cryptographically secure random
input. The token is neither caller-supplied nor derived from, salted into, or
included in the normalized-input hash. An ordinary perttool-managed transient
registry binds the token to the exact `preflight_hash`, source raw-byte digest,
final-candidate raw-byte digest, normalization-contract identity, expiry, and
unused state. The registry may use normal per-user application or runtime
storage so separate CLI invocations can share the short-lived record. The clear
token is returned once in a distinct result field; it is not an authentication
secret, but perttool does not write it to `.pert`, Git, ordinary diagnostics,
or the registry in cleartext.

Execution requires a reshape input that normalizes to the same model, its exact
`preflight_hash`, and its matching unexpired and unused `preflight_token`, in
addition to the ordinary mutation inputs and any separately applicable
authority. It re-normalizes the input, recomputes the hash, verifies the token
binding, and repeats the deterministic mechanical audit against the current
bytes before any write. An unknown, mismatched, expired, or consumed token, or
a changed source, plan, inventory, mapping, relationship set, semantic-reshape
assertion, normalization contract, or candidate invalidates execution and
requires a new preflight. Execution never silently refreshes either value and
exposes no force bypass for this binding. LLM internal reconsideration covers
the semantic
judgments that the machine cannot prove, but neither that reconsideration nor
preflight replaces any applicable owner confirmation or governance rule.

The registry consumes the token only for a successful exact execution,
including a successful bound no-op. Consumption and persistence must be atomic
or recoverably idempotent so an interrupted write cannot silently lose or
replay the navigation receipt. Failure before mutation does not consume it,
but expiry still applies. The token records that standard operation reached a
successful preflight for this exact input; it does not grant owner authority,
bypass governance or history safety, or approve the plan's natural-language
meaning.

Internal LLM reassessment produces no protocol field, assertion, receipt,
result, log, or canonical `.pert` record. Its only observable effect is that the
LLM may submit a different reshape input for a new preflight. Execution neither
requires nor persists evidence that this internal reconsideration occurred.

`preflight_hash` remains content identity and is independently computable;
`preflight_token` is an operation-navigation receipt that requires a standard
caller to obtain a successful preflight instead of constructing the execution
input from the hash alone. A public salt, nonce, UUID, or other
caller-reproducible value does not provide that navigation property. A
multi-process CLI uses the ordinary tool-managed transient registry and fails
closed when the bound record is missing, stale, or already consumed. This
model requires no OS-user separation, authentication service, protected
signer, or secure token transport.

The threat boundary does not claim resistance to deliberate modification of
perttool, its transient registry, or project bytes; direct source editing;
intentional false caller assertions; or coercion of the user. Its purpose is to
make the expected review and user-response boundaries explicit enough that an
LLM following perttool's Help, Guide, and result protocol does not accidentally
flow into an approval-dependent write or invent approval as routine command
boilerplate. Strong authentication, approval certificates, and durable
approval audit remain separate backlog scope.

Work-element associations, `depends_on` relationships, Window references,
backlog order, and useful projection links participate as typed relationship
changes in the same manifest. Event and Activity facts themselves remain
project-owned and are not transferred or copied; only their Work associations
are moved, added, retained, or removed. Deliberately associating one shared
project-owned element with multiple Work is therefore distinct from assigning
one Work-owned residual semantic element to multiple Work. The audit also
verifies complete enumeration of every Work affected by shared-element
projection and rejects any last-association removal without one explicit
re-association, projection, or discard disposition.

The general model yields the familiar operations without separate semantics:

- split creates a Work boundary, moves a selected element subset to it, and
  retains the complementary elements in the principal Work;
- merge moves every element and rebinds every current reference from absorbed
  Work to the selected target, then removes the empty absorbed boundaries;
- partial movement transfers selected elements between existing Work;
- creation introduces an explicit Work boundary and explicit new elements; and
- removal moves or explicitly discards every element and resolves every
  reference before removing the empty Work boundary.

Duplicate relationship references coalesce, and a dependency that would become
a self-dependency after rebinding is internalized and removed. The current
source keeps no split, merged, redirect, transfer, lineage, or tombstone record;
Git retains former Work states. The complete operation is previewable,
digest-bound, validating, and atomic. Removing canonical meaning or a Work
remains subject to the ordinary history-loss proof, while Temporary Draft
elements retain their separately accepted disposable boundary.

### Identity namespace and display name

Stable entity identity is conceptually the pair of one logical namespace path
and one local ID. A namespace path is composed of Identifier-compatible
segments and is independent of the physical file path. `::` is reserved as the
future qualified-reference separator; for example,
`PRODUCT::AUTH::AUTH_READY` identifies local ID `AUTH_READY` in logical
namespace `PRODUCT::AUTH`.

For the single-document Issue #12 boundary:

- the project ID is the effective root namespace;
- unqualified existing Identifiers remain the source form for references in
  that namespace;
- all project entity and relation kinds, including Work, Event, Activity,
  Window, Milestone, Task, and Gate, share one local-ID namespace;
- duplicate fully qualified identities are invalid;
- archived identities are not reused for semantically different entities; and
- Event-to-Milestone and Activity-to-Task projection preserve the same fully
  qualified identity rather than allocating a replacement identity.

Future multi-file and nested composition must use explicit qualified
resolution with no implicit ancestor search, fallback, or shadowing. File
movement alone must not change identity. Exact namespace declarations, aliases,
mounting, and cross-document resolution remain owned by Issue #3 and
`MULTI-001`; this ADR fixes the forward-compatible identity model without
activating composition in Issue #12.

Every new Work, Event, and Activity has a non-empty human-readable `title`,
reusing the existing DSL field rather than adding `display_name`. A title is
Unicode-capable, mutable, and non-unique. It is never a reference or identity
input. Human output presents the title as the primary label and the stable ID
as an adjacent secondary label; diagnostics and machine results retain both as
separate facts and never resolve an entity by title.

Work `description` is distinct from `title`: it is current semantic content,
not an identity or display fallback. It may become empty as its meaning is
allocated to planning elements or strict DAG entities, and it may remain empty
while the Work ID is still needed by a Window, backlog relation, or projection
link.

### Semantic ownership and projection

Each current planning fact has exactly one semantic owner. Work associations
do not own the associated facts. Projection is an atomic ownership move, not a
copy and synchronization relationship:

- a projected Event is removed from the planning side and materialized as the
  same-identity strict Milestone;
- a projected Activity is removed from the planning side and materialized as
  the same-identity strict Task;
- the Event or Activity `title` and every other selected semantic fact move to
  the strict owner rather than remaining editable in both places; and
- Work retains only its residual description, associations with unprojected
  elements, its own ID and backlog-item title, current non-DAG relationships,
  and any still-useful projection links.

Projection selects project-owned Event and Activity entities, not one Work's
association with those entities. Projecting a shared element is therefore one
global atomic ownership move: every associated Work is an affected subject,
the planning declaration is materialized exactly once in its strict owner, and
every Work association to that declaration is replaced by a same-target
projection link in the same candidate. The candidate may immediately prune a
link only by applying the accepted Work archival rule; it cannot leave one Work
associated with a planning copy or project only one association. Preflight
reports the complete cross-Work impact before execution.

A projection link is current trace information retained only while the Work
identity still has planning value. It is not a permanent transfer ledger and
does not own a copied premise, target, acceptance condition, estimate, or Task
description. Projection of all elements does not by itself require Work to
remain: Work can be contracted as soon as neither residual meaning nor a
current non-DAG relationship needs it, even while the projected strict DAG is
still current. Conversely, disappearance of every related Task through
advance is a cleanup and review trigger, not proof by itself that the Work's
desired outcome was achieved.

Projection is an explicit previewable mutation. Its final candidate must
supply every fact required by the execution grammar and pass the existing DAG,
assurance, governance, source-binding, and safe-write gates. Direct creation of
strict Milestones and Tasks without Work remains valid. Window selection never
projects Work. An Activity projection fails unless both endpoint identities
resolve to existing strict Milestones or to Events projected in the same
candidate, and the resulting strict fragment is closed and acyclic.

### Residual-description interface reminder

Projection and refinement interfaces expose one explicit user action named
`Add residual description`. The CLI spelling is
`--add-residual-description`, and the JSON request field is
`add_residual_description`. It supplies the description that should remain
owned by Work after meaning is allocated to an Event, Activity, Milestone, or
Task. Exact multiline value transport remains CLI-contract work.

Mechanical checking is deliberately advisory and narrow. A projection emits a
prominent non-blocking warning only when all of the following are true:

1. the original parsed Work `description` is non-empty;
2. the mutation creates or materializes at least one Event, Activity,
   Milestone, or Task from that Work;
3. the final parsed Work `description` equals the original parsed value; and
4. `Add residual description` was not explicitly used.

The comparison uses the decoded string value, not raw quoting, indentation, or
line-ending bytes. Changing or clearing the description, or explicitly using
`Add residual description`, suppresses this reminder. The warning does not
block preview or persistence and does not claim that allocation is complete.
This reminder does not attempt semantic equivalence, fragment tracking,
natural-language coverage, rewrite confirmation, or automatic residual
generation.

### Temporary planning contraction

Planning-side Event and Activity declarations are `Temporary Draft`, not durable
execution evidence. Projection, reshape, split, merge, replacement, elision,
or explicit discard removes every temporary declaration that no current Work
still needs. No `materialized`, `superseded`, or archived element tombstone and
no permanent planning-to-DAG binding ledger remains in current source. A
tombstone may be reconsidered only if a future current-state behavior must
distinguish "never existed" from "moved" and cannot obtain that fact from a
live link or Git history.

Loss of uncommitted Temporary Draft is permitted by its data contract. A
projection, reshape, or explicit discard still returns the exact removed
temporary entities and final candidate in preview, and persistence retains
expected-digest, source-binding, validation, race, and atomic-replacement
checks. It does not require Git recoverability proof for ranges owned only by
Temporary Draft. A projection that removes temporary meaning must preserve the
selected meaning in its strict final owner or identify it as an explicit
discard.

### Work and projection archival

Archive is a source-contraction operation, not a stored Work lifecycle state.
A Work is archiveable when both of the following are true:

1. it has no residual description, association with an unprojected Event or
   Activity, or other residual planning meaning; and
2. no current Window membership, non-DAG relationship, or useful projection
   trace still needs its identity.

Archival removes the Work and all of its remaining projection links from the
current `.pert` and removes its mandatory project-wide order entry in the same
candidate; that order entry is not an independent reason to retain an otherwise
archiveable Work. Archival does not create an `archived` declaration, tombstone,
or in-file history. When canonical advance removes a projected Milestone or
Task, the same candidate must prune links to that removed target. If that
contraction removes the last current reason for the Work to exist, the mutation
may compose an exact Work archival candidate subject to the ordinary authority
and history guards.

### Narrow deferral

Deferral is a separate explicit previewable reverse-projection candidate.
Window close, carry-over, backlog selection, and dependency reporting never
invoke it automatically. The first model accepts only a closed selected strict
fragment whose entities retain at least one current Work projection link. A
directly created strict entity with no live projection link has no current Work
destination and is not eligible for this operation.

Every selected Task must be planned and unstarted and have no Work event,
actual, active, suspended, completed, or other execution history. It is removed
from the strict DAG and materialized exactly once as the same-identity planning
Activity. An explicitly selected internal Milestone may be removed and
materialized exactly once as the same-identity planning Event only when it is
neither reached nor accepted and no retained strict Task, Gate, or
`project.finish` needs it. Boundary Milestones remain strict and may serve as
endpoints of returned Activities. The final candidate must leave the remaining
strict DAG valid, closed, acyclic, and connected to `project.finish` under the
existing execution invariants.

Every live Work projection link to a returned entity becomes a Work
association in the same candidate. A shared entity therefore affects every
linked Work atomically, and preflight lists that complete affected-Work set.
Deferral does not automatically rewrite Work descriptions, Work dependencies,
backlog order, or Window membership. It does not create a copy, change Work or
entity identity, rewrite actual history, or act as a Git revert.

Any plan-assurance record, milestone criterion or receipt, accepted outcome,
governance or history-owned record, or other protected evidence whose valid
disposition is not explicit and contract-defined makes deferral unavailable.
Ordinary source binding, validation, authority, history-loss, race, and
safe-write gates still apply to the strict declarations removed by the final
candidate. Active, suspended, or completed execution is never converted into
pool-only Work.

### Windows and sprint operation

A `Window` is a selection and reporting scope over Work, independent of pool or
DAG placement:

- a persisted Window has a stable identity, title, objective, optional time
  bounds, and selected Work, and its presence in current source means that it
  is active; it has no stored open, closed, or archived state;
- an ad hoc Window can provide the same observation boundary without becoming
  stored project state;
- one Window can select pool-only Work, Work with strict Task projections, or
  both;
- a sprint-like Window can exist before any selected Work is promoted and can
  continue while selected Work is progressively projected into the DAG;
- adding or removing Work does not promote, defer, start, suspend, finish,
  accept, or advance anything; and
- reports distinguish selected completion, accepted outcomes, additional
  completed work, uncovered selected Work, and carry-over without equating
  Window closure with `project.finish` or milestone acceptance.

### Window overlap and cross-Window attribution

A project may contain zero or more simultaneously active persisted Windows,
including Windows with overlapping time bounds. Each Window selects a set of
Work: one Window-to-Work membership pair is unique, while one Work may belong
to zero or more persisted Windows. Ad hoc Window selection may overlap any
persisted or other ad hoc selection. There is no primary Window, exclusive
Window owner, or implicit transfer between Windows.

Overlap is an ordinary reported planning fact, not a validation failure or
warning by default. Window results list every other active Window sharing each
selected Work and expose overlapping time bounds independently from shared
membership. A `depends_on` edge to Work outside a Window remains uncovered and
does not automatically add that prerequisite to any Window.

Per-Window results retain each membership attribution. A cross-Window summary
also reports unique Work, Task, and Milestone facts by fully qualified identity
so one authoritative actual, completion, or acceptance fact is not multiplied
by the number of memberships or linked Work. Membership-occurrence counts and
unique-entity totals remain separate; exact result field names remain contract
work.

Closing a persisted Window removes only that Window and its membership pairs.
Membership in every other active Window remains unchanged. Explicit carry-over
to a target Window creates a missing target membership; when the target already
selects that Work, the relation remains single and the result reports it as
already selected. Work remains unarchiveable while any persisted Window
membership exists.

Closing a persisted Window is one explicit previewable source-contraction
candidate. It returns the close report and removes that Window and all of its
memberships from current `.pert` in the same successful write; it does not
retain a closed declaration, tombstone, or separate archival state. The same
candidate may create or update a next active Window and explicitly select any
carry-over Work there. No Work is carried automatically. Without such an
explicit next selection, incomplete Work remains ordinary backlog Work outside
the removed Window.

Window close and carry-over do not change Work residual meaning, project-owned
Event or Activity facts, projection ownership, Task lifecycle, Milestone state
or acceptance, actuals, or canonical advance. An ad hoc Window has no stored
membership or close operation. The close result is immediate observation
evidence; the former persisted Window and membership state belong to Git
history after source contraction.

### Derived Work and Window observations

Work has no persisted `status`, `done`, `completed`, or `accepted` fact. Its
presence in current source identifies a useful planning and organization
boundary, not a lifecycle phase. Window reporting derives independent
observations from the semantic owners rather than writing a summary state back
to Work:

- refinement coverage reports residual-description presence, associated
  planning Events and Activities, current projection links, and uncovered Work
  dependencies without deciding whether natural-language meaning is complete;
- execution observation groups linked strict Tasks by their authoritative
  lifecycle, Work-event, and actual facts;
- outcome observation groups linked strict Milestones by reach and acceptance
  facts and remains separate from Task completion;
- organization observation reports current Window membership, backlog
  relationships, useful trace links, and archiveability; and
- close disposition reports explicit next-Window carry-over, ordinary backlog
  retention, or a separately requested archive candidate without deriving one
  from another axis.

`selected execution completion` is a Window observation, not a Work state. It
is reported for selected Work only when at least one Activity obligation is
identified, no identified Activity remains unprojected, every corresponding
strict Task is complete, and the evidence basis is complete. Work with no
identified Activity or Task coverage is uncovered, not complete. Residual
description presence is reported independently because perttool does not infer
whether that prose is unfinished execution meaning or intentionally retained
non-DAG rationale.

Accepted outcomes, additional completed work outside the Window, uncovered
selected Work, and explicit carry-over remain separate result sets. A shared
Task or Milestone contributes the same authoritative observation to every
linked Work without creating per-Work copies. Missing, pruned, or unavailable
current or historical linkage and execution evidence produces an explicit
unknown or unavailable observation; absence is never treated as completion.
Archiveability means only that current Work organization is no longer needed.
It is not proof of Task completion, outcome acceptance, or project completion.

### Current and historical observation evidence

The parsed current `.pert` bytes and their source digest are the only authority
for current Work, Window membership, residual description, planning elements,
live projection links, and strict DAG state. Historical evidence never
overrides or silently restores a declaration absent from the current source.
When a current observation needs a projection, Task, Milestone, actual, or
acceptance fact that canonical advance or another accepted contraction has
removed, perttool may reconstruct that former fact from bounded immutable Git
evidence instead of retaining it as current planning state.

Historical reconstruction follows the existing first-parent, same-repository,
same-path model. It traces the stable fully qualified identity from a Work
association through a projection-link occurrence to the same-identity strict
Task or Milestone, then uses authoritative lifecycle, Work-event, actual,
outcome-acceptance, and canonical-advance evidence. A historical Window query
may likewise reconstruct its former declaration and membership from Git. An ID
match without the required association and projection lineage is not evidence
that a direct strict entity belonged to a Work.

Every observation exposes its evidence basis and completeness. The basis binds
the current source digest, repository and path identity, requested and resolved
Git endpoints, relevant commit, blob, and source digests, and any continuity or
validity gaps. Exact field names remain result-contract work. A current-source,
path, `HEAD`, repository-snapshot, or captured-object race invalidates the
result. Missing history, shallow history, history actually lost across a forced
boundary, invalid historical source, ambiguous ID reuse, unavailable objects,
or an exceeded hard limit yields explicit unknown or unavailable facts for the
affected axis rather than inferred completion.

A persisted Window close report is computed from one source-bound current
snapshot and any exact historical evidence needed by its selected Work. The
close mutation rechecks those bindings before contracting the Window. After
close, ordinary current-state observation does not synthesize the removed
Window; a later report is a separately requested historical observation over
Git evidence. No completion snapshot, projection tombstone, closed-Window
record, or durable close report is added to current `.pert`. Uncommitted
Temporary Draft that was permitted to disappear has no historical
reconstruction guarantee.

Whole-project DAG recommendation remains authoritative. Window-oriented output
must not hide a globally critical or higher-priority executable Task outside
the Window. Backlog order and execution recommendation remain distinct facts.

### Strict execution boundary

The accepted execution invariants remain unchanged:

- the strict AoA DAG is the only executable and schedulable plan;
- `project.finish` is the single project completion boundary;
- every strict Task, Gate, and Milestone retains required reachability;
- Work, planning Event, planning Activity, projection link, and Window
  membership grant no execution authority; and
- milestone closure, milestone acceptance, plan assurance, Work actuals,
  velocity observation, and canonical advance keep their current owners.

### Current source and Git history

The canonical `.pert` source contains only the latest planning and execution
state plus unfinished future work. It is not an append-only backlog, sprint,
transfer, tombstone, or archive ledger. Former canonical Work, Window,
projection, and execution states belong to Git history when removed from
current source.

Every changed in-place mutation that removes or replaces canonical planning
information must identify exact destructive ranges and prove their
recoverability from `HEAD` and the stage-0 index before writing. An untracked
target, unavailable proof, or destructive overlap blocks that canonical loss.
Ranges owned only by Temporary Draft are deliberately excluded from that proof;
if the user has committed them they remain observable in Git, but perttool does
not require or create that commit before discarding them. Preview and separate
output remain Git-independent, and perttool never stages or commits on behalf
of the user. Existing `--force-history-loss` authority does not extend beyond
its accepted `dag advance` boundary without a new contract.

## Claims and evidence

- **C1:** Work residual intent and its associated AoA planning elements are
  necessary to use the canonical project document during refinement rather
  than only after a complete PERT exists.
  - **E1:** Issue #12 identifies ideas, unrefined backlog items, and deferred
    work as valid planning inputs that may lack truthful endpoints or estimates.
  - **E2:** The decision owner restated the canonical-DAG draft use case on
    2026-08-24.
- **C2:** Window membership must be independent from pool placement and Task
  lifecycle to support backlog and sprint operation without weakening PERT.
  - **E3:** Issue #12 requires persisted timeboxed Windows with objectives,
    selected Work, carry-over, and separate global DAG recommendation facts.
  - **E4:** The decision owner restated backlog registration, progressive DAG
    intake, and sprint expression across planning and DAG state on 2026-08-24.
- **C3:** The upper-plan use case must not shape the single-document pool.
  - **E5:** The 2026-08-13 owner scope alignment on Issue #3 assigns product
    backlog, sprint selection, coverage, and carry-over to Issue #12 while
    retaining multi-document hierarchy, roll-up, and hierarchical next in
    Issue #3.
- **C4:** Explicit Event and Activity primitive kinds preserve AoA semantics
  without making an untyped Do the planning basis or creating a second
  execution graph.
  - **E6:** [ADR 0001](0001-activity-on-arrow.md) fixes the strict AoA DAG as
    the canonical execution model.
  - **E7:** The decision owner confirmed on 2026-08-24 that Work is a backlog
    item and organization boundary above separate Event and Activity
    primitives, and that the separation must emphasize AoA.
- **C5:** Current-source history remains bounded when destructive planning
  mutations use the accepted repository proof boundary.
  - **E8:** The decision owner confirmed the latest-source and Git-history
    rule on 2026-08-24.
  - **E9:** [Advance History Safety](../specs/advance-history-safety.md) fixes
    exact `HEAD` and stage-0 recoverability proof for destructive writes.
- **C6:** Resolved Temporary Draft can disappear without becoming durable
  project history or a completed-draft lifecycle state.
  - **E10:** The decision owner confirmed on 2026-08-24 that Temporary Draft,
    unlike the canonical DAG, is permitted to disappear after its role ends.
- **C7:** Moving semantic ownership during projection avoids independent Work
  and DAG copies that can diverge.
  - **E11:** The decision owner rejected double management on 2026-08-24 and
    required projected Work meaning to be removed from Work as the strict DAG
    becomes its source of truth.
  - **E12:** [ADR 0001](0001-activity-on-arrow.md) already distinguishes
    Milestone event nodes from Task activity edges, giving Event and Activity a
    type-preserving projection target.
- **C8:** A logical namespace plus a separate human title makes identity
  forward-compatible with composition without using opaque IDs as the only
  display.
  - **E13:** The decision owner requested and accepted namespace and display
    name rules on 2026-08-24.
  - **E14:** Issue #3 explicitly owns path, namespace, alias, stable-ID,
    duplicate, shadowing, and nesting design for future multi-document
    composition.
  - **E15:** The active grammar already separates stable Identifier references
    from non-empty human-readable `title` fields.
- **C9:** Work archival can keep the current source simple without adding a
  second lifecycle or in-file historical ledger.
  - **E16:** The decision owner required current `.pert` to retain only current
    meaning and Git to retain former Work and projection states.
- **C10:** One residual description plus a narrow unchanged-value reminder
  covers ordinary projection refinement without adding a persistent ID-bearing
  statement model or pretending to verify natural-language meaning.
  - **E17:** The decision owner confirmed on 2026-08-24 that Work must retain
    unresolved backlog meaning and that the projection interface must expose
    `Add residual description` to prevent ordinary omission.
  - **E18:** The decision owner limited mechanical checking to detecting the
    common case where projection leaves a non-empty Work description unchanged;
    higher semantic-equivalence or coverage checking is explicitly unnecessary.
- **C11:** Project-owned Event and Activity entities with many-to-many Work
  associations preserve one semantic owner while supporting shared planning,
  split, and merge.
  - **E19:** The decision owner confirmed on 2026-08-24 that Work must not own
    Event or Activity and accepted project-scoped elements associated with one
    or more Work.
- **C12:** A separate Work dependency is necessary for backlog refinement, but
  treating it as execution precedence would weaken the strict AoA boundary.
  - **E20:** The decision owner confirmed on 2026-08-24 that Work must support
    dependencies and deferred a generic related relationship until its
    usability is known.
  - **E21:** [ADR 0001](0001-activity-on-arrow.md) fixes Event and Activity
    topology, rather than Work relationships, as execution dependency.
- **C13:** One complete origin-to-destination semantic inventory can generalize
  Work creation, removal, split, merge, and partial movement while preserving
  one owner and enabling bounded mechanical audit.
  - **E22:** The decision owner confirmed on 2026-08-24 that split cuts a
    selected part from the principal Work into another Work and merge transfers
    the complete absorbed Work into the selected target.
  - **E23:** The decision owner generalized that model on 2026-08-24 to an
    enumeration of every affected semantic element, including deleted and newly
    created elements, with one labeled origin and one Work or discard
    destination for each element.
- **C14:** Exact before/after decomposition evidence must precede a bound
  reshape write so the LLM can internally reconstruct an unsatisfactory plan
  without turning that reconsideration into persistent project state.
  - **E24:** The decision owner selected on 2026-08-24 the sequence of LLM plan,
    read-only preflight with decomposition and integration output, internal LLM
    reconsideration when needed, and exact execution.
  - **E25:** [Mutation Semantics](../specs/mutation.md) already fixes preview,
    source binding, validation, race detection, and safe persistence as
    separate mutation stages.
  - **E26:** The decision owner clarified on 2026-08-24 that LLM reassessment
    needs no assertion, result, receipt, or other record; the LLM simply
    reconstructs the input and requests another preflight when needed.
- **C15:** A versioned hash of the typed normalized reshape input gives
  preflight and execution one representation-independent identity without
  mistaking the hash for approval or semantic proof.
  - **E27:** The decision owner required on 2026-08-24 that preflight normalize
    and hash its input and that exact hash be mandatory for execution.
- **C16:** A preflight-issued opaque token is necessary in addition to the
  normalized-input hash when guided LLM operation must make successful
  preflight an explicit standard-path step rather than a value the caller can
  reproduce without visiting that step.
  - **E28:** The decision owner required on 2026-08-24 that preflight include a
    token because a salt or another caller-reproducible hash input can be used
    to fabricate the gate.
  - **E29:** The decision owner clarified on 2026-08-24 that perttool provides
    guided LLM-operation navigation: it should help an LLM recognize and stop
    at an intended user-approval boundary, not authenticate OS users or defend
    against deliberate local tampering, intentional false assertions, or user
    coercion.
- **C17:** Shared planning elements must project globally by project-owned
  entity, and the last Work association must have an explicit disposition, to
  preserve one semantic owner without hidden cross-Work mutation or orphan
  Temporary Draft.
  - **E30:** The decision owner accepted on 2026-08-24 global atomic projection
    of a shared Event or Activity, complete affected-Work reporting,
    association-to-link replacement, explicit last-consumer disposition, and
    closed endpoint-complete Activity projection.
- **C18:** Persisted Window closure must contract current source and make
  carry-over an explicit new selection so sprint reporting does not introduce a
  closed-to-archived lifecycle or silently change Work and DAG state.
  - **E31:** The decision owner accepted on 2026-08-24 that persisted Window
    presence means active, close returns its report while removing it in the
    same candidate, optional carry-over is an explicit next-Window selection,
    ad hoc Windows have no lifecycle, and former Window state belongs to Git.
- **C19:** Narrow deferral must be an explicit closed reverse projection of
  only unstarted linked strict meaning so it cannot silently change sprint
  selection, erase execution evidence, or make the remaining DAG invalid.
  - **E32:** The decision owner accepted on 2026-08-24 the recommended model:
    same-identity Task-to-Activity return, explicitly selected internal
    Milestone-to-Event return, strict boundary Milestone retention, atomic
    restoration of every linked Work association, no Window coupling, and
    fail-closed protected-evidence handling.
- **C20:** Work completion must remain a derived multi-axis observation rather
  than a stored Work lifecycle so Task execution, Milestone acceptance,
  planning coverage, Window disposition, and archiveability retain distinct
  semantic owners.
  - **E33:** The decision owner accepted on 2026-08-24 the recommended model:
    no persisted Work completion flag, independent refinement, execution,
    outcome, organization, and close-disposition observations, and no inferred
    completion from absent or incomplete evidence.
- **C21:** Observation must combine current-source authority with bounded
  immutable Git reconstruction so advance and source contraction do not force
  historical ledgers back into current `.pert` or erase reportable evidence.
  - **E34:** The decision owner accepted on 2026-08-24 the recommended model:
    latest `.pert` for current facts, Git for removed projection, execution,
    outcome, and Window evidence, explicit evidence binding and completeness,
    and unknown or unavailable results rather than inference when proof is
    incomplete.
- **C22:** One explicit project-wide total Work order is necessary to make
  backlog sequence stable without deriving planning priority from source
  layout, advisory dependencies, Window selection, or execution authority.
  - **E35:** The decision owner accepted on 2026-08-24 the recommended model:
    every current Work appears exactly once in the global order, mutations
    preserve or explicitly change positions, Windows filter that order,
    `depends_on` reports conflicts without reordering, and `dag next` remains a
    separate execution recommendation.
- **C23:** Many-to-many persisted Window membership is necessary because a
  Window is a selection and observation boundary rather than an exclusive Work
  owner, while identity-deduplicated aggregation is necessary to avoid
  multiplying authoritative execution and outcome facts.
  - **E36:** The decision owner accepted on 2026-08-24 the recommended model:
    overlapping active and ad hoc Windows, one relation per Window-Work pair,
    close isolation, non-duplicating carry-over, no dependency auto-selection,
    explicit overlap reporting, and separate membership-attribution and
    unique-entity totals.

## Alternatives

### Require a complete strict PERT immediately

Rejected because it prevents draft use, encourages invented endpoints and
estimates, and forces backlog candidates into project completion semantics.

### Use a mandatory Planning Event and Change Intent AoA

Superseded from ADR 0007 for Issue #12 because it centers an upper planning
graph instead of Work refinement and Window operation. A related model may be
reconsidered under Issue #3, but no multi-document model is accepted here.

### Model a sprint as a DAG subgraph or milestone lifecycle

Rejected because sprint selection and closure would then alter execution
dependency, project completion, or milestone acceptance meanings. A Window is
orthogonal selection and reporting state.

### Use declaration order as backlog order

Rejected because formatting, source reorganization, and future document
composition would then become semantic reorder operations. Declaration
placement and the explicit backlog sequence remain independent facts.

### Store only a priority value or derive order from `depends_on`

Rejected because equal priorities do not form a deterministic total order, and
dependency cycles cannot be topologically ordered. Dependencies describe
planning prerequisites, not product-value priority, and therefore only produce
advisory conflicts with the explicit order.

### Give every Window an independent Work order

Rejected for the first contract because overlapping Windows could silently
assign competing positions to the same Work. Windows filter the project-wide
order; execution sequencing remains owned by the strict DAG.

### Permit only one active persisted Window per Work

Rejected because exclusivity would make a reporting selection act like Work
ownership and prevent simultaneous sprint, release, team, or thematic views.
Overlap is safe while Window membership grants no execution authority and is
reported explicitly.

### Assign a primary Window and treat other memberships as secondary

Rejected because primary status has no selected behavior in refinement,
execution, outcome acceptance, carry-over, or archival. Adding it would create
a synchronization and transfer lifecycle without resolving an accepted use
case.

### Sum every Window's Task and outcome totals directly

Rejected because one Work or shared strict entity may occur in several Window
views. Direct summation would multiply the same actual, completion, or accepted
outcome; attribution occurrences and unique-entity totals remain separate.

### Store a lifecycle or completion flag on Work

Rejected because Work would become a second owner of facts already owned by
Task lifecycle and Milestone acceptance. It would also require synchronization
after projection, deferral, advance, Window close, and direct strict-DAG use.

### Collapse Work observations into one computed done value

Rejected because a single value cannot distinguish projected Task completion,
accepted outcomes, unprojected planning meaning, incomplete evidence,
carry-over selection, and source archiveability. The result would either hide
material facts or invent a product-specific completion policy.

### Retain projection links after their strict targets advance

Rejected because a link to a removed current entity would require a tombstone
or historical target declaration and turn the latest source into a reporting
ledger. Git reconstruction preserves the former link and target together.

### Persist completion snapshots or Window close reports in current source

Rejected because the snapshot would duplicate Task, Milestone, actual, and Git
history facts and require its own invalidation rules. Close returns an
evidence-bound result, contracts current Window state, and leaves later review
to an explicit historical observation.

### Retain a closed Window until a later archive operation

Rejected because a closed declaration plus later archival would create a
second Window lifecycle and keep past sprint state in the latest-source
document. Close instead returns the report and contracts the Window in one
candidate; Git retains the former state.

### Carry every incomplete selected Work automatically

Rejected because carry-over is a new backlog selection decision, not a Task or
Work lifecycle consequence. Close reports incomplete selected Work, but only
an explicit membership in a named next Window performs carry-over.

### Defer incomplete Window Work when the Window closes

Rejected because Window selection does not establish projection ownership or
deferral eligibility. Closing a reporting boundary must not remove strict Tasks
or Milestones, alter execution evidence, or infer that incomplete Work should
return to Temporary Draft.

### Implement deferral as Git revert or raw strict deletion

Rejected because Git revert restores file history rather than current semantic
ownership, and raw deletion can strand Work links or invalidate the strict DAG.
Deferral is a candidate-bound same-identity reverse projection with explicit
affected-Work, evidence, and remaining-graph checks.

### Put backlog and sprint state in a separate document now

Rejected for the first Issue #12 boundary because it would require the
multi-document identity, resolution, stale-input, and transaction model owned
by Issue #3 before solving the single-document draft problem.

### Use one generic untyped planning element

Rejected because later classification would make projection a semantic
conversion and would weaken the explicit Event-node and Activity-edge AoA
model. Incomplete refinement uses standalone Events rather than an untyped Do.

### Copy projected meaning and synchronize Work with the DAG

Rejected because two independently editable copies would require conflict and
precedence rules and would violate the selected single-owner boundary.

### Derive namespaces from file paths or use titles as identity

Rejected because file movement and display-name edits would silently change
references. Namespaces are logical, IDs are stable, and titles are display
facts only.

### Add an ID-bearing statement primitive for residual text

Rejected for the first contract because independently identified clauses would
add ownership, namespace, split, merge, projection, and archival rules before a
demonstrated use case requires them. Work `description` is the single residual
intent boundary; operation-local inventory labels do not persist as statements.

### Prove natural-language projection coverage

Rejected because semantic equivalence and completeness are not mechanically
available from rewritten prose. The selected interface provides only the
explicit residual-description action and the unchanged-value reminder.

### Convert every Work dependency into a DAG edge

Rejected because a dependency needed to shape backlog meaning is not
necessarily an execution precedence constraint. Automatic conversion would
grant schedule and start-authority meaning before truthful Events and
Activities exist.

### Add a generic related-to relationship now

Deferred because a symmetric association with no selected behavior could add
source and interface complexity without improving refinement, selection, or
projection. It may be reconsidered from demonstrated navigation or interaction
use cases.

### Define separate semantic contracts for split, merge, move, create, and remove

Rejected because all five operations are projections of one affected-element
inventory from labeled origins to labeled Work or discard destinations.
Separate conservation rules would be harder to audit and could diverge.

### Hash the caller's raw request bytes

Rejected because JSON field order, whitespace, or another representation-only
difference would create unrelated identities for the same typed reshape input.
Preflight hashes a versioned normalized model while retaining separate raw
source and final-candidate digests.

### Salt the normalized-input hash and use it as the preflight receipt

Rejected because a public or caller-selected salt, nonce, or UUID adds
uniqueness but does not distinguish a visited preflight from a caller-computed
value. A caller that can construct the normalized input can construct the
salted hash without invoking preflight. The selected token is generated only
after successful preflight and matched against an ordinary perttool-managed
transient registry. It makes the navigation step explicit without claiming
authenticated authority or adversarial resistance.

### Copy the source Work and edit both sides after split

Rejected because the same residual meaning would temporarily have two owners
and could diverge. Split must produce the source remainder and transferred Work
as one final candidate.

### Project only one Work association to a shared element

Rejected because Event and Activity meaning is owned by the project entity,
not by each Work association. Per-association projection would require either a
second semantic copy or one Work to keep pointing at a planning declaration
that no longer exists. Shared projection instead affects every associated Work
atomically and reports that complete impact before execution.

### Retain an orphan planning element after its last Work association

Rejected because the pool is the current Work refinement boundary and a
consumerless Temporary Draft has no current Work consumer or archive meaning.
The last association can disappear only with explicit re-association,
projection, or discard in the same candidate.

### Retain an absorbed Work as a merged redirect

Rejected because a redirect would add a Work lifecycle and permanent transfer
ledger to current source. Merge rebinds current references, removes the
absorbed Work, and leaves former identity and meaning in Git history.

## Consequences

Positive:

- The canonical project file can be useful from incomplete draft through
  executable DAG without fabricating PERT facts.
- A vague idea, problem, value, or hypothesis can remain one independently
  selectable Work before any Event or Activity is truthful.
- Work dependencies can guide backlog refinement and Window coverage without
  granting schedule or start authority.
- One explicit project-wide order gives every Work a deterministic backlog
  position without turning declaration layout, dependency, or Window selection
  into hidden priority.
- Explicit insertion, preservation, merge, archival, and reorder rules keep
  Work reshaping from changing backlog position accidentally.
- Project-owned Events and Activities can be associated with multiple Work
  without duplicating their AoA meaning.
- Shared-element projection exposes every affected Work and moves the entity
  once without a per-Work planning copy or a hidden partial projection.
- Last-consumer handling cannot silently orphan or remove Temporary Draft
  meaning; one explicit re-association, projection, or discard is required.
- Work boundaries can be created, removed, split, merged, or partially
  rearranged through one semantic inventory while Event and Activity remain the
  explicit AoA semantic primitives.
- Origin and destination accounting detects undeclared loss, duplication, and
  addition without making natural-language equivalence a machine claim.
- A normalized-input `preflight_hash` binds both actual descriptions, both
  semantic decompositions, and their mapping before any internal LLM
  reconsideration and exact execution without becoming an approval token.
- A tool-managed one-time `preflight_token` distinguishes an actually completed
  preflight from a caller-recomputed hash in the guided operation path without
  replacing existing mutation authority.
- Projection transfers same-identity meaning to Milestone and Task owners
  without creating a synchronization contract.
- Projection and archival contract current source without accumulating a
  completed-draft, tombstone, transfer, or Work archive ledger.
- The residual-description action and one unchanged-value warning catch a
  common refinement omission without adding a semantic-text subsystem.
- Stable logical namespaces and mutable titles separate machine reference from
  human recognition and reserve a compatible path toward Issue #3.
- Scrum-like sprint selection, Kanban-like observation, and direct waterfall
  DAG operation coexist around the same execution source of truth.
- Overlapping Windows can express concurrent sprint, release, team, and
  thematic views without making any Window an exclusive Work owner.
- Separate attribution occurrences and identity-deduplicated totals prevent
  cross-Window reports from multiplying shared Work, actuals, or outcomes.
- Window close returns current reporting evidence and removes past selection
  state without adding a closed-to-archived lifecycle.
- Explicit carry-over prevents Window closure from silently selecting future
  work or changing Work and strict DAG facts.
- Multi-axis observation shows refinement coverage, Task execution, outcome
  acceptance, organization, and close disposition without adding a competing
  Work lifecycle.
- Incomplete evidence remains visible as unknown or unavailable instead of
  turning missing links or history into a false completion claim.
- Bounded Git reconstruction preserves reportable projection, execution,
  outcome, and former Window evidence while current `.pert` stays limited to
  latest planning and execution state.
- Exact source and Git bindings distinguish a reproducible historical
  observation from a best-effort ID match or stale mixed-revision summary.
- Narrow deferral can return a closed unstarted fragment to planning ownership
  without copying meaning, rewriting actual history, or coupling that movement
  to Window close.
- Boundary Milestones and complete remaining-DAG validation keep reverse
  projection from weakening the strict execution structure.
- Milestone lifecycle remains unchanged; Windows report but do not own outcome
  criteria or evidence.
- Multi-document hierarchy remains a separate design rather than silently
  determining the single-document pool.

Costs and open design work:

- Exact inventory and preflight binding, normalization vectors, description
  coverage and reconstruction, token generation, transient registry behavior,
  expiry, one-time consumption, accepted shared-association projection,
  reference rebinding, complete total-order validation, insertion and reorder
  behavior, dependency-order conflicts, dependency cycles, unique Window
  membership, overlap reporting, identity-deduplicated aggregation, and
  last-consumer disposition require closed cases that fail safely on ambiguity.
- Element projection coverage, the residual-description warning, namespace
  source syntax, ID retirement enforcement, accepted narrow-deferral
  eligibility and protected-evidence closure, archival, accepted Window close
  contraction, explicit carry-over, multi-axis observation, selected execution
  completion coverage, current-and-historical evidence composition,
  first-parent continuity and gaps, race handling, evidence completeness, and
  unknown handling require normative cases.
- Source grammar, migration, CLI, Core, result, schema, Help, Guide,
  diagnostics, hard limits, and installed-package compatibility remain open.

## Implementation notes

This ADR accepts only the corrected architectural boundary. It fixes the
intent-oriented `Add residual description`, `--add-residual-description`, and
`add_residual_description` interface names but does not select their containing
command route, a grammar version, CLI contract, implementation plan, release,
Issue mutation, publication, or external backlog synchronization.

The first implementation-plan task must accept a normative contract and
machine-readable cases ordered around the three use cases. Runtime work must
not begin from ADR 0007.

## Review

The decision owner explicitly requested that ADR 0007 be superseded and the
design return to the confirmed use cases on 2026-08-24. This record accepts the
corrected single-document direction. On the same date, subsequent review
replaced Work-as-edge and optional-endpoint Draft Shape with Work as an
organization boundary above separate Event and Activity primitives, selected
single-owner projection and source contraction instead of double management,
accepted explicit Work and link archival into Git history, and fixed the
forward-compatible logical namespace and `title` display-name boundary. The
owner then clarified that Work is the independently selectable backlog item,
accepted its optional `description` as residual intent, selected the explicit
`Add residual description` interface, and limited mechanical assistance to a
non-blocking unchanged-description reminder. The owner subsequently fixed
Event and Activity as project-owned entities associated with, rather than
owned by, Work; accepted directional planning-only Work dependencies; and
deferred a generic related relationship until its usability is known. The
owner then selected semantic transfer as the common split and merge model:
split cuts a selected portion from the principal Work, while merge transfers
the complete absorbed Work into the selected target without retaining a copy
or redirect. The owner generalized that model to one operation-local inventory
of every affected, removed, and created semantic element with a labeled origin
and exactly one Work or discard destination. The owner then required the LLM to
submit that plan to a read-only preflight, review the returned before/after
decompositions, mappings, and actual descriptions internally, and execute only
the exact result after any needed reconstruction. The owner then required
preflight to hash a versioned normalized input and made that exact
`preflight_hash` mandatory for execution.
The owner subsequently clarified that LLM reassessment is an unrecorded
internal reconstruction loop: it creates no review assertion or artifact and
only another input and preflight when revision is needed. The owner then
required an opaque preflight-issued token in addition to the normalized-input
hash, explicitly rejecting a salt or other caller-reproducible value as
forgeable. The owner then fixed the governing threat model as guided
LLM-operation navigation: preflight and a later user-response boundary should
be conspicuous to an LLM following standard perttool operation, while OS-user
authentication, resistance to deliberate local tampering or false assertions,
and prevention of user coercion remain non-goals. Details named as contract
work remain unaccepted until separately reviewed. The owner then accepted
project-owned entity projection as the only projection unit for a shared Event
or Activity: all associated Work are affected, their associations become
projection links atomically, the last association requires an explicit
re-association, projection, or discard, no orphan Temporary Draft remains, and
Activity projection requires existing or simultaneously projected Milestone
endpoints in one closed acyclic candidate. The owner then accepted active-only
persisted Windows: close returns the report and removes the Window in one
source-contraction candidate, optional carry-over is an explicit membership in
a next active Window, Work and DAG facts remain unchanged, ad hoc Windows have
no lifecycle, and Git retains the former persisted selection state.
The owner then accepted narrow deferral as a separate explicit reverse
projection: only a closed fragment of unstarted strict entities with live Work
projection links can return, Tasks become same-identity Activities, explicitly
selected internal Milestones become same-identity Events, boundary Milestones
remain strict, every linked Work association is restored atomically, Window
operation remains independent, and ambiguous protected evidence fails closed.
The owner then accepted derived multi-axis observation instead of a Work
completion lifecycle: refinement coverage, Task execution, Milestone outcome,
organization and archiveability, and Window close disposition remain separate;
selected execution completion is observational, absent coverage is not
completion, and incomplete evidence is reported rather than inferred.
The owner then accepted current-source plus Git evidence composition: latest
`.pert` remains the authority for current facts, bounded immutable first-parent
history reconstructs removed projection, execution, outcome, and Window facts,
every result exposes its evidence basis and completeness, and gaps or races
produce unknown or unavailable observations without a current-source ledger.
The owner then accepted one explicit project-wide total Work order independent
of declaration placement, `depends_on`, Window selection, and strict execution
authority. Creation and split state insertion positions, merge preserves the
surviving Work position, archival removes its entry, other reshapes preserve
positions unless they explicitly reorder, Windows filter the global sequence,
dependency conflicts remain advisory, and `dag next` remains authoritative for
execution recommendation.
The owner then accepted many-to-many Window selection: active persisted and ad
hoc Windows may overlap, one Window-Work pair remains unique, close affects
only its own memberships, carry-over does not duplicate an existing target
membership, dependencies do not auto-select Work, overlap is reported without
default prohibition, and cross-Window output separates membership attribution
from identity-deduplicated Work, Task, Milestone, actual, and outcome facts.

## Follow-ups

1. Define project-owned Event and Activity declaration, many-to-many Work
   association, Activity endpoint, the operation-local semantic inventory,
   exact source coverage and final reconstruction, the read-only preflight
   result, normalized-input hash vectors, opaque-token generation, ordinary
   tool-managed transient registry, expiry, recoverably idempotent consumption,
   stale invalidation, execution rebinding, reference rebinding, last-consumer,
   and Temporary Draft discard semantics. Do not add an LLM-review record or
   assertion, substitute a salt for the token, or introduce OS-user separation,
   authentication, protected signing, or secure transport. Normative cases must
   preserve the accepted global shared-element projection, complete affected-
   Work enumeration, association-to-link replacement, explicit last-consumer
   disposition, and closed Activity endpoint rules.
2. Define residual-description mutation, the exact four-condition reminder,
   Event-to-Milestone and Activity-to-Task projection coverage, same-identity
   materialization, and current link retention through concrete scenarios.
   Preserve narrow deferral as a separate explicit reverse projection limited
   to closed unstarted linked fragments, with same-identity Task-to-Activity,
   explicitly selected internal Milestone-to-Event, retained boundary
   Milestones, complete affected-Work restoration, remaining-DAG validation,
   no Window coupling, and fail-closed protected-evidence handling. Do not add
   natural-language semantic-equivalence or coverage inference.
3. Define root namespace source projection, qualified-ID result representation,
   title display, ID retirement, diagnostics, and compatibility. Leave
   multi-file binding, alias, mounting, and nested resolution to Issue #3.
4. Define directional Work dependency source syntax, advisory readiness,
   unresolved, cyclic, and explicit-order conflict diagnostics, removal, and
   archive interaction. Do not automatically reorder Work, add a generic
   related relationship, or infer a strict DAG edge.
5. Define persisted and ad hoc Window source and result contracts, timeboxes,
   objectives, dependency coverage, global-DAG conflict reporting, and
   Scrum-like and Kanban-like cases. Preserve active-by-presence persisted
   Windows, close-and-contract reporting, explicit next-Window carry-over, no
   stored closed state, and no ad hoc lifecycle. Define many-to-many active
   Window membership, unique Window-Work pairs, time and membership overlap
   facts, close isolation, already-selected carry-over, uncovered dependencies,
   and separate attribution-occurrence and identity-deduplicated totals without
   a primary Window or dependency auto-selection. Preserve the absence of Work
   lifecycle state and report refinement, execution, outcome, organization,
   and close-disposition axes independently. Define selected execution
   completion only from identified Activity coverage, complete corresponding
   Task execution, and a complete evidence basis; report absent or incomplete
   evidence explicitly and never infer completion from it. Bind current
   observations and close reports to one exact current-source snapshot and any
   bounded first-parent Git evidence used; leave post-close reporting to an
   explicit historical observation. Window views must filter the project-wide
   Work order rather than introduce a second semantic sequence.
6. Define Work and projection-link archival, advance cleanup composition, and
   history-safety ownership for canonical Work, links, and Windows, including
   the exact exclusion of Temporary Draft ranges. Define stable-identity
   projection-lineage reconstruction, Git endpoint and object bindings,
   continuity and validity gaps, source and repository races, shallow and
   forced-history-loss behavior, and hard limits without retaining tombstones,
   completion snapshots, or closed-Window reports in current source.
7. Define the complete duplicate-free project-wide Work order representation,
   insertion and reorder requests, before-and-after results, migration, and
   history-safe persistence together with the closed source, Core, CLI, result,
   schema, Help, Guide, hard-limit, and backward-compatibility contracts.
