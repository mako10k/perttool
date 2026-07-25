# Product backlog

- Status: Active
- Updated: 2026-07-25

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

Status: Refined backlog (not scheduled)

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

The estimates are provisional and do not create task state. When this backlog
item is selected, promote the four slices into one independent detail plan
rather than adding them to the scheduling-and-units workstream. The contract
slice must first resolve the current Contract 3 no-Git boundary and decide
whether its read-only adapter is shared with, sequenced after, or explicitly
independent from MIG-08. Runtime implementation is not accepted until that
architecture decision is normative.

## Scheduling metadata and unit migration

### TIME-001: Add temporal properties and deadline-aware capabilities

Priority: P1

Status: In progress (`SU-M1` contract)

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
- normative examples and installed-package file-first tests cover date and
  date-time boundaries, offsets, invalid calendar values, and deterministic
  output.

### UNIT-001: Design safe point and time-unit migration

Priority: P1

Status: In progress (`SU-M1` contract)

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
- values that cannot be represented exactly in the DSL have an explicit,
  fail-closed precision or rounding policy; no displayed decimal is reused as
  conversion input;
- preview text, structured JSON, and a deterministic unified diff identify
  every changed value, while write and output modes remain atomic,
  source-preserving, race-safe, and fully revalidated;
- no-op, repeated, and exact round-trip migrations have defined behavior, and
  diagnostics explain when reversibility cannot be guaranteed;
- command discovery, help, guide content, README examples, batch interaction,
  and installed-package tests cover both `point -> day|hour` and
  `day|hour -> point`, including incompatible velocity and non-representable
  result cases.

### Refinement and delivery milestones

`TIME-001` and `UNIT-001` form one coordinated workstream because unit
migration must inventory any duration-bearing fields accepted by the temporal
contract. Absolute dates and date-times are not converted merely because the
project duration unit changes.

| ID | Milestone | Exit criteria | Backlog coverage |
| --- | --- | --- | --- |
| `SU-M0` | Backlog refined | Scope, non-goals, milestone boundaries, and macro/detail tracking rules are recorded. | `TIME-001`, `UNIT-001` |
| `SU-M1` | Temporal and migration contract accepted | Requirements, normative specifications, interface projections, examples, compatibility policy, and an acceptance review define temporal semantics, deadline-derived behavior, and exact unit migration. | `TIME-001`, `UNIT-001` |
| `SU-M2` | Temporal property surface accepted | The accepted properties are parsed, validated, formatted, mutated, documented, and exposed symmetrically through text, JSON, help, guide, and file-first package workflows. | `TIME-001` |
| `SU-M3` | Deadline-aware capabilities accepted | Projected dates and accepted feasibility, margin, lateness, overdue, or risk capabilities work across precedence and heuristic resource results, with explicit recommendation-version behavior. | `TIME-001` |
| `SU-M4` | Unit migration accepted | Preview-first and atomic source migration covers every base-unit-bearing value in both directions, with exactness, diagnostics, idempotence, and installed-package acceptance. | `UNIT-001` |
| `SU-M5` | Integrated workstream accepted | Cross-feature regression, documentation, self-use, link, and package gates pass, and release scope is decided separately. | `TIME-001`, `UNIT-001` |

Progress is tracked at two levels:

- [`plans/scheduling-units.pert`](../plans/scheduling-units.pert) is the
  milestone-level roadmap. Its work-package estimates after `SU-M1` are
  provisional and are re-estimated when the preceding contract or milestone is
  accepted.
- [`plans/scheduling-units-m1.pert`](../plans/scheduling-units-m1.pert) tracks
  only the detailed work required to reach `SU-M1`. It does not duplicate
  completion state for later milestones.
- Select the milestone work package from a fresh, complete macro `dag next`
  result, then select daily work from the corresponding milestone-detail plan.
  When a detail plan reaches its finish, roll up that result once to the macro,
  reanalyze, and create the next milestone-detail plan from the accepted
  contract.

Current SU-M1 progress:

- `TEMPORAL_REQUIREMENTS`, `CALENDAR_SEMANTICS`, and `DEADLINE_SEMANTICS` are
  complete and advanced. The accepted deadline contract is
  [`perttool.deadline-evaluation` version 1](specs/temporal-deadline.md).
- The accepted calendar contract is
  [`perttool.calendar-projection` version 1](specs/temporal-calendar.md).
- `UNIT_MIGRATION_SEMANTICS` is complete and retained in the committed
  pre-advance snapshot. Its accepted contract is
  [`perttool.unit-migration` version 1](specs/unit-migration.md).
- Fresh complete `NextResult.v3` recommends `INTERFACE_PROJECTION_CONTRACT`.

## Independent post-beta work

Issue #3 (backlog hierarchy and multi-plan composition), the LSP server, the
VSIX, the MCP server, human override apply/audit, and Git integration remain
independent workstreams. `ADV-001` is the refined, unscheduled read-only Git
guard for destructive advance writes; it is not yet a Contract 3 feature.
These items are not prerequisites for the CLI/help reset unless a later
requirements decision explicitly composes them.
