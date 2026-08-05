# perttool

`perttool` is a local CLI for keeping PERT/CPM plans in reviewable text files.
It validates an Activity-on-Arrow plan, calculates precedence and
resource-constrained schedules, recommends the next task, and applies
source-preserving changes through preview-first commands.

Version `0.6.0` implements Grammar 5 and CLI Contract 6,
including explicit task work events, lifecycle commands, read-only Git
history, observed velocity, AnalysisResult v4, and NextResult v5. It adds
complete Draft 2020-12 artifacts for every active Contract 6 result and the
public OverrideDecision result, selectable full and outline schema views,
Git 2.54 UTC compatibility, and scope-bound human-readable confirmation
guidance. It warns when an owner-confirmation assertion is supplied for a
governance-not-applicable candidate and when a governed preview already
carries one. It also protects destructive in-place `dag advance` writes with
exact `HEAD` and stage-0 evidence, returns `Perttool.AdvanceResult.v1`, and
keeps preview, separate output, and written candidates repository-clean and
byte-identical. It remains available as the exact Contract 6 compatibility
pin `perttool@0.6.0`.
Beta releases may contain breaking CLI or schema changes.

Version `0.7.0` beta atomically activates Grammar 6 and CLI Contract 7
conditional plan assurance. It exposes 44 commands, 20 root schemas,
`Perttool.PlanAssuranceResult.v1`, assurance-aware Check/Project/Analysis/Next/
Mutation/Advance results, `Perttool.GovernanceDecision.v2`, and Mermaid
semantic profile 2. Its package and CLI identity is `0.7.0`. At its publication
boundary, this release does not move npm `latest` from Contract 6 `0.6.0`;
one separately authorized post-publication operation later made
`beta=latest=0.7.0`. These Contract 6 and Contract 7 releases require Node.js
22 or later.
Version `0.7.1` is a backward-compatible Contract 7 patch that corrects the
installed Guide, command Help examples, and diagnostic navigation. It retains
all 44 command paths, 20 root schemas, result and payload identities,
package-root exports, and authority policies. Its beta publication does not
move npm `latest`; one separately authorized post-publication operation later
made `beta=latest=0.7.1`. Version `0.7.0` remains the exact rollback pin.
The complete-schema Contract 6 artifact remains available by pinning `0.5.2`,
and the first machine-schema Contract 6 artifact remains available by pinning
`0.5.1`; Contract 5, Contract 4, and Contract 3 remain available by pinning
`0.4.0`, `0.3.0`, and `0.2.0`, respectively. npm has no maintained `alpha`
dist-tag; historical `0.1.0-alpha.2` remains available by exact pin.

## Run without installing

After beta publication, use `npx` for an occasional Contract 7 invocation and
select the version explicitly:

```sh
npx --yes --package=perttool@0.7.1 -- perttool --version
npx --yes --package=perttool@0.7.1 -- perttool document check PLAN.pert
npx --yes --package=perttool@0.7.1 -- perttool dag next PLAN.pert --format json
npx --yes --package=perttool@0.7.1 -- perttool plan-assurance show PLAN.pert --format json
```

The equivalent explicit `npm exec` form is:

```sh
npm exec --yes --package=perttool@0.7.1 -- perttool --version
npm exec --yes --package=perttool@0.7.1 -- perttool document check PLAN.pert
npm exec --yes --package=perttool@0.7.1 -- perttool dag analyze PLAN.pert
npm exec --yes --package=perttool@0.7.1 -- perttool plan-assurance hash PLAN.pert WORK --kind contract
```

`npx` and `npm exec` may download the selected package version into the npm
cache. Pinning `0.6.0` selects Contract 6 and omits Grammar 6 assurance;
`0.4.0` selects Contract 5, `0.3.0` selects Contract 4, and `0.2.0` selects
Contract 3.

## Install

Install the corrected Contract 7 CLI globally by exact version when it is used
regularly:

```sh
npm install --global perttool@0.7.1
perttool --version
```

The `0.7.1` release procedure published only npm `beta` and initially left the
independently managed `latest` tag at `0.7.0`. A separately authorized later
operation made `beta=latest=0.7.1`; both an unqualified installation and the
exact `0.7.1` pin now select the corrected Guide and Help behavior.
Contract 6 remains available by exact pinning `perttool@0.6.0`; the pre-schema
Contract 6 artifact remains available as
`perttool@0.5.0`. Contract 5,
Contract 4, and Contract 3 remain available as exact pins
`perttool@0.4.0`, `perttool@0.3.0`, and `perttool@0.2.0`. The retired alpha
preview remains installable only as the exact pin
`perttool@0.1.0-alpha.2`.

