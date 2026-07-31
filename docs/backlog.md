# Product backlog

- Status: Active
- Updated: 2026-07-30

This file records post-beta product work before or after it is promoted into an
independent `.pert` workstream. It is not a normative interface specification.
A backlog item must move into requirements, specifications, design, a PERT
plan, and tests before implementation is accepted.

## CLI and help reset

The evidence and proposed breaking surface are recorded in the
[CLI surface review](process/cli-surface-review.md).
The eight items below are mapped one-to-one into
[`plans/cli-surface-reset.pert`](../plans/cli-surface-reset.pert), preceded by a
normative contract-design task. The
[Contract 3 specification](specs/cli-contract-3.md) and
[migration guide](process/cli-contract-3-migration.md) accept that design
target. `CLI-001`, all three `HELP-*` items, project initialization, gate
maintenance, the atomic public `CLI-002` cutover, and installed-package
acceptance are complete.

### CLI-001: Adopt one command descriptor registry

Priority: P0

Status: Complete (2026-07-24)

Replace dispatch-specific and hand-written help tables with one typed command
descriptor registry used by dispatch validation, text help, JSON help, and
tests.

Acceptance:

- every implemented resource/action occurs exactly once in the registry;
- operands and options declare type, requiredness, repeatability, default,
  conflicts, input mode, output mode, write behavior, and exit statuses;
- dispatch cannot accept a command or option that structured help omits;
- adding a command without help and an example fails a repository test.

### HELP-001: Add hierarchical, machine-readable command discovery

Priority: P0

Status: Complete (2026-07-24)

Provide top-level, resource-level, and action-level help for humans and LLMs.

Acceptance:

- `perttool help --format json` returns the complete command catalog;
- `perttool help <resource> --format json` returns every action for the resource;
- `perttool help <resource> <action> --format json` returns the complete command
  contract;
- text and JSON are projections of the same registry;
- help runs without reading a project file and reports no undocumented side
  effects.

The active Contract 3 projection satisfies the registry, query, projection,
lookup-diagnostic, determinism, and no-I/O requirements. The public `help`
command and exact `--help` aliases use it while the completed `HELP-002`
projection keeps domain guidance separate from command discovery.

### HELP-002: Separate command help from domain guidance

Priority: P1

Status: Complete (2026-07-24)

Move conceptual DSL, analysis, recommendation, editing, and workflow guidance
behind a distinct `guide` surface. Preserve stable topic IDs and diagnostic
links through an explicit migration.

Acceptance:

- command discovery never requires knowing a domain topic ID;
- domain guidance never acts as a substitute for the option contract;
- diagnostic help links resolve to a known guide topic;
- installed-package text and JSON golden tests cover both surfaces.

The pure Contract 3 `Perttool.GuideResult.v1` projection now preserves every
existing topic ID and content level, emits distinct `guide_topic` diagnostic
links, and has deterministic text/JSON golden and installed-package coverage.
Command discovery remains independent of the topic graph. The atomic cutover
published this projection as `guide` and removed the Contract 2 `dsl help`
route.

### HELP-003: Improve usage-error recovery

Priority: P1

Status: Complete (2026-07-24)

Usage errors should identify the failed command, the invalid token or option,
and the exact structured-help query that describes the accepted surface.

Acceptance:

- unknown resource, action, option, missing value, conflict, and extra operand
  each have focused tests;
- JSON errors include a stable help target rather than only the generic
  `errors` topic;
- no suggestion invents an unimplemented command or option.

The pure Contract 3 recovery layer now validates descriptor-expressible argv
structure before document I/O, returns stable exact help targets, and limits
deterministic suggestions to the applicable registry scope. The atomic cutover
made it the active pre-I/O argv validation and error surface.

### MUT-001: Initialize a project through the CLI

Priority: P0
Status: Complete (2026-07-24)

Add a preview-first project initialization command that creates the smallest
valid `.pert` document through the same validated and exclusive-create path as
other document output.

Acceptance:

- required project ID, title, duration unit, initial milestone, and finish are
  explicit;
- default preview returns candidate text and JSON edits without writing;
- `--out` refuses an existing path and verifies the written document;
- point units require a valid velocity;
- no template silently creates tasks, resources, or dependencies.

### MUT-002: Add complete gate maintenance

Priority: P0
Status: Complete (2026-07-24)

Add gate Core mutations, atomic-batch support, and CLI
`gate add|set|remove`.

Acceptance:

- gate ID, endpoints, and reason are source-preserving;
- remove has no implicit cascade;
- connected milestone and gate creation can be submitted as one atomic batch;
- preview, diff, JSON, `--write`, `--out`, and optimistic locking match the
  task/milestone/resource contract.

The public `gate add|set|remove` commands and `batch apply` accept typed gate
mutations and use the shared preview and safe-write controls.

### CLI-002: Normalize public names in one breaking version

Priority: P1

Status: Complete (2026-07-24)

Adopt the command mapping and naming rules from the CLI surface review in one
versioned change rather than accumulating aliases.

Acceptance:

- the CLI contract version and affected JSON operation names are bumped before
  implementation;
- command names, kebab-case option names, DSL field names, and snake_case JSON
  fields have an explicit mapping;
- README, help, examples, package smoke tests, and migration notes change with
  the implementation;
- obsolete beta spellings fail clearly after the documented migration window.

### CLI-003: File-first maintenance acceptance

Priority: P1

Status: Complete (2026-07-24)

Verify the intended workflow: read the text file directly, use commands for
validated maintenance, and use JSON for automated decisions.

Acceptance:

- a new project can be initialized without hand-authoring syntax;
- every project, task, gate, milestone, and resource field can be maintained by
  a typed command or one atomic batch;
- direct entity list/show commands are not added merely to duplicate the source
  file;
- effective or derived values remain available from `project show`, `document
  check`, `dag analyze`, and `dag next`;
- an end-to-end test creates, changes, analyzes, advances, and validates a plan
  without manually rewriting the file.

`scripts/check-package-file-first.mjs` now runs from `check:package` against
only the isolated installed CLI. It initializes and directly reads a plan,
uses an atomic batch and typed commands to cover every declared entity field,
observes blocked, recommended, active, and done task states through JSON,
advances completed history, and validates the final one-frontier document.

## Advance history safety

### ADV-001: Guard advance writes that can erase uncommitted history

Priority: P0

