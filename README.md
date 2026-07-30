# perttool

`perttool` is a local CLI for keeping PERT/CPM plans in reviewable text files.
It validates an Activity-on-Arrow plan, calculates precedence and
resource-constrained schedules, recommends the next task, and applies
source-preserving changes through preview-first commands.

Version `0.5.2` beta implements Grammar 5 and CLI Contract 6,
including explicit task work events, lifecycle commands, read-only Git
history, observed velocity, AnalysisResult v4, and NextResult v5. It adds
complete Draft 2020-12 artifacts for every active Contract 6 result and the
public OverrideDecision result, selectable full and outline schema views,
and Git 2.54 UTC compatibility. npm `beta` resolves to `0.5.2`; `latest`
remains on the separately accepted `0.5.1`. Beta releases may contain
breaking CLI or schema changes. Version `0.5.2` requires Node.js 22 or later.
The first machine-schema Contract 6 artifact remains available by pinning
`0.5.1`; Contract 5, Contract 4, and Contract 3 remain available by pinning
`0.4.0`, `0.3.0`, and `0.2.0`, respectively. npm has no maintained `alpha`
dist-tag; historical `0.1.0-alpha.2` remains available by exact pin.

## Run without installing

Use `npx` for an occasional invocation and select Contract 6 explicitly:

```sh
npx --yes --package=perttool@0.5.2 -- perttool --version
npx --yes --package=perttool@0.5.2 -- perttool document check PLAN.pert
npx --yes --package=perttool@0.5.2 -- perttool dag next PLAN.pert --format json
npx --yes --package=perttool@0.5.2 -- perttool project history PLAN.pert --format json
```

The equivalent explicit `npm exec` form is:

```sh
npm exec --yes --package=perttool@0.5.2 -- perttool --version
npm exec --yes --package=perttool@0.5.2 -- perttool document check PLAN.pert
npm exec --yes --package=perttool@0.5.2 -- perttool dag analyze PLAN.pert
npm exec --yes --package=perttool@0.5.2 -- perttool project history PLAN.pert --format json
```

`npx` and `npm exec` may download the selected package version into the npm
cache. Pinning `0.4.0` selects Contract 5 and therefore omits Grammar 5
lifecycle and history; `0.3.0` selects Contract 4, and `0.2.0` selects
Contract 3.

## Install

Install the CLI globally when it is used regularly:

```sh
npm install --global perttool
perttool --version
```

npm `beta` resolves to Contract 6 `0.5.2`; `latest` remains on accepted
Contract 6 `0.5.1`. The pre-schema Contract 6 artifact remains available as
`perttool@0.5.0`; Contract 5,
Contract 4, and Contract 3 remain available as exact pins
`perttool@0.4.0`, `perttool@0.3.0`, and `perttool@0.2.0`. The retired alpha
preview remains installable only as the exact pin
`perttool@0.1.0-alpha.2`.

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
```

All formatter and mutation commands preview by default. `--write` replaces the
input through the safe-write path, while `--out` exclusively creates a new
file. Gate maintenance uses the same controls:

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
perttool schema Perttool.NextResult.v5 --format json
perttool schema Perttool.NextResult.v5 --view outline --format json
perttool guide editing --level detail --format json
```

### JSON Schema artifacts

`perttool schema --format json` returns the complete result-schema catalog.
Supplying a schema identity returns its Draft 2020-12 artifact in the
`schema` field of `Perttool.SchemaResult.v1`:

```sh
perttool schema Perttool.CheckResult.v3 --format json
```

The default and `--view full` return the complete artifact. For a shorter
outer shape, `--view outline` replaces complex nested records with absolute
references to the complete bundled artifact. Pass one local, relative, or
copied absolute reference back with `--ref` to display that internal layer:

```sh
perttool schema Perttool.NextResult.v5 --view outline --format json
perttool schema Perttool.NextResult.v5 --view outline \
  --ref '#/$defs/recommendation' --format json
```

Packed installations also expose each artifact at
`perttool/schemas/<schema-id>.schema.json`; relative references resolve
against the bundled `Perttool.Common.v1.schema.json`. The stable `$id` is an
identifier only: validation does not require network access. Consumers must
select compatibility from each result's `schema_version`, not from
`tool_version`. See the
[JSON Schema Artifact Contract](docs/specs/json-schema.md) for the complete
18-result inventory and versioning rules.

## LLM and automation use

Use `--format json` for machine consumers. `0.5.2`, `0.5.1`, and `0.5.0`
consumers must check `cli_contract_version == 6`; consumers pinned to `0.4.0`
must continue to require Contract 5, and consumers pinned to `0.3.0` must
require Contract 4. Bundled machine-readable result artifacts require
`0.5.1`; complete nested records and outline/detail views require `0.5.2`.
In every case, check the result-specific `schema_version` before reading the
rest of a result.
A complete, known, non-truncated `Perttool.NextResult.v5` with temporal policy
`recommendation_v1_plus_release_gate` is required. Start only task IDs in
`temporal.authority.startable_recommended_task_ids`; do not infer start
authority from the raw recommended set, the text summary, or `ready` alone.
Suspended tasks are reported separately and require an explicit `task resume`;
they are not new-start recommendations.

Mutation JSON returns the candidate text, unified diff, UTF-16 text edits,
source digest, updated digest, diagnostics, and write result in one envelope.
Unknown schema versions, incomplete recommendation traces, `PTREC-*`
diagnostics, and future or unavailable temporal eligibility must fail closed.

## Documentation

- [Temporal and Unit Interface Contract (CLI Contract 4)](docs/specs/temporal-unit-interface.md)
- [Owner-Aware Governance Interface Contract (CLI Contract 5)](docs/specs/governance-interface.md)
- [Project Actuals and Git History Contract (CLI Contract 6)](docs/specs/project-actuals.md)
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
