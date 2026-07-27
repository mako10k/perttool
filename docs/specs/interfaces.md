# perttool CLI Interface Specification

- Document status: Superseded command contract; retained payload reference
- Interface version: 2
- CLI contract version: 2
- Created: 2026-07-21
- Updated: 2026-07-24
- Requirements: [../requirements.md](../requirements.md)
- Grammar specification: [dsl-grammar.md](dsl-grammar.md)
- Graph semantics: [graph-semantics.md](graph-semantics.md)
- Analysis specification: [analysis.md](analysis.md)
- Mutation semantics: [mutation.md](mutation.md)
- Mermaid profile: [mermaid-profile.md](mermaid-profile.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Recommendation reasons: [recommendation-reasons.md](recommendation-reasons.md)
- Recommendation explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Future recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Future AI Agent Guidance interface: [agent-guidance.md](agent-guidance.md)
- Related basic design: [../basic-design.md](../basic-design.md)
- Active CLI contract: [cli-contract-3.md](cli-contract-3.md)
- Future temporal/unit interface: [temporal-unit-interface.md](temporal-unit-interface.md)
- Future governance interface: [governance-interface.md](governance-interface.md)

## 1. Purpose and MVP Boundary

This is the normative specification that fixes the perttool MVP CLI commands, options, standard input/output, exit codes, text output, and CLI JSON results.

This document records the superseded CLI Contract 2 command surface and remains
normative only where [CLI Contract 3](cli-contract-3.md) explicitly preserves
its result payload, stream, exit, or domain meaning. Contract 3 is the active
command and JSON-envelope contract in the current source. The published
`0.1.0` artifact still implements this Contract 2 surface.

The primary MVP interface is the local CLI. AI agents also use the CLI's `--format json`, rather than MCP, to perform checks, analysis, next-task selection, and preview mutations.

MCP, LSP, and VSIX/editor adapters are post-MVP; this document does not define tool names, action schemas, transports, or server startup commands for them. The MVP implementation MUST NOT add MCP SDK, LSP transport, or VS Code extension dependencies.

## 2. Normative Precedence and Exclusions

Resolve inconsistencies in the following order:

1. Must requirements and MVP boundary in `docs/requirements.md`
2. The syntax contract in the [DSL Grammar Specification](dsl-grammar.md)
3. The graph/state contract in the [Graph Semantics Specification](graph-semantics.md)
4. The numeric and schedule contract in the [Analysis Specification](analysis.md)
5. The CLI and serialization contract in this document
6. `docs/basic-design.md` and sample/help output

Out of scope for this document:

- Supported Node.js versions, package managers, and distribution package names
- Shell completion, GUI, TUI, daemons, and network APIs
- Wire contracts for MCP, LSP, VSIX, or editors
- Internal record schema for Mermaid lossless metadata
- Calendars, exact resource solvers, and target-duration completion probability

## 3. CLI Dispatch and Common Rules

### 3.1 Top-level grammar

```text
perttool --version
perttool --help
perttool <resource> <action> [operands] [options]
perttool <resource> <action> --help
```

MVP resources are `dsl`, `project`, `dag`, `task`, `milestone`, and `resource`. The first beta adds read-only `agent help` in accordance with the [AI Agent Guidance Registry Specification](agent-guidance.md). Resource names, action names, and option names are case-sensitive.

Rules:

- An unknown resource, action, option, or an extra operand is a usage error.
- Long-option prefix abbreviation is not allowed.
- Both `--name value` and `--name=value` are accepted.
- Boolean options do not take a value.
- Option meaning does not depend on order of appearance.
- Repetition of a non-repeatable option is a usage error.
- `--` can terminate option parsing when a path begins with `-`.
- Response files, implicit environment options, configuration files, and network access are not in the MVP.

`--version` writes `perttool <semantic-version>` followed by a trailing newline to stdout. `--version` and `--help` are terminal options and MUST NOT be combined with each other or with other operands/options. Command `--help` may be used without required operands and always returns text. Use `dsl help --format json` for machine-readable DSL help and `agent help --format json` for provider-specific AI guidance.

### 3.2 Document input

`<file>` is a UTF-8 document path or `-`. `-` denotes stdin.

- Read-only operations and preview operations accept stdin.
- One invocation has exactly one document input.
- When stdin is used, the diagnostic source name is `<stdin>`.
- Parsing begins only after all input has been read.
- A file path is not treated as a URL.
- Invalid UTF-8 and read failures are I/O errors.
- The input digest is SHA-256 over raw UTF-8 bytes, including a BOM.
- The digest string representation is `sha256:<64 lowercase hex digits>`.

### 3.3 Common result options

Commands that return results use the following options.

| Option | Value | Default | Meaning |
| --- | --- | --- | --- |
| `--format` | `text` or `json` | `text` | CLI result serialization |
| `--color` | `auto`, `always`, `never` | `auto` | ANSI color for text diagnostics |
| `--warnings-as-errors` | flag | off | Exit 1 if at least one warning is present |
| `--max-diagnostics` | integer | `100` | 1..1000; upper limit on returned document diagnostics |

With `--format json`, `--color always` is a usage error. JSON MUST NOT contain ANSI escapes. `--color auto` independently determines whether stdout and stderr are TTYs.

`--warnings-as-errors` is accepted by document-processing commands other than `dsl help`. Since help commands have no document warnings, specifying it is a usage error.
`--max-diagnostics` is also accepted only by document-processing commands, and is a usage error for `dsl help`.

### 3.4 Command help and domain help

- `perttool --help` writes the resource list and global usage to stdout.
- `<resource> <action> --help` writes that command's operand/option usage to stdout.
- Command help exits 0 and does not read a document.
- Use `perttool dsl help` for learning-oriented DSL, analysis, and workflow help.
- Syntax-error diagnostics return a domain-help topic ID.

## 4. Command Surface

### 4.1 Complete surface

```text
perttool dsl check <file>
perttool dsl format <file>
perttool dsl help [<topic> [<subtopic>]]

perttool project show <file>
perttool project set <file>

perttool dag analyze <file>
perttool dag next <file>
perttool dag render <file> --to mermaid|svg|json
perttool dag import <file> --from mermaid
perttool dag advance <file>

perttool task add <file> <id> <from> <to>
perttool task set <file> <id>
perttool task remove <file> <id>
perttool task finish <file> <id>

perttool milestone add <file> <id>
perttool milestone set <file> <id>
perttool milestone remove <file> <id>

perttool resource add <file> <id>
perttool resource set <file> <id>
perttool resource remove <file> <id>
```

`dag render --to svg|json` reserves command-namespace targets for post-MVP work. The only target the MVP implementation is required to advertise and accept is `mermaid`. A change that adds a target MUST add its parser enum, command help, renderer, and golden tests together.

## 5. DSL Commands

### 5.1 `dsl check`

```text
perttool dsl check <file>
  [--warnings-as-errors]
  [--max-diagnostics <integer>]
  [--format text|json]
  [--color auto|always|never]
```

Checks grammar, fields, references, cycles, state, frontier, finish reachability, and active resource allocation. It does not calculate an analysis schedule.

### 5.2 `dsl format`

```text
perttool dsl format <file>
  [--check]
  [--diff]
  [--write [--expect-digest <digest>] | --out <path>]
  [--max-diagnostics <integer>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

- By default, previews the candidate document to stdout.
- `--diff` writes a unified diff to stdout instead of the candidate document.
- `--check` exits 1 when changes are required and does not write the file.
- `--check` alone in text format leaves stdout empty. When combined with `--diff`, it writes the diff to stdout.
- In JSON, `--check` changes only the CLI `ok` value and exit code; it does not hide the candidate, diff, or edits when candidate generation succeeds.
- `--check` cannot be combined with `--write` or `--out`.
- The formatter reparses and rechecks the candidate.
- `changed=false` when the input is already canonical.

### 5.3 `dsl help`

```text
perttool dsl help [<topic> [<subtopic>]]
  [--level index|quick|detail]
  [--format text|json]
  [--color auto|always|never]
```

- The default level without arguments is `index`.
- The default level when a topic is specified is `quick`.
- `<topic> <subtopic>` is normalized to the help ID `<topic>.<subtopic>`.
- A single topic ID containing a dot is also accepted.
- When the concatenation of positional topic and subtopic is absent from the registry, it is a help lookup error, not a usage error, and exits 1.
- A help result does not require grammar parsing and has no `document_id`.

Initial top-level topics:

```text
syntax analysis next editing mermaid workflows errors samples
```

## 6. Project and DAG Commands

### 6.1 `project show`

```text
perttool project show <file>
  [--max-diagnostics <integer>] [--warnings-as-errors]
  [--format text|json] [--color auto|always|never]
```

Returns exactly one project declaration from a valid document. It displays ID, effective grammar version, title, description, as_of, duration_unit, velocity, finish, critical_epsilon, and target_duration in a fixed order. When an optional field is not declared, it is `null` in JSON and `-` in text. It is read-only and does not rewrite the file.

The accepted [Governance Source and Effective-Metadata
specification](governance-source.md) requires Contract 5 to expose both
declared and effective owner/delegate metadata for every supported grammar
version. The [Governance Interface contract](governance-interface.md) fixes
its exact typed, text, JSON, schema, and compatibility projection. That atomic
cutover is active in the repository source; the published `0.3.0` artifact
retains the Contract 4 surface above.

### 6.2 Shared analysis options

`dag analyze` and `dag next` share the following options.

| Option | Value | Default | Constraint |
| --- | --- | --- | --- |
| `--capacity` | `<resource-id>=<integer>` | none | Repeatable; integer is 1..2147483647 |
| `--precision` | integer | `3` | 0..9; applies only to display |

Duplicate `--capacity` values for the same resource ID are a usage error. An unknown resource ID, capacity below a requirement, and capacity exceeded by active allocation are document/analysis errors. Overrides do not rewrite the source document.

### 6.3 `dag analyze`

```text
perttool dag analyze <file>
  [--schedule precedence|resource|both]
  [--capacity <resource-id>=<integer>]...
  [--max-paths <integer>]
  [--precision <integer>]
  [--max-diagnostics <integer>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

- The default schedule is `both`.
- `--max-paths` is 0..1000, defaulting to 1.
- A representative path and exact path count are returned regardless of `--max-paths`.
- `paths_truncated=true` when enumeration is less than the path count.
- `precedence` does not generate a resource result.
- `resource` does not display the full precedence result, but retains the precedence lower bound within the resource result.
- `both` returns separate precedence and resource results.

### 6.4 `dag next`

```text
perttool dag next <file>
  [--capacity <resource-id>=<integer>]...
  [--explain-depth <integer>]
  [--precision <integer>]
  [--max-diagnostics <integer>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

- `--explain-depth` is 0..32, defaulting to 1.
- Returns active, ready, runnable_now, blocked_now, and upcoming in full.
- A capacity override changes only `runnable_now` and schedule annotations; it does not change ready classification.
- Do not conflate display order with resource-selection order.

### 6.5 `dag render`

The [Mermaid Profile Specification](mermaid-profile.md) is authoritative for the artifact wire contract when Mermaid is selected.

```text
perttool dag render <file>
  --to mermaid|svg|json
  [--profile perttool|plain]
  [--analysis none|precedence|resource|both]
  [--capacity <resource-id>=<integer>]...
  [--strict-loss]
  [--out <path>]
  [--max-diagnostics <integer>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

- The default profile is `perttool`.
- The default analysis is `none`.
- Text results write the artifact body to stdout by default.
- JSON results include the artifact and loss report in the envelope.
- With `--out`, stdout is empty for text results and the write summary goes to stderr.
- An existing `--out` is not overwritten.
- With `--strict-loss`, one or more lossy records prevent writing the artifact and exit 4.
- `--to` is the artifact type, while `--format` is CLI result serialization; they are distinct concepts.
- `--capacity` can be combined only with `--analysis resource|both`.

### 6.6 `dag import`

The [Mermaid Profile Specification](mermaid-profile.md) is authoritative for profile detection, fail-closed validation, and the plain best-effort boundary.

```text
perttool dag import <file>
  --from mermaid
  [--strict-loss]
  [--out <path>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

- By default, previews the candidate DSL to stdout.
- No `--write` is provided to overwrite the source artifact in place with DSL.
- `--out` does not overwrite an existing path.
- Always generates a loss report and generated-ID mapping.
- With `--strict-loss`, one or more lossy records prevent writing the candidate and exit 4.

### 6.7 `dag advance`

```text
perttool dag advance <file>
  [--diff]
  [--write [--expect-digest <digest>] | --out <path>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

The default is a candidate-document preview. The result includes the tasks/milestones to remove, frontier before and after advance, and a ready-set comparison.

## 7. Entity Mutation Commands

The [Mutation Semantics Specification](mutation.md) is authoritative for mutation requests, target resolution, source-preserving TextEdits, comment ownership, and candidate rechecking. This document fixes CLI options and result serialization.

### 7.1 Common mutation output options

`project set` and every mutation action for `task`, `milestone`, and `resource` accept the following options.

```text
[--diff]
[--write [--expect-digest <digest>] | --out <path>]
[--max-diagnostics <integer>]
[--warnings-as-errors]
[--format text|json]
[--color auto|always|never]
```

Rules:

- By default, previews the changed document.
- `--diff` can be used only for previews.
- `--write` and `--out` are mutually exclusive.
- `--write` cannot be used with stdin.
- `--expect-digest` can be used only with `--write`.
- Even when `--expect-digest` is omitted, the digest immediately after reading is rechecked immediately before writing.
- `--out` does not overwrite an existing path.
- Do not output or write when the candidate fails parsing or semantic checks.
- Treat the whole action as one mutation; do not apply it partially.
- Conflicting options for the same field are a usage error.

To change multiple entities in the same valid candidate, provide a preview surface that accepts the Mutation Semantics Specification's `batch` request in JSON.

```text
perttool mutation apply <file> --request <json-file|->
  [--diff]
  [--write [--expect-digest <digest>] | --out <path>]
  [--max-diagnostics <integer>] [--warnings-as-errors]
  [--format text|json] [--color auto|always|never]
```

`--request -` can be used only when `<file>` is not stdin. The request JSON is `{ "kind": "batch", "mutations": [...] }`; it accepts every atomic request in the Mutation Semantics specification, including gate add/set/remove. Reject nested batches and multiple changes to the same target. Filesystem write options follow the same rules as other mutation commands.

### 7.2 project

```text
perttool project set <file>
  [--id <id>] [--version <integer>]
  [--title <text>] [--description <text>] [--as-of <date-or-date-time>]
  [--duration-unit day|hour|point] [--velocity <velocity>]
  [--finish <milestone-id>]
  [--critical-epsilon <duration>] [--target-duration <duration>]
  [--clear description|as_of|velocity|critical_epsilon|target_duration]...
```

At least one change option is required. A set option for the same field as `--clear` cannot be specified at the same time. Because the project declaration is exactly one, it takes no target-ID operand. Recheck the final candidate, including `duration_unit`, velocity, all durations, and finish references. A project-wide unit change that simultaneously requires related task changes includes `project.set` and other atomic mutations in a `mutation apply` batch.

### 7.3 task

`task add`:

```text
perttool task add <file> <id> <from> <to>
  (--duration <duration> |
   --optimistic <duration> --most-likely <duration> --pessimistic <duration>)
  --title <text> [--description <text>]
  [--status planned|active|blocked|done]
  [--priority <integer>] [--owner <text>]
  [--blocked-reason <text>] [--source <text>]
  [--tag <tag>]...
  [--require <resource-id>=<integer>]...
```

`task set` accepts `--from`, `--to`, and the field options above as optional changed fields; `--title` is not required. When changing to a three-point estimate, specify all three options in the same invocation, replacing the existing duration. `--duration` replaces the existing estimate. `--duration` and a three-point estimate are mutually exclusive.

```text
perttool task set <file> <id>
  [--from <milestone-id>] [--to <milestone-id>]
  [--title <text>] [--description <text>]
  [--duration <duration> |
   --optimistic <duration> --most-likely <duration> --pessimistic <duration>]
  [--status planned|active|blocked|done]
  [--priority <integer>] [--owner <text>]
  [--blocked-reason <text>] [--source <text>]
  [--require <resource-id>=<integer>]...
```

Additional set options:

```text
--add-tag <tag>...
--remove-tag <tag>...
--remove-require <resource-id>...
--clear description|status|priority|owner|blocked_reason|source|tags|requires
```

`task set` requires at least one change option. `--status blocked` requires `blocked_reason` to be present in the same candidate. `task remove` has no cascade option and rejects removal if the resulting graph is invalid. `task finish` changes the status to `done` and uses the same safe mutation path.

### 7.4 milestone

```text
perttool milestone add <file> <id>
  --title <text>
  [--description <text>]
  [--state planned|reached]
  [--tag <tag>]...

perttool milestone set <file> <id>
  [--title <text>] [--description <text>]
  [--state planned|reached]
  [--add-tag <tag>]... [--remove-tag <tag>]...
  [--clear description|state|tags]

perttool milestone remove <file> <id>
```

`milestone remove` does not cascade and rejects removal when endpoint/finish references remain.

`milestone set` requires at least one change option.

Combine operations that would produce an invalid intermediate DAG as standalone commands, such as adding a new milestone and its connecting task, in a `mutation apply` batch request. `milestone add` alone also checks the whole final candidate and does not accept an isolated milestone.

### 7.5 resource

```text
perttool resource add <file> <id>
  --title <text>
  --capacity <integer>
  [--description <text>]

perttool resource set <file> <id>
  [--title <text>] [--capacity <integer>]
  [--description <text>] [--clear description]

perttool resource remove <file> <id>
```

`resource remove` does not cascade-delete task requirements and rejects removal when references remain.

`resource set` requires at least one change option. Capacity is 1..2147483647, and all resulting requirements and active allocation are rechecked.

## 8. Write safety

In-place writes MUST use the following sequence.

1. Read the raw input bytes and digest.
2. Generate the candidate and `TextEdit` in Core.
3. Reparse and revalidate the candidate.
4. If the caller supplies `--expect-digest`, compare it with the initial digest.
5. Immediately before the write, reread the path digest and compare it with the initial digest.
6. Create an exclusive temporary file in the same directory.
7. Preserve the permission mode where possible.
8. Write the bytes, then flush/fsync.
9. Atomically rename the file.
10. Fsync the parent directory where possible.
11. Reread the written bytes and compare them with the candidate digest.

The MVP rejects `--write` to symlink inputs. `--out` also rejects symlink targets and existing paths. A race or digest mismatch returns exit 5 and does not modify the original file.

For an in-place `--write` whose candidate digest equals the initial digest, expected/current digest checks are not omitted; it succeeds with `written=false` without replacing the file. `--out` creates a new target even when the candidate equals the input.

The I/O adapter distinguishes conflicts using the stable reasons `expected_digest_mismatch`, `source_changed`, `symlink`, `not_regular_file`, and `target_exists`. Candidate-validation and post-rename-validation failures MUST NOT be confused with conflicts; they use `invalid_candidate`, `post_write_digest_mismatch`, and `post_write_invalid`. Temporary paths and random tokens MUST NOT appear in public results or diagnostics.

CLI write conflicts return `Perttool.CliError.v1`, diagnostic code `PTIO-501`, the stable conflict reason above in `data.reason`, and exit 5. Adapter verification failures return `PTIO-502`, an internal failure with a verification reason in `data.reason`, and exit 70. Other filesystem I/O errors return `PTCLI-003` and exit 3.

After flushing/fsyncing an exclusive temporary file in the same directory, `--out` publishes it with an atomic create that does not overwrite an existing target. On MVP-supported filesystems, it uses a same-filesystem hard link so that only one concurrent writer succeeds. After publishing the target, it fsyncs the parent directory, removes the temporary entry, and fsyncs the parent directory again.

## 9. stdout, stderr, and exit code

### 9.1 stream contract

Text format:

- stdout: requested data, artifact, candidate document, and diff
- stderr: diagnostics, warnings, and write summary
- Do not write successful diagnostics to stderr.
- A successful write with no data leaves stdout empty.

JSON format:

- stdout: one operation-result envelope followed by a newline
- Include document diagnostics in the envelope's `diagnostics`.
- stderr: only a short message for I/O, usage, or internal failures that prevent envelope generation
- Do not duplicate JSON diagnostics on stderr.

### 9.2 exit code

| Code | Stable meaning |
| ---: | --- |
| 0 | successful operation or valid document; warnings are allowed by policy |
| 1 | DSL, semantic, analysis, profile-validation, or help-lookup error; format-check difference; or warnings-as-errors |
| 2 | CLI usage error |
| 3 | input/output/encoding error |
| 4 | loss detected in strict conversion |
| 5 | optimistic-lock, symlink, or atomic-write conflict |
| 70 | internal invariant or programmer error |

When multiple categories occur simultaneously, detect CLI usage errors before reading the document. After document processing starts, return one result with priority `5 > 3 > 4 > 1 > 0`. Signal exits of `128+signal` are not part of the perttool contract.

## 10. Text result contract

### 10.1 stability boundary

Text is for humans. Golden tests fix the semantics of section order, field labels, diagnostic codes, IDs, and exact/display values. Whitespace-based column alignment and future explanatory additions are not a machine contract. Machine consumers use JSON.

### 10.2 diagnostic

```text
PTDSL-012 error: task REQ has an invalid estimate order
  --> plan.pert:24:5
  related: plan.pert:22:3 previous declaration
  help: perttool dsl help syntax estimate --level quick
```

Display diagnostics in the normative order of source position, code, and entity ID, not by severity (`error`, `warning`, `info`). Place diagnostics without a source position after positioned diagnostics, ordered by code.

### 10.3 check

Success stdout:

```text
OK plan.pert project=PLAN milestones=7 tasks=5 gates=4 resources=2
```

On error, leave stdout empty and write diagnostics to stderr.

### 10.4 project show

Success stdout:

```text
PROJECT PLAN
VERSION 1
TITLE "Plan"
DESCRIPTION -
AS_OF 2026-07-23
DURATION_UNIT point
VELOCITY 20p/1d
FINISH DONE
CRITICAL_EPSILON -
TARGET_DURATION -
```

### 10.5 analyze

Section order:

```text
PERTTOOL ANALYSIS <document-id>
QUALIFIERS
PRECEDENCE
PRECEDENCE CRITICAL
RESOURCE SCHEDULE
RESOURCE CRITICAL
RESOURCE UTILIZATION
```

Omit sections that were not requested. Order the precedence task table by stable topological position and ID, and display `ID EXPECTED ES EF LS LF TF FF CRITICAL`. Order the resource task table by scheduled start, finish, and ID, and display `ID ELIGIBLE START FINISH WAIT REQUIREMENTS`.

Heuristic-schedule headings MUST display `algorithm@version` and `optimal=false`. Do not hide blocked conditions, path truncation, or capacity overrides in `QUALIFIERS`.

### 10.6 next

The section order is `ACTIVE`, `RUNNABLE NOW`, `READY / WAITING RESOURCE`, `BLOCKED NOW`, and `UPCOMING`. Order each task by presentation order and show priority, criticality, total float, expected duration, and resource requirements. For a ready task that is not runnable, show the missing resource and occupant directly below it.

### 10.7 mutation and conversion

- default preview: the candidate document itself
- the default mutation text preview returns the candidate on stdout and `PREVIEW <operation> changed=<boolean> original_digest=<digest> updated_digest=<digest>` on stderr
- `--diff`: unified diff, with path labels for the input operand and candidate
- `--write`/`--out`: empty stdout; target and digest on stderr
- the successful-write summary is `WRITE <operation> mode=<in_place|out> target=<path> digest=<digest> written=<true|false>`
- default import: candidate DSL
- default render: artifact body
- JSON format returns the corresponding result envelope instead of the raw text above

## 11. JSON common contract

### 11.1 encoding and naming

- RFC 8259 JSON, UTF-8, no BOM, and a trailing newline
- field names use `snake_case`
- map keys use ASCII lexical order; entity arrays use each domain's stable order
- counts and quantities within the integer safe range are JSON numbers
- Rational numerators/denominators and BigInt path counts are decimal strings
- do not emit fields equivalent to `undefined`
- use `null` only for fields defined as nullable by the schema
- consumers ignore unknown optional fields in the same major version

### 11.2 document result envelope

Document operations have the following root fields.

```text
schema_version  string   "Perttool.<ResultType>.v1"
tool_version    string   semantic version
operation       string   resource.action
ok              boolean  success after the CLI warning policy is applied
document_id     string|null
source          string   operand spelling or "<stdin>"
source_digest   string|null
diagnostics     Diagnostic[]
diagnostics_truncated boolean
```

`schema_version` identifies both the result type and major version. Do not use `tool_version` to decide schema compatibility.

When `diagnostics_truncated=true`, `diagnostics` contains only the first `--max-diagnostics` items in source order. Text output appends `DIAGNOSTICS_TRUNCATED true limit=<N>` after diagnostics; do not silently treat truncation as success.

### 11.3 source location

```text
Position:
  offset         integer  0-based UTF-16 code unit
  line           integer  1-based
  column         integer  1-based UTF-16 code unit column

Span:
  start          Position
  end            Position  half-open
```

### 11.4 diagnostic

```text
Diagnostic:
  code             string
  severity         "error" | "warning" | "info"
  message          string
  entity_id        string|null
  span             Span|null
  related          RelatedLocation[]
  help_topic       string|null
  expected_syntax  string|null
  fixes            SuggestedFix[]
  data             object
```

`data` contains only stable fields specific to the diagnostic code and does not include a free-form stack trace. Do not normally output stack traces for internal errors; an explicit debug mode is future work.

Help-registry lookup diagnostics use the `PTHLP-*` namespace. An unknown topic is `PTHLP-001` with exit 1.

### 11.5 Rational value

```text
RationalValue:
  numerator       signed decimal integer string
  denominator     positive decimal integer string
  unit            "day" | "hour" | "point" | "day^2" | "hour^2" | "point^2" | "ratio"
  display         decimal string rounded by --precision
```

`display` MUST NOT be used for recalculation. The text renderer generates human-readable strings with a suffix for duration display; JSON `display` does not include a unit suffix.

## 12. Operation JSON results

### 12.1 CheckResult

`schema_version = "Perttool.CheckResult.v1"`

```text
grammar_version  integer|null
summary:
  resources      integer
  milestones     integer
  tasks          integer
  gates          integer
  errors         integer
  warnings       integer
```

If parsing fails and counts cannot be trusted, set every entity count to 0 and
`grammar_version=null`. `summary.errors` and `summary.warnings` are the total
counts before a limit is applied and may be greater than `diagnostics.length`.

### 12.2 AnalysisResult

`schema_version = "Perttool.AnalysisResult.v2"`

Version 2 adds `duration_unit point`, `velocity`, and `velocity_forecast`. It
increments the major version because it extends the Version 1 `duration_unit`
enum, and a Version 2 producer returns Version 2 for day/hour documents as
well.

Root:

```text
mode              "precedence" | "resource" | "both"
precision         integer
duration_unit     "day" | "hour" | "point"
critical_epsilon  RationalValue
velocity          Velocity|null
velocity_forecast AnalysisVelocityForecast|null
precedence        PrecedenceResult|null
resource          ResourceScheduleResult|null
```

`Velocity`:

```text
points             RationalValue  unit=point
period             RationalValue  unit=day|hour
```

`AnalysisVelocityForecast`:

```text
qualifier           "velocity_forecast"
source_unit         "day" | "hour" | "point"
target_unit         "day" | "hour" | "point"
precedence_makespan RationalValue|null
resource_makespan   RationalValue|null
```

A velocity forecast does not replace a result in its base unit.
`precedence_makespan` and `resource_makespan` are non-null only when the
corresponding base result was produced.

`PrecedenceResult`:

```text
makespan                       RationalValue
conditional_on_blocks_resolved boolean
blocked_task_ids                string[]
milestones                      MilestoneTiming[]
edges                           EdgeTiming[]
critical                        CriticalResult
```

`MilestoneTiming` has `id`, `earliest`, `latest`, and `slack`. `EdgeTiming`
has the following fields.

```text
id source target kind status
expected variance
es ef ls lf total_float free_float
is_critical is_driving
```

`kind` is `task|gate`; time, float, and expected values are `RationalValue`;
and `status` is a task status or `null` for a gate.

`CriticalResult`:

```text
milestone_ids       string[]
task_ids            string[]
gate_ids            string[]
driving_edge_ids    string[]
representative_path CriticalPath
path_count          decimal integer string
paths               CriticalPath[]
paths_truncated     boolean
```

`CriticalPath` has `edge_ids`, `task_ids`, `gate_ids`, and `variance`.

`ResourceScheduleResult`:

```text
algorithm:
  id                "parallel-sgs"
  version           integer
  optimal           false
conditional_on_blocks_resolved boolean
blocked_task_ids    string[]
capacities          ResourceCapacity[]
precedence_lower_bound RationalValue
makespan            RationalValue
resource_delay      RationalValue
tasks               ScheduledTask[]
resources           ResourceStatistic[]
resource_arcs       ResourceArc[]
constraint_graph_replay:
  ok                boolean
schedule_critical   ScheduleCriticalResult
```

`ResourceCapacity` has string `id`, integer `declared`, nullable integer
`override`, and integer `effective` fields.

`ScheduledTask`:

```text
id status expected variance
eligible_time start finish resource_wait
requirements        [{resource_id, units}]
priority_key        {priority, precedence_total_float, expected, task_id}
conditional_blocked boolean
```

`ResourceStatistic`:

```text
id capacity amount_time utilization peak_usage last_release
timeline [{task_id, start, finish, units}]
```

`ResourceArc`:

```text
id from_task_id to_task_id at_time wait_from
resources [{resource_id, contributed_units}]
schedule_float is_critical is_driving
```

Separate from precedence criticality, `ScheduleCriticalResult` has `task_ids`,
`resource_arc_ids`, `driving_constraint_ids`, `representative_path`,
`path_count`, `paths`, and `paths_truncated`. A schedule path has the
following fields.

```text
task_ids             string[]
constraints          [{from_task_id, to_task_id, kind, resource_arc_id}]
connector_ids        string[]
```

`kind` is `precedence|gate|resource`, and `resource_arc_id` is `null` for
non-resource constraints.

### 12.3 NextResult

`schema_version = "Perttool.NextResult.v3"`

The [Recommendation Interface Contract](recommendation-interface.md) is
authoritative for the complete recommendation-specific wire schema, version
identity, text summary, and PTREC failures. The root has
`recommendation_interface_version = 1` and required `recommendation`.

```text
precision             integer
duration_unit         "day" | "hour" | "point"
velocity              Velocity|null
velocity_forecast      NextVelocityForecast|null
```

`NextVelocityForecast`:

```text
  qualifier            "velocity_forecast"
  source_unit          "day" | "hour" | "point"
  target_unit          "day" | "hour" | "point"
```

The rest of the NextResult root:

```text
capacity_overrides    [{resource_id, capacity}]
recommendation        RecommendationAnalysis
groups:
  active              string[]
  ready               string[]
  runnable_now        string[]
  blocked_now         string[]
  upcoming            string[]
tasks                 NextTask[]
```

`NextTask`:

```text
id title status classification runnable_now
priority owner blocked_reason
expected total_float earliest_start
forecast_expected forecast_total_float forecast_earliest_start
precedence_critical schedule_critical
requirements          [{resource_id, units}]
resource_rejections   ResourceRejection[]
explanation           ExplanationNode[]
```

`classification` is `active|ready|blocked_now|upcoming`. `runnable_now` is a
boolean orthogonal to a ready task; do not fold it into the classification
enum.

`recommendation` evaluates only actual ready tasks and returns the tier,
recommended set, typed facts, comparisons, decision trace, and descriptions
for all ready tasks as a complete graph. `groups`,
`tasks[].resource_rejections`, and upcoming `tasks[].explanation` retain their
V2 meanings and are not reinterpreted as recommendations. See the
[NextResult.v3 consumer migration guide](../process/next-v3-consumer-migration.md)
for breaking migration from V2 and consumer safety.

`title` is a string, `status` is a task status, `priority` is an integer, and
`owner` and `blocked_reason` are strings or `null`. `expected`,
`total_float`, and `earliest_start` are `RationalValue` in the base unit.
`forecast_*` are `RationalValue` in the target unit only when velocity exists;
otherwise, they are `null`.

`tasks` and `groups` cover only unfinished tasks; they do not include retained
`done` tasks as candidates for the next task.

`ResourceRejection`:

```text
resource_id capacity active_usage earlier_selected_usage
used_before_decision required available deficit
active_task_ids earlier_selected_task_ids
```

`ExplanationNode`:

```text
milestone_id          string
reached               boolean
unsatisfied_edges     UnsatisfiedEdge[]
children              ExplanationNode[]
truncated             boolean
```

`UnsatisfiedEdge`:

```text
edge_id               string
kind                  "task" | "gate"
status                task status | null
source_milestone_id   string
source_reached        boolean
```

For an upcoming task, `explanation` roots at the task's direct `from`
milestone. The root always returns unsatisfied incoming edges, and
`--explain-depth 0` stops there. For each increment of depth, add the
unreached source milestones of unsatisfied edges to `children` in
lexicographic ID order. A node with unexpanded sources remaining at the limit
has `truncated=true`. Do not revisit the same milestone on the same DAG path.

### 12.4 FormatResult

`schema_version = "Perttool.FormatResult.v1"`

```text
changed          boolean
original_digest  string
updated_digest   string|null
updated_text     string|null
diff             string|null
edits            TextEdit[]
write:
  mode            "preview" | "out" | "in_place"
  target          string|null
  written         boolean
```

When candidate generation succeeds, JSON retains `updated_text`, `diff`, and
`edits` even when `--check` or `--warnings-as-errors` makes the CLI
`ok=false`.

### 12.5 ProjectResult

`schema_version = "Perttool.ProjectResult.v1"`

```text
grammar_version  integer
project:
  id                 string
  version            integer
  title              string
  description        string|null
  as_of              string|null
  duration_unit      "day" | "hour" | "point"
  velocity           string|null
  finish             string
  critical_epsilon   string|null
  target_duration    string|null
```

It has the common root fields `document_id`, `source`, `source_digest`,
`diagnostics`, and `diagnostics_truncated`. For an invalid document,
`project=null` and `grammar_version=null`.

### 12.6 MutationResult

`schema_version = "Perttool.MutationResult.v1"`

```text
changed          boolean
original_digest  string
updated_digest   string|null
updated_text     string|null
diff             string|null
edits            TextEdit[]
write:
  mode            "preview" | "out" | "in_place"
  target          string|null
  written         boolean
```

`TextEdit` has 0-based UTF-16 `start_offset`, `end_offset`, and `replacement`.
With `--format json`, return both `updated_text` and `diff` when candidate
generation succeeds, regardless of preview/write mode.

`dag advance` additionally has the following fields.

```text
advance:
  removed_task_ids
  removed_gate_ids
  removed_milestone_ids
  frontier_before
  frontier_after
  ready_before
  ready_after
```

### 12.7 HelpResult

`schema_version = "Perttool.HelpResult.v1"`

The Help result root has `tool_version`, `operation="dsl.help"`, `ok`, and
`diagnostics`; it has no document field.

```text
topic_id      string|null
level         "index" | "quick" | "detail"
title         string
summary       string
sections      [{id, title, body}]
syntax        string[]
examples      [{id, title, text}]
related       string[]
topics        [{id, title, summary}]
```

The index level uses `topics`. Sample references use stable example IDs rather
than absolute paths.

### 12.8 ConversionResult

Rendering uses `Perttool.ExportResult.v1`; import uses
`Perttool.ImportResult.v1`.

```text
artifact_format  "mermaid" | "svg" | "json" | "pert"
artifact         string|object|null
artifact_digest  string|null
profile          "perttool" | "plain"
analysis         "none" | "precedence" | "resource" | "both"
capacity_overrides [{resource_id, capacity}]
loss_report:
  lossless       boolean
  records        ConversionLoss[]
generated_ids    [{source_element, generated_id}]
write            {mode, target, written}
```

MVP `dag render --to mermaid` sets `artifact` to a UTF-8 Mermaid string and
`artifact_digest` to the SHA-256 of its bytes. Both are `null` for an invalid
document or strict-loss failure. `capacity_overrides` are in ascending resource
ID order and `generated_ids=[]`.

`ConversionLoss` has `code`, `severity`, `message`, nullable `element_id`,
nullable `span`, and boolean `lossy`.

The [Mermaid Profile specification](mermaid-profile.md) is authoritative for
stable `PTCNV-*` codes for Mermaid profile errors and plain import loss. A
validation error after profile-header detection does not fall back to plain
mode and returns no candidate.

The type schema ID for `loss_report` is `Perttool.ConversionLossReport.v1`, and
the Export/Import result `$defs` refer to the same definition.

## 13. CLI error serialization

When a usage or I/O error prevents generation of a document result, text output
emits one `PTCLI-*` diagnostic and a usage hint to stderr.

When the invocation includes a complete `--format json` and the JSON renderer
can be selected, return the following on stdout.

```text
schema_version  "Perttool.CliError.v1"
tool_version
operation       string|null
ok              false
diagnostics     Diagnostic[]
```

When an unknown or malformed `--format` itself is the cause, do not infer JSON;
use text stderr.

## 14. Determinism and privacy

- Do not automatically insert the current time, hostname, username, or
  absolute cwd into a result.
- Preserve the operand spelling supplied by the caller in `source`; do not
  silently make it absolute.
- Do not duplicate the entire document in a diagnostic message.
- Do not include temporary paths, stack traces, or random IDs in stable
  results.
- Output arrays use the stable order specified by their domain specifications.
- Return byte-identical JSON for the same document bytes, options,
  grammar/semantics/analysis/interface versions, and tool version.
- The text renderer does not change entity order or values based on terminal
  width.

## 15. MVP acceptance

At a minimum, the CLI implementation automatically checks the following.

1. Reject unknown commands/options/extra operands for every resource/action
   with exit 2.
2. Read-only results from files and stdin are semantically identical.
3. Text preserves data stdout and diagnostic stderr.
4. JSON is valid, has no ANSI, ends with a newline, and has stable key/entity
   order.
5. Text and JSON diagnostic code, severity, span, and help topic agree.
6. CheckResult agrees with valid/invalid fixtures.
7. AnalysisResult agrees exactly with the analysis golden using Rational values.
8. `--schedule` mode separates result sections correctly.
9. A capacity override changes only resource/next results without modifying the
   document.
10. NextResult classification and runnable_now are orthogonal.
11. `--precision` changes only display and does not change exact values.
12. `--max-paths` limits only enumeration without changing path count.
13. Help index/quick/detail and JSON are generated from the same registry.
14. The mutation default previews without modifying the file.
15. Mutation JSON agrees on updated text, diff, and TextEdit.
16. Do not return preview/write when the candidate is invalid.
17. Safely reject a digest race, symlink, and existing `--out`.
18. Write atomically and recheck the document after writing.
19. Mermaid export/import loss reports agree with strict-loss exit 4.
20. CLI JSON and the direct Core API result have the same semantic payload.
21. Every combination of warning policy and exit code agrees with the golden.
22. Do not convert an internal invariant failure into a document error or exit
    0.
23. Project show returns all project metadata as text/JSON, and project set can
    preview/write the same fields.
24. An atomic batch containing project.set checks only the final candidate for
    a project-wide unit change.

MVP acceptance does not include an MCP server, MCP tool schemas, or CLI/MCP
parity tests.

## 16. Versioning and post-MVP adapter boundary

Interface version 1 covers grammar version 1, semantics version 1, and
analysis version 1.

The following are breaking changes and require an Interface major-version
increment.

- Removing or changing the meaning of a resource/action/required operand.
- A breaking change to an option name, default, or stable exit-code meaning.
- Removing or changing the type of a required JSON field, or narrowing an
  enum.
- Changing the source-position base or digest representation.
- Changing the scope for which text is guaranteed as a machine interface.

Even when future MCP adapters, an LSP server, or a VSIX are added, use the same
Application/Core API rather than calling the CLI process as a subprocess or
duplicating semantic rules in adapters. Define MCP-specific summaries,
transport errors, tool schemas, LSP capabilities, and VSIX packaging/server
distribution in separate versioned specifications; do not retroactively add
them to the completion criteria for the CLI MVP or the first beta.

CLI Contract 3 is separately versioned because it changes resources, actions,
JSON operation names, help schemas, and usage-error recovery. Implementations
must follow its [migration boundary](../process/cli-contract-3-migration.md)
rather than adding Contract 3 aliases to this Contract 2 surface.

The [Temporal and Unit Interface Contract](temporal-unit-interface.md)
version 2 separately targets grammar version 3 and CLI Contract 4. It selects
CheckResult v2, ProjectResult v2, AnalysisResult v3, NextResult v4, and
UnitMigrationResult v2 without changing the retained Contract 2 payload
meanings in this document or silently widening active Contract 3.