Status: Contract accepted (2026-07-31; runtime not implemented)

`dag advance` deliberately removes declarations and owned leading comments
that no longer affect the present or future graph. The current source-digest
and atomic-write controls prevent stale or partial writes, but they do not
prove that the exact pre-advance information being removed is recoverable from
Git. A task can therefore be marked `done` and advanced before that transition,
or another edit inside a removed declaration, has appeared in commit history.

Add a repository-aware guard at the in-place advance-write boundary. Do not
treat every dirty repository or every dirty target file as destructive. A
dirty change that remains byte-for-byte in the advance candidate is not lost.
Block only when an advance edit would remove or replace current-side
information that the guard cannot prove is represented by the selected Git
history baseline.

Refined behavior:

- The guard applies to a changed `dag advance <file> --write` operation.
  Preview, `--diff`, stdin, `--out`, and an idempotent no-op do not erase the
  source file and are not blocked by this guard.
- The default history baseline is the target path in the repository's `HEAD`
  commit. Staged changes are still uncommitted and are not treated as durable
  history.
- Each non-empty source range removed or replaced by the advance `TextEdit`
  set, including declaration-owned leading comments, is checked against
  current-side additions or modifications relative to `HEAD`.
- Dirty changes outside those destructive ranges are retained by the
  source-preserving candidate and do not block the write.
- A target that is untracked at `HEAD`, a repository without `HEAD`, a path
  outside a Git worktree, unavailable Git inspection, an ambiguous path
  mapping, or a history check that cannot prove preservation is unsafe by
  default when the candidate has destructive edits.
- The proposed explicit override is `--force-history-loss`. It is valid only
  with in-place `--write` and bypasses only this history-recoverability guard.
  It must not bypass parsing, semantic and advance postconditions, expected
  digests, source rechecks, symlink/race rejection, or atomic-write rules.
- The guard performs read-only repository inspection. It never stages,
  commits, stashes, resets, checks out, or otherwise changes Git state.
- A successful proof is bound to the repository identity, repository-relative
  path, `HEAD` object ID, and raw source digest and is rechecked immediately
  before the atomic write. A changed source or history baseline fails safely.
- Text and JSON identify whether the guard was not applicable, passed,
  blocked, or explicitly forced. A blocked result includes stable diagnostics
  and the affected advance edit or entity IDs without exposing an absolute
  repository path.

Acceptance:

- a tracked target identical to `HEAD` can perform a destructive advance;
- staged or unstaged information inside a removed task, gate, milestone,
  scalar replacement, or owned leading comment blocks the write;
- a dirty edit that is wholly retained in the candidate does not block;
- an untracked target and a target outside a Git repository block a
  destructive in-place write but remain previewable and writable to a separate
  `--out` path;
- an empty advance remains a no-op without requiring Git history;
- `--force-history-loss` records that the override was used and cannot relax
  any existing safe-write or validation gate;
- changes to `HEAD` or the source between assessment and write are rejected;
- worktrees, staged changes, renames, BOM/CRLF input, Git-unavailable
  environments, and deterministic text/JSON diagnostics have focused tests;
- command discovery, exact help, guide content, README workflow examples, and
  installed-package file-first acceptance expose the same guard and override
  semantics.

Non-goals:

- rejecting a write solely because unrelated paths or retained source ranges
  are dirty;
- automatically creating a history commit or searching reflogs, unreachable
  objects, chat logs, or terminal output for a recoverable copy;
- adding Git requirements to check, analysis, recommendation, ordinary
  mutation preview, or advance preview;
- generalizing the first version to explicit `task|gate|milestone remove`;
- implementing recommendation override apply, its durable audit sink, or any
  Git mutation.

Provisional delivery slices:

| ID | Scope | Estimate | Exit |
| --- | --- | ---: | --- |
| `ADV_HISTORY_CONTRACT` | Requirements, Git-baseline and dirty-range semantics, CLI/schema compatibility, diagnostics, and the boundary with MIG-08 and Contract 3 | 3p | A normative contract and acceptance matrix are approved before runtime changes. |
| `ADV_HISTORY_PROBE` | Pure history assessment plus a read-only Git adapter bound to `HEAD`, path, and source digest | 4p | Unit tests distinguish preserved dirty changes from destructive overlap and fail closed when proof is unavailable. |
| `ADV_HISTORY_CLI` | `dag advance --write` enforcement, explicit force option, descriptor/help projection, and structured result | 4p | In-place writes enforce the guard without weakening existing safe-write controls. |
| `ADV_HISTORY_ACCEPTANCE` | Race/worktree/encoding cases, E2E, guide/README, link, and installed-package checks | 3p | The complete repository and package gate passes with no automatic Git mutation. |

The four slices are promoted into the independent
[`plans/advance-history-safety.pert`](../plans/advance-history-safety.pert)
workstream. The selected
[Advance History Safety Contract](specs/advance-history-safety.md) resolves
the current Contract 6 boundary: the guard shares repository/path/`HEAD` and
raw-source capture with the accepted project-history adapter, adds stage-0
index capture, and remains a separate application decision from both history
reduction and MIG-08. It targets `Perttool.AdvanceResult.v1` because the
published MutationResult v3 schema is closed. Runtime implementation remains
unaccepted until the later probe, CLI, and acceptance tasks pass.

## Project actuals and Git-recorded history

### ACT-001: Record explicit work lifecycle and observed project performance

Priority: P0

Status: Released in `0.5.0` beta (2026-07-29)

Git history can prove that a task-state snapshot was recorded, but it cannot
prove the actual event time, active execution duration, person effort, or the
operator's intended lifecycle transition. Add explicit task work events and
use Git as their durable pre-advance history rather than interpreting commit
time as completion time.

