# Product backlog

- Status: Active
- Updated: 2026-07-24

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

## Independent post-beta work

Issue #3 (backlog hierarchy and multi-plan composition), the LSP server, the
VSIX, the MCP server, human override apply/audit, and Git integration remain
independent workstreams. They are not prerequisites for the CLI/help reset
unless a later requirements decision explicitly composes them.