## Library subpaths in the current source

The unreleased source package provides two additive library boundaries:

```js
import {
  analyzeDocumentSnapshot,
  createDocumentSession,
  createDocumentSnapshot,
  documentOffsetToPosition,
  documentPositionToOffset,
  formatDocument,
  getGuide,
  parseDocument,
  validateDocument,
} from "perttool/core";
import {
  getJsonSchemaCatalog,
  readDocumentFile,
} from "perttool/node";
```

`perttool/core` is the closed platform-neutral Grammar 6 source, graph,
exact-arithmetic, diagnostic, Help, Guide, projection, and document-session
surface. Immutable snapshots and sessions bind exact URI, generation, version,
text digest, parse/semantic state, UTF-16 positions, analysis options, and
cancellation-safe caches without filesystem or editor access. The caller
supplies the SHA-256 function. Its runtime closure has no Node builtin or
external package. `perttool/node` exposes the same 121 runtime values as the
existing `perttool` root, including file, schema, Git, hashing, and safe-write
APIs that still require Node.js 22 or later. Bundled JSON artifacts remain
available through `perttool/schemas/<schema-id>.schema.json`.

These subpaths describe the current checkout and are not present in already
published `0.7.1`. A later release decision is required before registry
consumers can use them. See the
[Shared Library Boundary](docs/specs/shared-library.md).
The protocol-neutral state contract is the
[Document Session Core](docs/specs/document-session.md).

## Plan files

A `.pert` file is the source of truth and is intended to remain directly
readable. This temporal plan has one one-day task:

```text
project EXAMPLE:
  version 2
  title "Example plan"
  as_of 2026-07-26
  duration_unit day
  finish DONE

milestone NOW:
  title "Current frontier"
  state reached

milestone DONE:
  title "Done"
  deadline 2026-07-28

task WORK NOW -> DONE:
  title "Do the work"
  duration 1d
  not_before 2026-07-26
  deadline 2026-07-27
```

Save it as `PLAN.pert`, then inspect it with:

```sh
perttool document check PLAN.pert
perttool project show PLAN.pert
perttool dag analyze PLAN.pert
perttool dag next PLAN.pert --format json
```

Task duration can use deterministic `day`, `hour`, or relative `point` units.
Point plans declare a project-wide velocity such as `20p/10d`. Analysis keeps
the exact point result and reports the time conversion separately as a velocity
forecast. Grammar version 3 also accepts an exact Fraction such as `1/3d`;
versions 1 and 2 continue to accept Decimal duration tokens. Grammar version 5
adds explicit task-owned work events and the `suspended` lifecycle state.
Grammar version 6 adds conditional plan assurance records and the separate
planning-dependency modes `both`, `execution_only`, and `planning_only`.

## Maintain a plan through the CLI

Read the file for its complete human-facing state. Use CLI maintenance commands
so that each candidate is parsed and semantically checked before it can be
written. To bootstrap a plan without hand-authoring syntax, preview the
smallest valid document and then create a new file exclusively:

```sh
perttool project init EXAMPLE \
  --title "Example plan" \
  --duration-unit day \
  --initial-milestone NOW \
  --initial-milestone-title "Current frontier" \
  --finish NOW

perttool project init EXAMPLE \
  --title "Example plan" \
  --duration-unit day \
  --initial-milestone NOW \
  --initial-milestone-title "Current frontier" \
  --finish NOW \
  --out PLAN.pert
```

For an existing plan:

```sh
# Preview a source-preserving change.
perttool task set PLAN.pert WORK --status active --diff

# Obtain the current digest for optimistic locking.
perttool project show PLAN.pert --format json

# Apply the reviewed change atomically.
perttool task set PLAN.pert WORK \
  --status active \
  --not-before 2026-07-26 \
  --deadline 2026-07-27 \
  --write \
  --expect-digest 'sha256:...'

# Finish a task, inspect the new frontier, then remove completed history.
perttool task finish PLAN.pert WORK --diff
perttool dag next PLAN.pert --format json
perttool dag advance PLAN.pert --diff
perttool dag advance PLAN.pert \
  --write \
  --expect-digest 'sha256:...'
```

