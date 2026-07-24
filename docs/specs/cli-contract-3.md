# CLI Contract 3 Specification

- Document status: Accepted design; implementation pending
- Specification version: 1
- Target CLI contract version: 3
- Created: 2026-07-24
- Requirements: [../requirements.md](../requirements.md)
- Current CLI contract: [interfaces.md](interfaces.md)
- Basic design: [../basic-design.md](../basic-design.md)
- Migration: [../process/cli-contract-3-migration.md](../process/cli-contract-3-migration.md)

## 1. Purpose and activation boundary

This specification fixes the next breaking CLI surface for human and LLM
users. It covers command discovery, domain guidance, complete file-first
maintenance, naming, side effects, result schemas, and acceptance cases.

Contract 3 is an accepted design target, not the currently implemented
interface. Until the atomic cutover defined by the migration guide:

- [CLI Interface version 2](interfaces.md) remains the implemented contract;
- implementations MUST NOT advertise a Contract 3 command that is unavailable;
- consumers MUST NOT assume that the commands in this document work in
  `0.1.0`;
- `project init` remains backlog item `MUT-001`, and gate maintenance remains
  backlog item `MUT-002`.

The cutover activates this complete specification at once. It does not activate
individual renames opportunistically.

## 2. Product invariants and non-goals

Contract 3 preserves these invariants.

- The `.pert` file is the source of truth for declared project state.
- Users read declared entity state from the file; the CLI provides typed,
  validated maintenance and effective or derived results.
- Preview is the default for every operation that can change document text.
- Text and JSON are projections of the same Core or registry result.
- Command dispatch does not accept a resource, action, operand, or option that
  is absent from structured command help.
- Stable machine contracts use IDs, codes, enums, fields, and schema versions,
  not natural-language text.
- The CLI does not require a database, server, network connection, Git
  repository, or process locale.

The following are not part of Contract 3:

- entity `list` or `show` commands that merely duplicate declared file content;
- shell completion, interactive prompts, a TUI, or a GUI;
- MCP, LSP, or VSIX surfaces;
- locale negotiation, translation catalogs, or a `--locale` option;
- direct Git operations;
- backlog hierarchy or multi-plan composition.

`project show` remains because it exposes effective and defaulted project
metadata used by automation. `dag analyze` and `dag next` remain the sources of
derived schedule and recommendation state.

## 3. Canonical command surface

### 3.1 Top-level grammar

```text
perttool --version
perttool --help
perttool help [<resource> [<action>]] [--format text|json]
perttool guide [<topic> [<subtopic>]]
  [--level index|quick|detail] [--format text|json]
perttool <resource> <action> [operands] [options]
perttool <resource> <action> --help
```

`perttool --help` is a text alias for the top-level `help` query.
`<resource> <action> --help` is a text alias for
`help <resource> <action>`. Aliases do not read a document and do not accept
additional command operands. Machine consumers use the canonical `help
--format json` forms.

An unknown target supplied to `help` is a help-lookup error with exit 1. An
unknown resource, action, option, missing value, conflict, or extra operand in a
normal command invocation is a usage error with exit 2.

### 3.2 Complete resources and actions

```text
perttool document check <file>
perttool document format <file>

perttool project init <project-id>
perttool project show <file>
perttool project set <file>

perttool dag analyze <file>
perttool dag next <file>
perttool dag advance <file>
perttool dag render <file>
perttool dag import <file>

perttool task add|set|remove|finish ...
perttool gate add|set|remove ...
perttool milestone add|set|remove ...
perttool resource add|set|remove ...
perttool batch apply <file> --request <json-file|->
```

The separate read-only `agent help` surface remains governed by the
[AI Agent Guidance Registry specification](agent-guidance.md). It is not a
command-discovery or domain-guide alias.

### 3.3 Breaking command and operation mapping

| Contract 2 command | Contract 3 command | Contract 3 JSON `operation` |
| --- | --- | --- |
| `dsl check` | `document check` | `document.check` |
| `dsl format` | `document format` | `document.format` |
| `dsl help` | `guide` | `guide` |
| `mutation apply` | `batch apply` | `batch.apply` |
| exact command `--help` | hierarchical `help` and text aliases | `help` |