The target architecture is recorded in
[ADR 0006](adr/0006-explicit-work-events-in-git-history.md), the accepted
normative target semantics are in the
[Project Actuals and Git History Contract](specs/project-actuals.md), and the
work state is in
[`plans/project-actuals.pert`](../plans/project-actuals.pert). The
[`ACTUALS_CONTRACT_REVIEW`](process/project-actuals-contract-review.md) fixes
the source and public-interface details. The
[`ACTUAL_SOURCE_CORE` acceptance](process/project-actuals-source-core-acceptance.md)
records the internal Grammar 5 parser, validation, formatter, and exact source
model without activating the future public contract. The
[`ACTUAL_GIT_HISTORY_PROBE` acceptance](process/project-actuals-git-history-probe-acceptance.md)
records the internal read-only first-parent repository adapter, typed
availability, race handling, and unchanged active public surface. The
[`FINISH_ACTUALS` acceptance](process/project-actuals-finish-acceptance.md)
records atomic eventful finish, exact measurements, deterministic retry,
governed Grammar 5 safe write, and advance event ownership without activating
the future public contract. The
[`PROJECT_HISTORY` acceptance](process/project-actuals-history-acceptance.md)
records first-parent semantic reconstruction, explicit-event deduplication and
removal, qualified legacy transitions, exact task summaries, and deterministic
internal result projections while retaining the same public boundary.
The
[`WORK_LIFECYCLE` acceptance](process/project-actuals-lifecycle-acceptance.md)
records exact lifecycle candidates, resource release, and separate suspended
analysis and Next handling without activating the public contract.
The
[`VELOCITY_OBSERVATION` acceptance](process/project-actuals-velocity-observation-acceptance.md)
records exact declared and qualified Git-recorded rates, deterministic sample
selection, and unchanged declared velocity without activating the public
contract.
The
[`ACTUALS_PUBLIC_CONTRACT` acceptance](process/project-actuals-public-contract-acceptance.md)
records the atomic Grammar 5 and CLI Contract 6 source cutover, public root,
registry/help/Guide, result versions, examples, and isolated installed
workflow. The accepted `0.5.1` package publishes that boundary on npm
`beta=latest`; the pre-schema Contract 6 package remains available as `0.5.0`,
and Grammar 4 with CLI Contract 5 remains available by pinning `0.4.0`.
The
[`ACTUALS_ACCEPTANCE` record](process/project-actuals-acceptance.md)
closes all fourteen normative PACT cases through executable repository,
real-Git, linked, packaged, and isolated installed evidence with no automatic
Git or declared-velocity mutation and no release side effect.

Required outcomes:

- explicit fixed-offset `start`, `suspend`, `resume`, and `finish` events;
- an atomic task-state and event candidate with no hidden clock input;
- a distinct `suspended` state that releases renewable resources;
- exact cycle time, active time, person effort, and planned-value provenance;
- task-owned events removed by advance only after the pre-advance Git
  recoverability boundary;
- a read-only first-parent history projection that distinguishes declared
  actuals from legacy Git-recorded transitions;
- typed incomplete/unavailable results for shallow, ambiguous, renamed,
  unsupported, or conflicting history;
- exact elapsed-hour and qualified active-date Point throughput plus
  Point/person-hour productivity;
- observed velocity that never mutates declared project velocity; and
- one closed Grammar 5/CLI Contract 6 compatibility and acceptance boundary.

Compatibility and non-goals:

- Grammar 1 through 4 retain their meanings, and status-only `task finish`
  remains available for those grammars. The current source uses CLI Contract
  6; npm `beta=latest=0.5.1` publishes Contract 6 while exact pin `0.4.0`
  retains Contract 5.
- History and `ADV-001` share the narrow read-only Git adapter, path/HEAD
  identity, and race-safe inspection primitives. History does not enforce the
  advance decision, and `ADV-001` does not become the history result model.
- The workstream does not implement Git writes, automatic velocity adoption,
  post-advance correction, arbitrary branch-union history, payroll/billing,
  business calendars, statistical confidence, MIG-08, or release operations.

Planned delivery slices:

| ID | Scope | Estimate | Exit |
| --- | --- | ---: | --- |
| `ACTUALS_CONTRACT_REVIEW` | Accept source syntax/version, event/lifecycle semantics, history/observation schemas, diagnostics, compatibility, and normative cases | 4p | No unresolved semantic or public-contract decision blocks implementation. |
| `ACTUAL_SOURCE_CORE` | Grammar 5 work-event and suspended-state parsing, validation, formatting, and exact model | 5p | Complete: internal source round trips and preserves Grammar 1-4 behavior. |
| `ACTUAL_GIT_HISTORY_PROBE` | Shared read-only repository/path/revision snapshots and typed history availability | 5p | Complete: first-parent, shallow, path, race, and unavailable cases are deterministic and Git remains unchanged. |
| `FINISH_ACTUALS` | Eventful finish, exact measurements, planned baseline, retry, governance, and safe-write composition | 5p | Complete: status and finish event form one validated candidate and installed-active behavior remains unchanged. |
| `WORK_LIFECYCLE` | Start, suspend, resume, state reduction, resource/classification handling, and result version target | 7p | Complete: exact transitions, open reduction, resource release, suspended result handling, and compatibility pass focused tests. |
| `PROJECT_HISTORY` | Semantic reconstruction, deduplication, advance removal, legacy qualification, Core/text/JSON | 6p | Complete: explicit and legacy evidence remain distinct across real repository histories. |
| `VELOCITY_OBSERVATION` | Exact Point/hour, qualified Point/active-date, and Point/person-hour observations | 5p | Complete: parallel work is not double-counted, Git-recorded rates remain qualified, and declared velocity is unchanged. |
| `ACTUALS_PUBLIC_CONTRACT` | Atomic Grammar 5/CLI Contract 6 registry, help, Guide, schemas, diagnostics, and root activation | 6p | Complete: no partial public activation or compatibility alias exists. |
| `ACTUALS_ACCEPTANCE` | Repository, Git, lifecycle, link, package, and installed workflow acceptance | 4p | Complete: all normative PACT cases pass with no automatic Git or velocity mutation and no release side effect. |

### ACT-002: Reopen completed work without rewriting actual history

Priority: Unset (request only; requires feasibility review)

Status: Requested backlog (not selected; implementation undecided)

Provide a user-visible REOPEN concept, tentatively `task reopen`, for work that
was finished but later requires additional execution. This entry records the
request only. It does not add a requirement, select an implementation, create
a PERT task, reserve a CLI contract, or authorize a release.

REOPEN must be distinguished from correction. A prior finish event records
what was asserted at that time and must not silently disappear or acquire a
different payload merely because more work becomes necessary. If this request
is selected, the design must preserve that evidence and represent the later
decision explicitly.

Feasibility questions:

- Is the first version limited to a `done` task that still exists before
  `dag advance`, or must it also cover a task already removed from the current
  source?
- Does reopening retain one stable task identity with multiple execution
  intervals, create a linked attempt/revision, or require an explicitly new
  task after advance?
