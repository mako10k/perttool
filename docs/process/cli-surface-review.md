# CLI surface review for human and LLM users

- Status: Review baseline
- Date: 2026-07-24
- Current CLI contract: 2
- Proposed CLI contract: 3
- Related backlog: [../backlog.md](../backlog.md)
- Related plan: [../../plans/cli-surface-reset.pert](../../plans/cli-surface-reset.pert)

## Purpose

This review evaluates whether a user or an LLM can discover the complete
perttool surface, understand side effects, and maintain a `.pert` file without
guessing. It separates confirmed behavior in `0.1.0` from the proposed breaking
contract. The proposal is not implemented by this document.
The related plan sequences the reviewed work but does not accept the proposed
contract or authorize implementation.

## Confirmed current surface

The `0.1.0` dispatcher implements:

| Resource | Actions |
| --- | --- |
| `dsl` | `check`, `format`, `help` |
| `agent` | `help` |
| `project` | `show`, `set` |
| `dag` | `analyze`, `next`, `advance`, `render`, `import` |
| `task` | `add`, `set`, `remove`, `finish` |
| `milestone` | `add`, `set`, `remove` |
| `resource` | `add`, `set`, `remove` |
| `mutation` | `apply` |

Read-only and preview commands accept a file or stdin. Formatter and mutation
commands preview by default. Explicit `--write` uses digest revalidation and
atomic replacement; `--out` exclusively creates a new path.

## Findings

### Confirmed gaps

1. Top-level help abbreviates entity actions and has no resource-level view.
2. Command help is text-only and is available only for the exact
   `<resource> <action> --help` shape.
3. Most command help is maintained as strings in `src/cli.ts`; only `agent
   help` obtains its syntax from structured registry data. This conflicts with
   the basic-design goal that help come from a common registry.
4. The accepted option sets and the displayed option sets have no automatic
   completeness check.
5. Command help does not structurally expose defaults, repeatability,
   conflicts, stdin behavior, stdout/stderr behavior, write effects, result
   schema, or exit statuses.
6. There is no command to initialize the smallest valid `.pert` document.
7. Tasks, milestones, and resources have mutation commands, but gates do not
   exist in the public mutation type or CLI.
8. `--clear` values use DSL-style snake_case while ordinary CLI options use
   kebab-case. The mapping is not discoverable as structured data.
9. The root README mixes user operation, repository development, release
   history, and maintainer-only self-use guidance.

### Inferences

- An LLM can operate the implemented happy path after reading the full
  interface specification, but cannot discover the same contract from the
  installed CLI alone.
- File-first reading is sufficient for declared entity state. Adding list/show
  commands for every entity would duplicate the canonical text without fixing
  the actual maintenance gaps.
- Project initialization and gate mutation are the blockers to claiming that a
  plan can be maintained entirely through typed tools.

## Proposed contract 3

The next breaking beta should expose this canonical surface:

```text
perttool --version
perttool --help
perttool help [<resource> [<action>]] [--format text|json]
perttool guide [<topic> [<subtopic>]] [--level index|quick|detail] [--format text|json]
perttool agent help [<provider> [<surface>]] [--level index|quick|detail] [--format text|json]

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

Breaking mappings:

| Contract 2 | Contract 3 |
| --- | --- |
| `dsl check` | `document check` |
| `dsl format` | `document format` |
| `dsl help` | `guide` |
| `mutation apply` | `batch apply` |
| exact command `--help` only | hierarchical `help` plus conventional `--help` text alias |

`agent help` remains separate because it queries provider guidance rather than
the command or DSL contract. `dag` remains the analysis/conversion namespace.
`project show` remains because it exposes effective/defaulted metadata used by
automation; entity list/show commands are not part of contract 3.

## Naming and result rules

- CLI resources, actions, options, and option enum values use lower-case
  kebab-case.
- DSL fields retain their grammar spellings.
- JSON fields retain lower-case snake_case.
- The command registry records every mapping where those spellings differ.
- `--format text|json`, diagnostic controls, and write controls have one shared
  descriptor and one validation implementation.
- Preview remains the default for every command that can change content.
- Help JSON identifies whether a command reads a document, accepts stdin,
  writes the input, creates an output, or has no filesystem side effect.
- Every result-producing command identifies its schema version in help.

## Structured command descriptor

The registry must contain enough data to drive dispatch and both help
projections:

```ts
interface CommandDescriptor {
  resource: string;
  action: string;
  summary: string;
  operands: readonly OperandDescriptor[];
  options: readonly OptionDescriptor[];
  input: "none" | "document" | "artifact";
  stdin: "unsupported" | "optional" | "required";
  effect: "read" | "preview" | "write-or-create";
  resultSchemas: readonly string[];
  exitStatuses: readonly ExitStatusDescriptor[];
  examples: readonly string[];
}
```

The implementation may use richer internal types, but no independent help-only
copy of an option set is accepted.

## Acceptance boundary

Contract 3 is accepted only when:

1. requirements, interface specification, basic design, and migration notes
   agree on the full surface;
2. the command registry is the dispatch and help authority;
3. project initialization and gate mutation close the tool-maintenance gaps;
4. text/JSON help is complete at top-level, resource-level, and action-level;
5. an installed-package E2E test completes the file-first maintenance workflow;
6. old contract-2 commands fail according to the documented beta migration;
7. README examples use only the accepted installed surface.

Shell completion, interactive prompts, TUI, MCP, LSP, VSIX, locale negotiation,
and direct Git operations are non-goals for this reset.