`project`, `dag`, `task`, `milestone`, `resource`, and `agent help` operation
names remain unchanged. Contract 3 adds `project.init` and `gate.add`,
`gate.set`, and `gate.remove`.

The Contract 2 spellings are not aliases after cutover. They fail as unknown
resources or actions with exit 2 and a structured Contract 3 help target.

## 4. Naming and shared option rules

- Resource names, action names, option names, and option enum values use
  lower-case kebab-case.
- DSL fields retain their grammar spelling.
- JSON fields retain lower-case snake_case.
- JSON `operation` uses `<resource>.<action>`, except top-level `help` and
  `guide`.
- A descriptor records the CLI, DSL, and JSON spelling when they differ.
- Long-option prefix abbreviation is not accepted.
- Both `--name value` and `--name=value` are accepted.
- Boolean flags do not take values.
- Repeating a non-repeatable option is a usage error.
- Option meaning does not depend on argument order.
- `--` terminates option parsing.

Common option groups are declared once and referenced by command descriptors.
A command receives only the groups and options named by its descriptor.

| Group | Options | Applicability |
| --- | --- | --- |
| result | `--format`, `--color` | result-producing commands |
| diagnostics | `--warnings-as-errors`, `--max-diagnostics` | document-processing commands |
| preview | `--diff` | document mutation preview |
| write | `--write`, `--out`, `--expect-digest` | input-document mutations as permitted |
| guide | `--level` | `guide` and `agent help` |

`--format json` conflicts with `--color always`. `--expect-digest` requires
`--write`; `--write` conflicts with stdin and `--out`; `--diff` is preview-only.
Command-specific defaults, repeatability, conflicts, and requirements are
returned by command help rather than inferred from these group names.

## 5. Authoritative command descriptor registry

### 5.1 Descriptor model

One typed registry is authoritative for dispatch validation, text help, JSON
help, and command examples. The implementation may use richer internal types,
but every descriptor projects at least these fields.

```ts
interface CommandDescriptor {
  contractVersion: 3;
  path:
    | readonly [command: string]
    | readonly [resource: string, action: string];
  operation: string;
  summary: string;
  operands: readonly OperandDescriptor[];
  options: readonly OptionDescriptor[];
  input: "none" | "document" | "artifact";
  stdin: {
    document: boolean;
    artifact: boolean;
    request: boolean;
    mutuallyExclusive: boolean;
  };
  effect: "read" | "preview" | "write-or-create";
  resultSchemas: readonly string[];
  exitStatuses: readonly ExitStatusDescriptor[];
  examples: readonly CommandExample[];
}
```

An operand descriptor contains its name, value type, requiredness, and
position. An option descriptor contains its canonical name, value type or
flag status, requiredness, repeatability, default, enum values, conflicts,
requirements, shared-group origin, and CLI/DSL/JSON spelling mapping.

Length-one paths cover top-level `help` and `guide`. Length-two paths cover
resource/action commands, including `agent help`. `--version` is terminal
package metadata, and `--help` is the text alias derived from the `help`
descriptor.

The registry has the following invariants.

1. Each implemented command path occurs exactly once.
2. Each accepted operand and option occurs exactly once in its expanded
   command descriptor.
3. Shared option expansion is deterministic and rejects duplicate names.
4. Dispatch is generated from or validated against the expanded registry.
5. Every command has at least one example and every result schema is known.
6. Adding dispatch behavior without a complete descriptor fails repository
   verification.

### 5.2 Input and effect meanings

- `input=none`: no project or artifact is read.
- `input=document`: one UTF-8 `.pert` document is read from a path or stdin
  according to `stdin`.
- `input=artifact`: one conversion artifact is read.
- `stdin.document=true`: `-` may replace the document operand.
- `stdin.artifact=true`: `-` may replace the conversion-artifact operand.
- `stdin.request=true`: `-` may replace the request operand.
- When more than one is true, `mutuallyExclusive=true` and one invocation can
  consume only one stdin stream.