All formatter and mutation commands preview by default. `--write` replaces the
input through the safe-write path, while `--out` exclusively creates a new
file. A changed in-place `dag advance` additionally verifies removed or
replaced entity ranges against the target path in Git `HEAD` and the stage-0
index. Dirty ranges retained by the candidate are allowed; uncommitted
destructive overlap or unavailable proof returns `PTADV-101` without writing.
`Perttool.AdvanceResult.v2.history_guard` reports the status, modification
time, byte sizes, diff counts, and affected IDs before supplemental digests.
If the source, `HEAD`, or stage-0 index changes after assessment, `PTADV-102`
returns exit 5 without writing.
The exceptional `--force-history-loss` option bypasses only that initial
history block for the exact in-place request, emits `PTADV-103`, and does not
bypass governance, warnings-as-errors, expected digests, source/`HEAD`/index
rechecks, or atomic-write validation.
For a terminal sequence of removed tasks and task-owned work events, the same
candidate also removes only its newly orphaned blank separator prefixes. The
preview, separate output, and in-place write therefore remain byte-identical
and do not require a formatter or a second whitespace edit before
`git diff --check`.

Gate maintenance uses the same base controls:

```sh
perttool gate add PLAN.pert APPROVAL NOW DONE \
  --reason "Approval required" \
  --diff
```

Use `batch apply` when several changes must become valid atomically:

```sh
perttool batch apply PLAN.pert --request changes.json --diff
perttool batch apply PLAN.pert \
  --request changes.json \
  --write \
  --expect-digest 'sha256:...'
```

### Owner-aware governance

Moving from `0.3.0` Contract 4 to `0.4.0` Contract 5 changes every JSON
envelope to `cli_contract_version=5`. Project metadata changes from
`Perttool.ProjectResult.v2` to `Perttool.ProjectResult.v3`; mutation and
advance change from `Perttool.MutationResult.v1` to
`Perttool.MutationResult.v2` and include a
`Perttool.GovernanceDecision.v1`. Consumers must reject unknown identities
rather than treating the new fields as optional.

Grammar 4 adds declared goal/DAG owners and delegates. Persistent goal or DAG
changes require `--actor`; an effective owner or delegate has direct
authority, while another actor supplies repeatable `--accepted-by-owner`
caller assertions for every affected effective owner. The digest-bound
pre-change document determines owners and delegates, and an atomic batch must
satisfy every affected scope. These assertions are not authentication,
verified identity, signatures, or a durable approval audit.

Treat each `--accepted-by-owner` value as a single-candidate, scope-bound
caller assertion rather than workstream or session authority. First preview
without it. Omit it when the result reports `governance.applicable=false`.
Before a non-direct governed write, identify the operation, affected scopes,
required owners, available modification time, byte size before and after, diff
counts, and semantic candidate summary. Keep source and candidate digests as
supplemental machine identity rather than the primary human explanation;
never copy the assertion to later maintenance, a changed candidate, or the
next `dag advance`. See the
[loose assertion scope experiment](docs/process/governance-assertion-scope-experiment.md).
If a valid candidate is not governance-applicable but still receives an owner
assertion, `PTGOV-103` makes that likely boilerplate visible. It is a warning
and does not change default write authority; `--warnings-as-errors` prevents
the write. If a governed preview already carries an owner assertion,
`PTGOV-104` directs the caller back to an assertion-free first preview. Its
default preview still succeeds; `--warnings-as-errors` exits 1 while retaining
the candidate and governance decision. Persistent governed authority is
unchanged.

Contract 5 previews may still omit actor and owner confirmation. A Contract 4
runtime fails closed on Grammar 4 and governance options; there is no
`--cli-contract 4` switch, compatibility alias, or environment toggle. Pin
`perttool@0.3.0` when a consumer is not ready to migrate. See the
[Contract 4-to-5 migration guide](docs/process/cli-contract-5-migration.md)
for the complete boundary.

For example, preview and then persist a DAG change as its effective owner:

```sh
perttool gate add PLAN.pert APPROVAL NOW DONE \
  --reason "Approval required" \
  --diff
perttool gate add PLAN.pert APPROVAL NOW DONE \
  --reason "Approval required" \
  --actor user \
  --write \
  --expect-digest 'sha256:...'
```