- Which state follows REOPEN: `active`, `planned`, or a separately modeled
  state, and must an explicit fixed-offset event time and reason be required?
- How are the previously reached target milestone, downstream reached
  closure, active or completed successors, and resource schedules handled
  without silently reversing unrelated work?
- How do history and velocity observation retain the earlier completed sample
  without double-counting planned value, effort, cycle time, or a later
  finish?
- Which owner confirmation, governance decision, recoverability proof, and
  conflict behavior apply before a persistent write?
- Does the feature require a new work-event model, Grammar version, CLI
  contract, result schema, and diagnostic family?

Safety boundaries for any future design:

- prior start, suspend, resume, and finish events remain immutable evidence;
- REOPEN is an explicit source-preserving candidate and never an inferred
  consequence of a later Git commit;
- no command automatically stages, commits, rewrites, or pushes Git history;
- no command automatically changes declared velocity or removes a previously
  reported observation;
- downstream milestones or tasks are not silently undone;
- preview, governance, expected-digest, and safe-write controls remain in
  force; and
- post-advance reconstruction fails closed when task identity or the retained
  source snapshot is incomplete or ambiguous.

Possible design directions, with none selected:

1. append a new `reopen` event to the same pre-advance task and begin another
   active interval;
2. create a linked attempt/revision that preserves the completed task as an
   immutable prior attempt; or
3. support only pre-advance REOPEN and require an explicit new task for work
   discovered after advance.

Before implementation can be planned, a contract review must choose the
supported boundary, define exact history and observation semantics, add
normative acceptance cases, and estimate independent delivery slices.
Grammar 5 and CLI Contract 6 remain unchanged until that review is accepted.

## Recommendation override application and audit

### MIG-08: Apply validated overrides with durable single-use audit

Priority: Unset (requires refinement)

Status: Refined contract backlog (not scheduled)

Extend the accepted read-only
[Recommendation Human Override Contract](specs/recommendation-override.md)
only after an independent design review selects the persistent apply and audit
boundary. The existing `validateOverride` API remains advisory and authorizes
no mutation.

Acceptance:

- the public apply surface and its result identities are versioned before
  implementation;
- every request binds one complete `Perttool.NextResult.v5`, source digest,
  recommendation digest, candidate set, actor assertion, and human reason;
- a successful decision is single-use and leaves a canonical durable audit
  artifact rather than relying on an Issue URL, chat record, or mutable log;
- source persistence and audit persistence are atomic or have an accepted,
  recoverably idempotent failure protocol;
- stale, incomplete, temporally ineligible, governance-denied, replayed, or
  mismatched input fails closed before the source changes;
- a successful apply requires reanalysis before any later selection; and
- repository, package, installed-workflow, concurrency, and write-safety tests
  cover the complete contract.

Non-goals are automatic Git staging or commits, treating caller assertions as
authentication, automatic velocity mutation, and bypassing temporal or
owner-aware governance. Git workflow integration remains a separate
workstream.

## Machine-readable public schemas

### SCHEMA-001: Publish Contract 6 JSON Schema artifacts

Priority: P0

Status: Complete artifacts published in `0.5.2` (2026-07-30); Issue closure
not authorized

Close the gap between the Must-level machine-readable interface requirement
and the current registry's schema identifiers. The
[JSON Schema Artifact Contract](specs/json-schema.md) selects Draft 2020-12,
one closed catalog for every active Contract 6 command result plus the public
OverrideDecision result, stable package-relative paths, local-only
resolution, and an additive `schema` discovery command. Repository tests
validate representative CLI/Core results and isolated package access.
The [source acceptance record](process/json-schema-acceptance.md) retains the
initial discovery trace. The compatible `0.5.2` patch completes every nested
result record, adds full and reference-based outline/detail views, and
publishes the corrected artifacts. Issue closure remains a separate external
decision.

## Hierarchical planning and multi-plan composition

### MULTI-001: Design backlog hierarchy and multi-plan composition

Priority: Unset (requires product and semantic refinement)