- When all are false, stdin is never consumed.
- `effect=read`: no filesystem mutation.
- `effect=preview`: returns candidate data by default and can write only when
  its descriptor exposes write options.
- `effect=write-or-create`: can create an output but still previews by default.

Help itself has `input=none`, all stdin flags false, and `effect=read`.

## 6. Hierarchical command help

### 6.1 Queries

```text
perttool help --format json
perttool help <resource> --format json
perttool help <resource> <action> --format json
```

- The top-level result contains every top-level command and every resource and
  action.
- A resource result contains every action for that resource.
- An action result contains the complete expanded descriptor.
- Text and JSON are projections of the same query result.
- Help performs no project read, filesystem write, network access, or
  environment-based discovery.
- Result order is resource registry order, then action registry order; option
  order is descriptor order.

### 6.2 CommandHelpResult

Command-help JSON uses `schema_version =
"Perttool.CommandHelpResult.v1"`, `cli_contract_version = 3`, and
`operation = "help"`.

```text
tool_version
ok
query:
  resource       string|null
  action         string|null
resources        [{name, summary, actions}]
commands         [CommandDescriptor]
diagnostics      Diagnostic[]
```

The top-level query has all command paths and resources. A resource query has one
resource and all of its commands. An action query has one complete command.
Lookup failure returns the same envelope with `ok=false`, empty `commands`, a
stable diagnostic, and exit 1. `PTHLP-002` identifies an unknown resource or
top-level command, and `PTHLP-003` identifies an unknown action under a known
resource. Domain-guide lookup retains the separate Contract 2
`PTHLP-001` meaning until `HELP-002` migrates that projection.

Every Contract 3 CLI JSON success or error envelope includes
`cli_contract_version = 3`. Consumers check `schema_version`,
`cli_contract_version`, and `operation` before using command-specific fields.

## 7. Domain guidance and usage recovery

`guide` owns conceptual DSL, analysis, recommendation, editing, Mermaid,
workflow, error, and sample topics. It preserves the stable Contract 2 topic
IDs but is not a substitute for a command option contract.

Guide JSON uses `Perttool.GuideResult.v1`, `cli_contract_version = 3`, and
`operation = "guide"`. Its topic, level, sections, syntax, examples, related,
and topics fields preserve the meanings of Contract 2
`Perttool.HelpResult.v1`.

Diagnostics that refer to conceptual material contain a stable `guide_topic`.
Contract 3 emission of `Perttool.CliError.v1` adds an additive nullable
structured target:

```text
help_target:
  resource       string|null
  action         string|null
```

A usage error identifies the parsed resource/action when known, the invalid or
missing token, and the most specific valid `help_target`. Rendered text includes
the equivalent `perttool help ...` query. A suggestion MUST come only from the
registry and MUST NOT invent an unavailable command or option.

## 8. File-first maintenance additions

### 8.1 `project init`

`project init` is backlog item `MUT-001`; this section fixes its future
contract without implementing it.

```text
perttool project init <project-id>
  --title <text>
  --duration-unit day|hour|point
  --initial-milestone <milestone-id>
  --initial-milestone-title <text>
  --finish <milestone-id>
  [--version <integer>]
  [--as-of <date-or-date-time>]
  [--velocity <velocity>]
  [--out <path>]
  [--format text|json]
  [--color auto|always|never]
```

Rules:

- `--version` defaults to `1`; no clock-derived field has a default.
- Contract 3 initialization creates exactly one project and one reached
  milestone, with no task, gate, or resource.
- `--finish` MUST equal `--initial-milestone` in initialization version 1.
- `point` requires `--velocity`; `day` and `hour` accept it when its period
  suffix matches the project duration unit.
- Default text output is the complete candidate document.
- `--out` exclusively creates a new path, validates the written document, and
  refuses an existing or symlink target.
- `--write`, `--expect-digest`, document stdin, templates, and implicit
  dependencies are not accepted.