Generated Contract 6 source projects carry this maintenance warning:

```pert
# Existing .pert plans should normally be maintained through perttool commands; direct DSL editing bypasses goal/DAG owner-confirmation checks.
```

The warning is guidance, not technical prevention. A text editor, shell
command, or other program can bypass the tool-mediated check; Git and human
review remain external controls.

Use the dedicated migration route for exact whole-document conversion between
Point and time units. Preview before writing; the result inventories every
converted field and reports grammar upgrades and reversibility:

```sh
perttool project migrate-unit PLAN.pert --to-unit day --diff
perttool project migrate-unit PLAN.pert \
  --to-unit day \
  --write \
  --expect-digest 'sha256:...'

# A time-to-Point conversion requires an explicit relationship when needed.
perttool project migrate-unit PLAN.pert \
  --to-unit point \
  --replacement-velocity 20p/10d \
  --diff
```

Migration is not a `batch apply` member. Re-read and reanalyze the written
candidate before making a separate mutation.

### Task actuals and Git history

Grammar 5 records each lifecycle transition as a task state change and a
task-owned work event in one preview-first candidate. Event time is always an
explicit caller input; perttool does not substitute the system clock or Git
commit time.

```sh
perttool task start PLAN.pert WORK \
  --at 2026-07-29T09:00:00+09:00 --diff
perttool task suspend PLAN.pert WORK \
  --at 2026-07-29T11:00:00+09:00 --reason "review" --diff
perttool task resume PLAN.pert WORK \
  --at 2026-07-29T12:00:00+09:00 --diff
perttool task finish PLAN.pert WORK \
  --at 2026-07-29T15:00:00+09:00 \
  --active-time 5 --effort 6 --diff
```

Use the ordinary governance, `--write`, and `--expect-digest` controls after
reviewing each candidate. `--active-time` is hours and `--effort` is
person-hours; suffix-free CLI values are normalized to `h` and `ph`.

History is a read-only first-parent Git reconstruction. It distinguishes
explicit actual event time from Git-recorded transition time and never changes
Git or declared project velocity:

```sh
perttool project history PLAN.pert --task WORK --format json
perttool project observe-velocity PLAN.pert \
  --task WORK --evidence declared --format json
```

Observed candidates are evidence, not automatic project metadata changes.
Adoption, if desired, is a separate reviewed `project set --velocity` write.
See the [Contract 5-to-6 migration
guide](docs/process/cli-contract-6-migration.md) for schema and compatibility
details.

### Conditional plan assurance

Assurance is opt-in. Initial sealing upgrades the candidate to Grammar 6 and
records reviewed task contracts and recursive planning bases:

```sh
perttool plan-assurance seal PLAN.pert \
  --reason "Initial reviewed planning baseline" --diff
perttool plan-assurance show PLAN.pert --format json
perttool plan-assurance hash PLAN.pert WORK --kind computed-basis
```

The hash command writes exactly one `sha256:` digest plus LF on text success;
it does not edit or accept a seal. Use `plan-dependency` to qualify the default
execution-and-planning relation, or to add a planning-only relation:

```sh
perttool plan-dependency set PLAN.pert REL_A_B \
  --mode execution-only --reason "Execution order only" --diff
perttool plan-dependency add PLAN.pert REL_C_D C D \
  --mode planning-only --reason "D consumes C planning output" --diff
```

After reviewing a reported affected closure, use a separate governed
`plan-assurance reseal` candidate. Completed work needs an explicit
`task-outcome` record; completion status, Git history, and actual duration do
not imply outcome conformance. `dag next` preserves raw ranking and withholds
new-start authority from unsealed, review-required, or unavailable plans.

## Command map