Status: Open in [GitHub Issue #3](https://github.com/mako10k/perttool/issues/3)
(not selected)

Define how a parent backlog or project relates to independently versioned
child `.pert` documents without silently merging task identity, duration
units, governance, calendars, resource capacity, or completion state. The
design must preserve deterministic per-document analysis and specify explicit
roll-up, cross-plan dependency, history, and failure boundaries before any
runtime or syntax change.

## Language tooling and adapters

### LSP-001: Design a read-only language server

Priority: Unset

Status: Proposed backlog (not scheduled)

Define an LSP boundary for diagnostics, document symbols, hover, completion,
and source-safe code actions by reusing the parser, semantic model, help
registry, and UTF-16 spans. The first accepted slice must remain read-only
unless a later contract proves that an edit is identical to an existing
previewed mutation candidate.

### VSIX-001: Package the accepted language server for VS Code

Priority: Unset

Status: Proposed backlog (not scheduled; depends on `LSP-001`)

Package an accepted LSP contract without adding editor-only grammar or
mutation semantics. Acceptance must cover extension activation, bundled
runtime identity, offline help, diagnostics, upgrade compatibility, and an
isolated VS Code extension test.

### MCP-001: Design a fail-closed MCP adapter

Priority: Unset

Status: Proposed backlog (not scheduled)

Define read-only MCP resources and tools from the accepted public Core and
command registry. Any future write tool must preserve preview, governance,
digest, safe-write, and audit boundaries and requires separate authorization;
the initial design must not infer authority from an MCP client connection.

## Portfolio and Issue inventory

### META-001: Keep GitHub Issue and local work-state inventories aligned

Priority: P1

Status: Refined backlog (not scheduled)

Add a repeatable repository review that records each product Issue number,
live state, local backlog ID, PERT workstream if any, completion evidence, and
explicit disposition. It must detect stale current-state prose and missing
Issue labels or mappings without rewriting historical acceptance records.
Closing an Issue remains a separate decision, and a planning record never
substitutes for a live GitHub read or authorizes an external mutation.

## Scheduling metadata and unit migration

### TIME-001: Add temporal properties and deadline-aware capabilities

Priority: P1

Status: Complete and released in `0.3.0` (retained by `0.4.0` and `0.5.0`)

Define a coherent temporal model, including `deadline`, and carry it through
the file-first interface and every affected result projection. Use that model
to add explicitly specified schedule and recommendation capabilities instead
of treating dates as display-only metadata.

Acceptance:

- requirements decide which project, milestone, and task temporal properties
  are supported and define their meanings, relationships, and optionality;
- date-only and offset-bearing date-time semantics, comparison rules, the
  relationship to `project.as_of`, and the absence or presence of a working
  calendar are explicit and deterministic;
- grammar, semantic validation, formatter behavior, source-preserving
  mutations, batch operations, command descriptors, help, guide content, and
  diagnostics cover every accepted property symmetrically;
- affected text and JSON results from project inspection, document validation,
  analysis, scheduling, and next-task selection expose the temporal inputs and
  derived values without losing exact duration values or timezone context;
- the accepted design specifies deadline-derived capabilities such as
  projected dates, feasibility, remaining margin, lateness, and overdue or
  at-risk state, including how blocked work and heuristic resource schedules
  qualify those results;
- any effect on recommendation eligibility, ranking, or reason taxonomy is
  explicit, versioned, and tested rather than introduced as an implicit
  tie-breaker;
- normative examples cover date and date-time boundaries, offsets, invalid
  calendar values, and deterministic output; the installed-package
  file-first cases activate only at the atomic Contract 4 acceptance gate.

### UNIT-001: Design safe point and time-unit migration

Priority: P1

Status: Complete and released in `0.3.0` (retained by `0.4.0` and `0.5.0`)

Design a preview-first migration that rewrites a project between `point` and
its velocity-linked `day` or `hour` unit. This is a source migration, distinct
from the existing read-only `velocity_forecast` projection.

Acceptance:

- requirements and specifications define migration direction, prerequisites,
  velocity handling, compatibility/version policy, and the public Core and CLI
  operation before implementation;
- conversion uses the project velocity and exact Rational arithmetic, never
  infers a day/hour relationship, and fails safely when the requested target
  unit is not linked by the declared velocity;
- the design inventories and converts every base-unit-bearing declaration,
  including task durations or all three PERT estimates, `critical_epsilon`,
  `target_duration`, and any duration-bearing temporal fields accepted by
  `TIME-001`;
- every exact converted Rational is source-representable in the target DSL as
  either a finite Decimal or an exact fraction Duration; no displayed decimal
  is reused as conversion input and migration never rounds;
- preview text, structured JSON, and a deterministic unified diff identify
  every changed value, while write and output modes remain atomic,
  source-preserving, race-safe, and fully revalidated;
- no-op, repeated, and exact round-trip migrations have defined behavior, and
  diagnostics explain when reversibility cannot be guaranteed;
- command discovery, help, guide content, README examples, batch interaction,
  and installed-package tests cover both `point -> day|hour` and
  `day|hour -> point`, including incompatible velocity, exact fraction,
  malformed fraction, and Grammar 1 compatibility cases, at the atomic
  Contract 4 acceptance gate.

Replanning decision on 2026-07-25:

- the finite-decimal-only migration contract is safe but incomplete for common
  velocities such as `3p/1d`;
- accepted Grammar 3 adds exact fraction Duration to the Grammar 2 temporal
  field set, while generated migration tokens use the shortest exact finite
  Decimal when possible and a reduced fraction otherwise;
- active Grammar 1 and accepted target Grammar 2 remain closed, and a migration
  that needs an exact fraction defines one atomic source-to-target grammar
  candidate and reports the grammar metadata change in its reversibility
  qualification;
- completed `RATIONAL_DURATION_CONTRACT` selected
  `perttool.temporal-unit-interface@2`, `perttool.unit-migration@2`, and
  `Perttool.UnitMigrationResult.v2` rather than silently widening an accepted
  identity; and
- the accepted
  [SU-M2R contract review](process/scheduling-units-m2r-contract-acceptance.md)
  traces Grammar 3 syntax, canonical serialization, atomic grammar selection,
  reversibility metadata, malformed input, and compatibility without
  activating Grammar 3 or Contract 4.

### Refinement and delivery milestones

`TIME-001` and `UNIT-001` form one coordinated workstream because unit
migration must inventory any duration-bearing fields accepted by the temporal
contract. Absolute dates and date-times are not converted merely because the
project duration unit changes.

| ID | Milestone | Exit criteria | Backlog coverage |
| --- | --- | --- | --- |
| `SU-M0` | Backlog refined | Scope, non-goals, milestone boundaries, and macro/detail tracking rules are recorded. | `TIME-001`, `UNIT-001` |
| `SU-M1` | Temporal and migration contract accepted | Requirements, normative specifications, interface projections, examples, compatibility policy, and an acceptance review define temporal semantics, deadline-derived behavior, and exact unit migration. | `TIME-001`, `UNIT-001` |
| `SU-M2` | Temporal source and Core foundations accepted | Target Grammar 2 parsing, validation, formatting, source-preserving temporal mutation, and declared-input Core projections are accepted without activating public Contract 4 schemas, help, or installed-package behavior. | `TIME-001` |
| `SU-M2R` | Exact rational Duration extension accepted | Requirements and a newly versioned target grammar accept Decimal-or-fraction Duration; exact serialization, parser, validator, formatter, mutation, source-to-target grammar candidate behavior, version-identity decisions, and compatibility acceptance are complete without public activation. | `TIME-001`, `UNIT-001` |
| `SU-M3` | Temporal deadline and Next v4 target Core accepted | Calendar projection, deadline evaluation, temporal precedence/resource views, and time-gated Next v4 start-authority Core are accepted without making the target CLI or authority active. | `TIME-001` |
| `SU-M4` | Exact unit-migration Core accepted | The target planner covers every base-unit-bearing value in both directions, with source-preserving preview candidates, exactness, diagnostics, idempotence, and inverse qualification, without publishing its Contract 4 command. | `UNIT-001` |
| `SU-M5` | Atomic Contract 4 workstream accepted | CLI Contract 4, public result schemas, registry/help/Guide/README, installed-package workflows, and Next v4 normal authority move together after shadow and safe-stop acceptance; release scope is decided separately. | `TIME-001`, `UNIT-001` |

Progress is tracked at two levels:

- [`plans/scheduling-units.pert`](../plans/scheduling-units.pert) is the
  completed and advanced milestone-level roadmap through reached
  `SCHEDULING_UNITS_ACCEPTED`.
- [`plans/scheduling-units-m1.pert`](../plans/scheduling-units-m1.pert) tracks
  only the detailed work required to reach `SU-M1`. It does not duplicate
  completion state for later milestones.
- [`plans/scheduling-units-m2.pert`](../plans/scheduling-units-m2.pert) tracks
  the completed and advanced six-task target-only source and Core slice that
  reached `SU-M2`.
- [`plans/scheduling-units-m2r.pert`](../plans/scheduling-units-m2r.pert)
  tracks the completed and advanced exact rational Duration contract and
  target-only source extension required before SU-M3 and SU-M4.
- [`plans/scheduling-units-m3.pert`](../plans/scheduling-units-m3.pert)
  tracks the completed and advanced six-task temporal deadline and NextResult
  v4 target Core through `TEMPORAL_DEADLINE_ACCEPTED`.
- [`plans/scheduling-units-m4.pert`](../plans/scheduling-units-m4.pert)
  tracks the completed and advanced internal unit-migration version 2 Core.
- [`plans/scheduling-units-m5.pert`](../plans/scheduling-units-m5.pert)
  tracks the completed and advanced atomic Contract 4 cutover and installed
  acceptance. Each completed detail was rolled up exactly once before the
  macro advanced.

SU-M1 acceptance:

- `TEMPORAL_REQUIREMENTS`, `CALENDAR_SEMANTICS`, `DEADLINE_SEMANTICS`,
  `UNIT_MIGRATION_SEMANTICS`, `INTERFACE_PROJECTION_CONTRACT`, and
  `NORMATIVE_EXAMPLES` are complete and advanced. The accepted deadline
  contract is
  [`perttool.deadline-evaluation` version 1](specs/temporal-deadline.md).
- The accepted calendar contract is
  [`perttool.calendar-projection` version 1](specs/temporal-calendar.md).
- The accepted migration contract is
  [`perttool.unit-migration` version 1](specs/unit-migration.md).
- The accepted public interface contract is
  [`perttool.temporal-unit-interface` version 1](specs/temporal-unit-interface.md);
  it targets Grammar 2 and CLI Contract 4 without activating that future
  surface.
- The accepted [normative examples](examples/temporal-units.md) and
  `Perttool.TemporalUnitExampleBaseline.v1` fix `TUE-001` through `TUE-018`
  across available, unavailable, not-applicable, failure, authority, and
  deterministic-projection boundaries.
- The [cross-cutting acceptance review](process/scheduling-units-m1-acceptance.md)
  closes every `TUI-001` through `TUI-018` observation, resolves the public
  cutover sequencing ambiguity, and passes the accepted contract to target
  Core implementation without activating Grammar 2, Contract 4, or Next v4.

SU-M2 progress:

- `GRAMMAR_V2_TEMPORAL_SOURCE` is complete and advanced. The identity-checked internal
  target capability parses exactly the three temporal field positions and
  exact declared date/date-time records while the active parser remains
  Grammar 1.
- `TEMPORAL_SEMANTIC_VALIDATION` is complete and advanced. The internal nominally branded
  validated-document boundary accepts Grammar 1/2 through the target
  capability, reports field-local `PTSEM-112`, and retains mixed kinds and
  active/done/reached temporal history without reading a clock or environment.
- `TEMPORAL_FORMATTER_ROUNDTRIP` is complete and advanced. The internal target formatter
  shares one canonical Grammar 1/2 field order with the parser, preserves
  source field and declaration order, comments, BOM, line endings, and exact
  temporal tokens, and revalidates an idempotent target-AST-equivalent
  candidate. The active Contract 3 formatter remains Grammar 1.
- `TEMPORAL_MUTATION_BATCH_CORE` is complete and advanced. The internal capability-checked
  target planner adds, sets, and clears task/milestone temporal fields through
  the shared canonical order and localized UTF-16 edit path. Atomic batches
  upgrade or downgrade version/anchor/temporal fields from one original AST
  and validate only the final target candidate. The common diff, digest,
  in-place/out, optimistic-lock, symlink/race rejection, and post-write
  mechanics are reused without adding a Contract 4 CLI or root export.
- `DECLARED_TEMPORAL_INPUT_CORE` is complete and advanced. Internal capability-checked
  CheckResult v2 and ProjectResult v2 Core projections expose exact typed
  anchors, milestone deadlines, task constraints, and the finish-milestone
  deadline in stable source order. Syntax failures suppress untrusted
  temporal inputs, semantic diagnostics retain trusted declarations, and an
  invalid project result is complete and null-valued without activating a
  public schema or adapter.
- `M2_FOUNDATION_ACCEPTANCE` is complete. The
  [SU-M2 acceptance record](process/scheduling-units-m2-acceptance.md) traces
  every `TUI-*` and `TUE-*` observation, the active Contract 3 rejection
  boundary, actual installed-package behavior, and the SU-M3 handoff. All 24p
  are complete at a cumulative provisional `24p/1d`; both the detail and
  macro work-package frontiers are advanced from committed snapshots.
- The user-selected rational Duration replan adds one common SU-M2R predecessor
  before SU-M3 and SU-M4. `RATIONAL_DURATION_CONTRACT` is committed and
  advanced. `RATIONAL_DURATION_SOURCE_MODEL` and `EXACT_DURATION_SERIALIZER`
  are also committed and advanced. `RATIONAL_DURATION_FORMATTER` and
  `RATIONAL_DURATION_MUTATION` are committed at `f0d9a26` and advanced through
  the expected-digest path. `RATIONAL_DURATION_VERSION_BOUNDARY` is committed
  at `fa698ca` and advanced through the same ADV-001 path. Final
  `RATIONAL_DURATION_ACCEPTANCE` is committed at `29550c5` and advanced. The
  [acceptance record](process/scheduling-units-m2r-acceptance.md) traces all
  TUI/TUE observations through 020, exact TUE-015 representation, internal
  composition, and the closed installed Contract 3 boundary. All 24p are done
  at provisional `24p/1d`; the detail has zero makespans and no recommendation
  at digest
  `sha256:5ba8eb9d5ec192f2d30568e1c51ebba670c4c496b232e6ad8bb9e965490931bb`.
- The SU-M2R macro rollup is committed at `a93c129` and advanced at
  `b4e891d`. SU-M3 is re-estimated at 23p (`0.958333d`) and SU-M4 at 25p
  (`1.041667d`).
- `MIGRATION_REQUEST_AND_INVENTORY` is implemented and recorded done through
  the validated Grammar 1/2/3 request boundary, exact velocity selection,
  declaration/field-order Duration inventory, preserved temporal snapshot,
  stable migration causes, and Contract 3 closure. Its 4p first-day sample
  recalibrates SU-M4 velocity to `4p/1d`; implementation commit `163e1bd`
  satisfies ADV-001 and the detail is advanced to `MIGRATION_REQUEST_READY`.
- `EXACT_UNIT_CONVERSION` is implemented and recorded done through exact
  Point/time formulas, ordered original/converted Rational records, canonical
  Decimal-or-Fraction tokens, Grammar 1/2/3 retention or upgrade, no-op, and
  inverse checks. Implementation commit `e442ea9` satisfies ADV-001 and the
  detail is advanced to `EXACT_CONVERSION_READY`.
- `UNIT_MIGRATION_CANDIDATE` is implemented and recorded done through one
  coordinated UTF-16 edit set, final-candidate-only Grammar 1/2/3 validation,
  exact Duration and temporal preservation postconditions, digest/diff,
  fail-closed request/source handling, determinism, BOM retention, and target
  safe-write reuse.
- `MIGRATION_NOOP_REPEAT_INVERSE` is implemented and recorded done through
  unchanged same-unit and repeated requests, exact Rational round trips,
  canonical lexical normalization, byte-retained temporal and unrelated
  source, retained Grammar 3 qualification, and inserted/replaced velocity
  metadata without historical inference. Both tasks are committed at
  `b8da602` and advanced to the reached `MIGRATION_ROUNDTRIP_READY` frontier.
- `UNIT_MIGRATION_RESULT_V2` is implemented and recorded done through the
  internal `Perttool.UnitMigrationResult.v2` schema identity, exact
  unit-bearing velocity and converted-field records, complete semantic causes,
  deterministic failures, candidate data, and verified preview/write state.
  Implementation commit `94d4e11` satisfies ADV-001; canonical advance removes
  the completed result branch and retains `M4_ACCEPTANCE_INPUT_READY` as the
  reached frontier.
- `M4_UNIT_MIGRATION_ACCEPTANCE` traces TUI/TUE through 020 in the
  [SU-M4 acceptance record](process/scheduling-units-m4-acceptance.md).
  Cross-layer tests cover exact properties, stable causes, complete Result v2,
  source preservation, no-op/repeat/inverse behavior, safe-write reuse, and
  the closed Contract 3/help/Guide/package boundary. There are no open SU-M4
  acceptance findings.
- All six SU-M4 tasks and 25p are done at cumulative `25p/1d`. The final
  acceptance snapshot is committed at `bc75b37`; the detail is advanced to
  the reached `UNIT_MIGRATION_ACCEPTED` frontier with zero makespans and no
  recommendation. The macro SU-M4 package is rolled up once in commit
  `4101ef7` and advanced. The remaining macro precedence and heuristic resource makespans
  are both `1.958333d` with no delay, and complete Next v3 recommends
  `SU_M3_DEADLINE_CAPABILITY_WORK_PACKAGE`.
- At the target-only SU-M2/SU-M4 slices, active Grammar 1 and CLI Contract 3
  remained fixed and public Contract 4 activation was an explicit non-goal.
  SU-M5 later activated the accepted Grammar 1/2/3 and Contract 4 boundary
  atomically, and `0.3.0` published it.

## Loose governance assertion scope

### GOV-LOOSE-001: Prevent assertion carryover

Priority: P0

Status: Selected second stateless runtime warning (2026-07-30)

The accepted loose governance interface can correctly classify actual goal,
DAG, and ordinary-maintenance changes while a non-malicious caller still
carries one `--accepted-by-owner` spelling into unrelated later commands. The
[scope experiment](process/governance-assertion-scope-experiment.md) fixes the
next hypothesis without adding authentication or an approval artifact.

Acceptance:

- begin each candidate with an owner-assertion-free preview;
- omit owner assertions when governance is not applicable or the actor has
  direct authority;
- present the operation, target, affected scopes, required owners, source and
  candidate digests, and structural summary before a non-direct governed
  write;
- treat a matching loose assertion as belonging to that candidate only;
- never infer that a general work or release instruction confirms a later
  `dag advance`;
- pass the six `GOV-LOOSE-*` dogfooding cases before selecting any runtime
  interface change; and
- keep strict authentication, signatures, certificates, durable audit, and
  `GOV-AUTH-001` outside this experiment.

The controlled dogfooding run passed all six cases. A later objective review
selected the smallest runtime constraint supported by the original
observation: emit `PTGOV-103` when a valid candidate has
`applicable=false` and a non-empty `accepted_by_owner` set. This directly
detects the 18 ordinary-maintenance carryovers among the 29 observed
invocations while preserving default write authority and all versioned result
identities. Existing `--warnings-as-errors` may make the warning blocking.
The change does not add a CLI option, accepted-scope field, approval artifact,
or detection of reuse between two governed candidates.

A deeper classification of the same 10 governed invocations found five
previews and five persistent attempts: one pair for initial release-plan
construction and four pairs for distinct advances. Every governed preview
already carried the owner assertion. The selected second stateless constraint
therefore emits `PTGOV-104` when a valid candidate has `applicable=true`,
`intent=preview`, and a non-empty `accepted_by_owner` set. This detects all
five observed governed-preview carryovers without warning on the five
persistent attempts. Default preview behavior and persistent authority remain
unchanged; `--warnings-as-errors` may make the preview warning blocking while
retaining its candidate and decision.

The runtime still cannot distinguish a freshly confirmed persistent assertion
from cross-candidate reuse using one GovernanceDecision. Cross-candidate
state, accepted scopes, approval evidence, authentication, and new interface
fields remain outside this selected change.

## Strict approval authentication and certificates

### GOV-AUTH-001: Add opt-in strict approval

Priority: Unset (requires refinement)

Status: Proposed backlog (not scheduled)

The accepted Issue #4 governance contract deliberately treats actor and owner
confirmation values as caller assertions. Preserve that behavior as the
default loose approval mode, while designing an opt-in strict mode for projects
that require authenticated approval and verifiable change-approval
certificates. The `loose` and `strict` names describe the requested modes here;
their final DSL and interface spellings remain a normative design decision.

Proposed strict-mode inputs and behavior:

- Associate each strict principal with one compact, versioned strict-credential
  token in the DSL. The preferred representation is one random-looking ASCII
  string of approximately 40 to 50 characters that jointly binds password
  verification and the signature-verification identity. It is one
  user-attached value even when password verification and signature
  verification use separate internal layers.
- First evaluate whether that single token can safely contain all required
  public verification material. If the target length cannot carry the complete
  versioned verifier, salt, parameters, and signature-verification material,
  keep the one-string user surface by making the token an opaque
  collision-resistant identifier or cryptographic commitment to one
  tamper-protected credential record that contains both. Use separate
  user-attached strings only if the requirements and architecture review
  demonstrate that the unified representation is unsafe or impractical.
- Passwords and private signing keys must never occur in the `.pert` source.
  The short token is not itself a password, private key, signature, or
  sufficient proof. It authorizes no action unless the password verifier
  addressed by the token succeeds and the approval-certificate signature
  verifies against the signing identity bound by that same token. Neither
  result alone is strict approval.
- Salt each enrolled password verifier so that equal passwords do not normally
  produce equal stored values. Record the password-derivation algorithm,
  parameters, format version, and salt needed for deterministic verification;
  a fast or ambiguously truncated password hash is not an accepted verifier.
- Define decision-edge and signed change-approval-certificate semantics. A
  certificate must bind the approval to the exact pre-change source digest,
  candidate digest, affected governance scopes, approving actor and owner,
  policy version, and a unique request value. A displayed short fingerprint is
  an identifier for full verification material, not a substitute for signature
  verification.
- Add a durable approval-request lifecycle sufficient to distinguish at least
  pending, approved, rejected, expired, and consumed requests. Define
  concurrency, replay prevention, revocation, key rotation, password reset,
  recovery, retention, and audit behavior before selecting a storage adapter.
- Add a CLI read surface that lists unprocessed approvals and can filter the
  list by exact actor. Add an approval action that authenticates the actor with
  a password and invokes the signing identity bound by the actor's one
  strict-credential token to produce the signed approval certificate. Password
  input must use a non-echoing or otherwise explicitly protected secret-input
  path and must not appear in argv, JSON, diagnostics, logs, shell history, or
  project source.
- Keep preview and request creation distinct from persistence. A strict-mode
  governed write must fail closed until every required approval certificate is
  valid for the exact candidate and current source. Consuming approvals and
  persisting the candidate must have an atomic or recoverably idempotent
  contract.
- Keep decision edges distinct from Activity-on-Arrow task/gate dependencies
  and from resource requirements unless a later normative requirement
  explicitly gives them scheduling semantics.

Compatibility and trust-boundary requirements:

- Existing documents and omitted approval-mode metadata continue to use loose
  Issue #4 behavior. Strict approval is opt-in and must not become a
  prerequisite for completing the current `plans/governance.pert` workstream.
- Enabling, disabling, or downgrading strict mode, replacing a verifier, and
  rotating or revoking a verification key are themselves protected changes.
- The design must identify a root of trust outside attacker-controlled source,
  or state precisely why direct DSL editing and a `strict` to `loose` edit
  cannot be prevented. It must not claim strict authentication when all policy
  and verification material can be replaced in the same editable file.
- Password verification and approval-certificate signature verification may be
  separate internal operations, but the strict authorization decision is their
  conjunction under the same principal-bound token. Diagnostics may identify
  the failed layer without treating success in the other layer as authority. A
  password-derived value or short hash alone is not described as a digital
  signature.
- Loose and strict results, help, Guide content, and installed-package behavior
  expose the effective mode and never describe an unverified caller assertion
  as strict approval.

Acceptance:

- a legacy or mode-omitting plan retains byte-compatible loose behavior;
- the preferred strict enrollment adds exactly one random-looking, 40-to-50
  ASCII-character credential token to a principal and that token jointly binds
  the password verifier and signature-verification identity;
- changing either bound component, resolving the token to a different
  credential record, or combining components enrolled under different tokens
  invalidates strict approval;
- any fallback to separate user-attached strings is supported by an accepted
  finding that the unified target cannot satisfy the security or operational
  contract;
- independently salted verifier fixtures demonstrate that equal passwords do
  not normally produce equal stored verifier strings;
- strict-mode approval succeeds only when the actor's password verification and
  a valid signature over the exact approval-certificate payload both succeed
  under the same token; correct-password/invalid-signature and
  invalid-password/valid-signature cases both fail closed;
- candidate, source, scope, owner, policy, expiry, revocation, or request-value
  mismatch fails closed, and an approved request cannot be replayed;
- CLI text and JSON deterministically list all and actor-filtered pending
  approvals without exposing passwords, password verifiers, or private signing
  material;
- password entry is covered by tests that prove it is absent from argv,
  project source, normal output, diagnostics, and logs;
- direct, batch, advance, and any existing-document import write paths cannot
  bypass strict approval after it is enabled;
- focused source, cryptographic-adapter, lifecycle, CLI, concurrency,
  safe-write, downgrade, help, package, and installed-workflow tests pass; and
- the requirements, threat model, source contract, authority semantics,
  interface contract, normative examples, architecture decision, and
  independent PERT plan are accepted before runtime implementation.

Security design should be based on reviewed password-verifier and signature
standards, including
[NIST SP 800-63B-4](https://doi.org/10.6028/NIST.SP.800-63b-4),
[RFC 9106](https://www.rfc-editor.org/rfc/rfc9106), and
[RFC 8032](https://www.rfc-editor.org/rfc/rfc8032). This backlog item does not
select an algorithm, parameter set, source field, CLI spelling, storage
adapter, or release.

When selected, refine this item into an independent, design-first `.pert`
workstream sequenced after the loose owner-aware governance contract it
extends. Do not add its unresolved authentication, certificate, or durable
ledger semantics to an in-progress Issue #4 implementation slice.

## Independent post-beta work

`MULTI-001`, `LSP-001`, `VSIX-001`, `MCP-001`, `MIG-08`, Git integration,
`GOV-AUTH-001`, `ADV-001`, and `META-001` remain independent
workstreams. `ADV-001` is the refined, unscheduled read-only Git guard for
destructive advance writes. These items are not implicit prerequisites for an
accepted workstream unless a later requirements decision explicitly composes
them.