- JSON returns one insertion edit at UTF-16 offset zero and does not pretend
  that an input document existed.

The result schema is `Perttool.InitResult.v1`. It contains
`cli_contract_version=3`, `operation="project.init"`, `document_id`, nullable
`source` and `source_digest` set to null, `candidate_text`,
`candidate_digest`, `edits`, `write`, and `diagnostics`.

### 8.2 Gate maintenance

Gate commands are backlog item `MUT-002`.

```text
perttool gate add <file> <id> <from> <to> --reason <text>
perttool gate set <file> <id>
  [--from <milestone-id>] [--to <milestone-id>] [--reason <text>]
perttool gate remove <file> <id>
```

They use the common mutation preview/write contract and
`Perttool.MutationResult.v1`. `gate set` requires at least one change.
`gate remove` has no cascade. Every candidate is rechecked for endpoint
references, cycles, finish reachability, and joins.

Adding connected milestones, gates, or tasks that are invalid in isolation uses
one `batch apply` request. Batch semantics remain those of the
[Mutation Semantics specification](mutation.md); only the public resource and
JSON operation change from `mutation.apply` to `batch.apply`.

## 9. Result-schema and stream boundary

Contract 3 preserves the Contract 2 stream and exit meanings unless this
specification changes them explicitly.

- Text data goes to stdout; diagnostics and write summaries go to stderr.
- JSON success results are one envelope on stdout followed by a newline.
- Usage errors are detected before document reads.
- Exit meanings remain 0 success, 1 document/domain/help error, 2 usage, 3 I/O,
  4 forbidden conversion loss, 5 write conflict, and 70 internal failure.
- Existing document result schema versions remain unchanged when their payload
  meanings do not change.
- The renamed commands change `operation` to the Contract 3 value.
- Command help uses `Perttool.CommandHelpResult.v1`.
- Domain guidance uses `Perttool.GuideResult.v1`.
- Initialization uses `Perttool.InitResult.v1`.

The versioned migration changes the public command and operation namespace in
one cutover. It does not offer a Contract 2 schema or spelling switch.

## 10. Normative acceptance cases

| ID | Required observation |
| --- | --- |
| CLI3-001 | The top-level JSON help catalog contains every and only implemented Contract 3 top-level command and resource/action path. |
| CLI3-002 | Resource help contains all actions for that resource; action help contains every accepted operand and option with type, requiredness, repeatability, default, conflicts, input, effect, schemas, exits, and examples. |
| CLI3-003 | Text help, JSON help, and dispatch expand the same descriptor registry; removing a descriptor or option makes verification fail. |
| CLI3-004 | Help runs without a project, provider state, filesystem mutation, network access, or environment-dependent discovery. |
| CLI3-005 | `guide` preserves all registered domain topic IDs while command discovery requires no topic ID. |
| CLI3-006 | Unknown resource, action, option, missing value, conflict, and extra operand return exit 2 and the exact structured help target. |
| CLI3-007 | Every error suggestion names only a registry resource, action, or option. |
| CLI3-008 | `project init` previews the explicit one-project/one-reached-milestone document, requires point velocity, and creates only through exclusive `--out`. |
| CLI3-009 | Gate add/set/remove and a connected atomic batch preserve source text and reject invalid endpoints, cycles, joins, and cascading remove. |
| CLI3-010 | Contract 2 `dsl` and `mutation` spellings fail after cutover; no hidden alias accepts them. |
| CLI3-011 | Every JSON envelope reports Contract 3, and renamed command `operation` values match the mapping table. |
| CLI3-012 | An isolated installed package can initialize, read, mutate every project/task/gate/milestone/resource field, analyze, select, advance, and validate without manually rewriting the file. |
| CLI3-013 | README and package examples contain only the accepted Contract 3 surface at cutover. |
| CLI3-014 | Repeating the same help query returns byte-identical JSON and semantically identical text. |

Contract 3 is not accepted by passing only the design-document checks. All
cases require implementation evidence in the cutover and file-first acceptance
tasks.