| Goal | Command |
| --- | --- |
| Discover commands | `perttool help [resource [action]]` |
| Discover or read JSON Schemas | `perttool schema [schema-id]` |
| Read domain guidance | `perttool guide [topic [subtopic]]` |
| Validate a document | `perttool document check <file>` |
| Canonically format it | `perttool document format <file>` |
| Initialize a project | `perttool project init ...` |
| Read project metadata | `perttool project show <file>` |
| Reconstruct task actuals | `perttool project history <file> ...` |
| Observe project performance | `perttool project observe-velocity <file> ...` |
| Change project metadata | `perttool project set <file> ...` |
| Migrate project units exactly | `perttool project migrate-unit <file> ...` |
| Analyze schedules | `perttool dag analyze <file>` |
| Select next work | `perttool dag next <file>` |
| Remove completed history | `perttool dag advance <file>` |
| Inspect plan assurance | `perttool plan-assurance show|hash <file> ...` |
| Seal or reseal reviewed plans | `perttool plan-assurance seal|reseal <file> ...` |
| Maintain planning dependencies | `perttool plan-dependency add|set|remove` |
| Maintain task outcomes | `perttool task-outcome add|set|remove` |
| Export or import Mermaid | `perttool dag render`, `perttool dag import` |
| Maintain tasks | `perttool task add|set|remove|start|suspend|resume|finish` |
| Maintain gates | `perttool gate add|set|remove` |
| Maintain milestones | `perttool milestone add|set|remove` |
| Maintain resources | `perttool resource add|set|remove` |
| Apply an atomic batch | `perttool batch apply` |
| Read coding-agent guidance | `perttool agent help` |

Run `perttool --help` for the text command catalog. `help` is the complete
command contract for humans and machine consumers, while `guide` explains
domain concepts. Both run without a document:

```sh
perttool task set --help
perttool help dag next --format json
perttool schema --format json
perttool schema Perttool.NextResult.v6 --format json
perttool schema Perttool.NextResult.v6 --view outline --format json
perttool guide editing --level detail --format json
```

### JSON Schema artifacts

`perttool schema --format json` returns the complete result-schema catalog.
Supplying a schema identity returns its Draft 2020-12 artifact in the
`schema` field of `Perttool.SchemaResult.v1`:

```sh
perttool schema Perttool.CheckResult.v4 --format json
```

The default and `--view full` return the complete artifact. For a shorter
outer shape, `--view outline` replaces complex nested records with absolute
references to the complete bundled artifact. Pass one local, relative, or
copied absolute reference back with `--ref` to display that internal layer:

```sh
perttool schema Perttool.NextResult.v6 --view outline --format json
perttool schema Perttool.NextResult.v6 --view outline \
  --ref '#/$defs/recommendation' --format json
```

Packed installations also expose each artifact at
`perttool/schemas/<schema-id>.schema.json`; relative references resolve
against the bundled `Perttool.Common.v1.schema.json`. The stable `$id` is an
identifier only: validation does not require network access. Consumers must
select compatibility from each result's `schema_version`, not from
`tool_version`. See the
[JSON Schema Artifact Contract](docs/specs/json-schema.md) for the complete
20-root inventory and versioning rules.

## LLM and automation use

Use `--format json` for machine consumers. Versions `0.7.0` and `0.7.1` require
`cli_contract_version == 7`. Published `0.6.0`, `0.5.5`, `0.5.4`, `0.5.3`,
`0.5.2`, `0.5.1`, and `0.5.0` consumers must check
`cli_contract_version == 6`;
consumers pinned to `0.4.0`
must continue to require Contract 5, and consumers pinned to `0.3.0` must
require Contract 4. Bundled machine-readable result artifacts require
`0.5.1`; complete nested records and outline/detail views require `0.5.2`.
Scope-bound, human-readable loose owner-confirmation guidance requires
`0.5.3`.
Runtime `PTGOV-103` visibility for unused owner assertions requires `0.5.4`.
Runtime `PTGOV-104` visibility for assertions on governed previews requires
`0.5.5`.
`Perttool.AdvanceResult.v1`, history-safety model 1, and the
repository-clean advance candidate require `0.6.0`; see the
[`0.5.5` to `0.6.0` migration](docs/process/0.5.5-to-0.6.0-migration.md).
Version `0.7.0` changes to Grammar 6, CLI Contract 7, and
assurance-aware result identities; see the
[`0.6.0` to `0.7.0` migration](docs/process/0.6.0-to-0.7.0-migration.md).
In every case, check the result-specific `schema_version` before reading the
rest of a result.
A complete, known, non-truncated `Perttool.NextResult.v6` with policy
`recommendation_v1_plus_release_gate_plus_plan_assurance_v1` is required for
the current source. Start only task IDs in
`temporal.authority.startable_recommended_task_ids`; do not infer start
authority from the raw recommended set, the text summary, or `ready` alone.
Suspended tasks are reported separately and require an explicit `task resume`;
they are not new-start recommendations.

Mutation JSON returns the candidate text, unified diff, UTF-16 text edits,
source digest, updated digest, diagnostics, and write result in one envelope.
Direct, lifecycle, batch, and assurance mutations use
`Perttool.MutationResult.v4`; `dag advance` uses
`Perttool.AdvanceResult.v2`.
Unknown schema versions, incomplete recommendation traces, `PTREC-*`
diagnostics, and future or unavailable temporal eligibility must fail closed.

## Documentation

- [Temporal and Unit Interface Contract (CLI Contract 4)](docs/specs/temporal-unit-interface.md)
- [Owner-Aware Governance Interface Contract (CLI Contract 5)](docs/specs/governance-interface.md)
- [Project Actuals and Git History Contract (CLI Contract 6)](docs/specs/project-actuals.md)
- [Advance History Safety Contract (ADV-001 target)](docs/specs/advance-history-safety.md)
- [Advance History Safety source acceptance](docs/process/advance-history-acceptance.md)
- [Conditional Plan Assurance Contract (active Grammar 6 / CLI Contract 7 source)](docs/specs/plan-assurance.md)
- [Conditional Plan Assurance Interface Contract](docs/specs/plan-assurance-interface.md)
- [Conditional Plan Assurance public-contract acceptance](docs/process/plan-assurance-public-contract-acceptance.md)
- [`0.6.0` to `0.7.0` migration](docs/process/0.6.0-to-0.7.0-migration.md)
- [`v0.7.0` release procedure](docs/process/0.7.0-release.md)
- [`v0.7.1` Help and Guide consistency patch procedure](docs/process/0.7.1-release.md)
- [Conditional Plan Assurance interface acceptance](docs/process/plan-assurance-interface-acceptance.md)
- [Shared Library Boundary](docs/specs/shared-library.md)
- [Editor Protocol Contract](docs/specs/editor-protocol.md)
- [Document Session Core](docs/specs/document-session.md)
- [Conditional Plan Assurance internal hash Core acceptance](docs/process/plan-assurance-hash-core-acceptance.md)
- [Conditional Plan Assurance internal source Core acceptance](docs/process/plan-assurance-source-core-acceptance.md)
- [Conditional Plan Assurance internal mutation Core acceptance](docs/process/plan-assurance-mutation-core-acceptance.md)
- [Conditional Plan Assurance internal authority Core acceptance](docs/process/plan-assurance-authority-core-acceptance.md)
- [Conditional Plan Assurance internal advance contraction acceptance](docs/process/plan-assurance-advance-contraction-acceptance.md)
- [Conditional Plan Assurance internal compatibility acceptance](docs/process/plan-assurance-compatibility-acceptance.md)
- [Conditional Plan Assurance internal hash inspection acceptance](docs/process/plan-assurance-hash-inspection-acceptance.md)
- [Conditional Plan Assurance design review](docs/process/plan-assurance-design-review.md)
- [Conditional Plan Assurance implementation plan](plans/plan-assurance.pert)
- [Help and Guide consistency correction](docs/specs/help-guide-consistency.md)
- [Help and Guide consistency implementation plan](plans/help-guide-consistency.pert)
- [`v0.7.1` release plan](plans/release-0.7.1.pert)
- [JSON Schema Artifact Contract](docs/specs/json-schema.md)
- [JSON Schema source acceptance](docs/process/json-schema-acceptance.md)
- [Contract 5-to-6 migration](docs/process/cli-contract-6-migration.md)
- [Contract 4-to-5 migration](docs/process/cli-contract-5-migration.md)
- [Issue #4 governance implementation acceptance](docs/process/governance-acceptance.md)
- [CLI Contract 3 compatibility baseline](docs/specs/cli-contract-3.md)
- [DSL grammar](docs/specs/dsl-grammar.md)
- [Graph semantics](docs/specs/graph-semantics.md)
- [Analysis semantics](docs/specs/analysis.md)
- [Mutation semantics](docs/specs/mutation.md)
- [Recommendation semantics](docs/specs/recommendation.md)
- [Examples](docs/examples/README.md)
- [Developer guide](docs/development.md)
- [Product backlog](docs/backlog.md)

## Security and license

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
perttool is released under the [MIT License](LICENSE). See
[CHANGELOG.md](CHANGELOG.md) for release changes and known limitations.
