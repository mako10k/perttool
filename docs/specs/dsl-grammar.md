# perttool DSL Grammar Specification

- Document status: Draft 1.0
- Grammar versions: 1, 2, 3, 4, 5, 6, and 7 active
- Created: 2026-07-21
- Updated: 2026-08-13
- Related requirements: [../requirements.md](../requirements.md)
- Related basic design: [../basic-design.md](../basic-design.md)
- CLI interface: [interfaces.md](interfaces.md)
- Mutation semantics: [mutation.md](mutation.md)
- Unit migration semantics: [unit-migration.md](unit-migration.md)
- Temporal and unit interface: [temporal-unit-interface.md](temporal-unit-interface.md)
- Governance source and effective metadata: [governance-source.md](governance-source.md)
- Conditional plan assurance interface: [plan-assurance-interface.md](plan-assurance-interface.md)
- Milestone outcome acceptance: [milestone-acceptance.md](milestone-acceptance.md)
- Accepted Grammar 8 target: [Calendar-Aware Temporal Scheduling Contract](temporal-schedule.md)

## 1. Purpose

This document defines the lexical rules, syntax, fields for each block, defaults, the boundary between syntax and semantic validation, source spans, error recovery, and formatting contract for `.pert` documents.

The EBNF and field tables through Section 19 are normative for grammar version
1. Section 20.1 fixes the active grammar version 2 temporal delta. Section
20.2 fixes the active grammar version 3 exact fraction Duration delta selected
by [Temporal and Unit Interface Contract version
2](temporal-unit-interface.md). Section 20.3 fixes the active Grammar 4
governance delta. Section 20.4 fixes the active Grammar 5 project-actuals
delta. Section 20.5 fixes the Grammar 6 plan-assurance delta. Section 20.6
fixes the active Grammar 7 milestone-acceptance delta. Section 20.7 records
the separately accepted but inactive Grammar 8 owner without duplicating its
integrated contract. See the
following representative valid version 1
documents.

- [minimal.pert](../examples/minimal.pert)
- [parallel.pert](../examples/parallel.pert)

## 2. Normative precedence

When documents disagree, resolve the discrepancy in the following order.

1. Must requirements in `docs/requirements.md`
2. The grammar, field tables, and validation rules in this document
3. The implementation structure in `docs/basic-design.md`
4. `docs/examples/*.pert`
5. The displayed content of CLI help and future adapter help

When a discrepancy is found, do not patch only the lower-precedence artifact; synchronize the necessary artifacts and tests in the same change.

## 3. Design principles

- The language is line based.
- Indentation represents blocks.
- Top-level declarations are limited to `project`, `resource`, `milestone`,
  `task`, and `gate` through Grammar 4. Grammar 5 additionally accepts
  `work_event`; Grammar 6 additionally accepts `task_relation`, `plan_seal`,
  `task_outcome`, and `assurance_receipt`.
- Place task and gate endpoints in the header so that their nature as edges is visually apparent.
- Use stable IDs, rather than titles, for references.
- Field order and declaration order do not affect semantics.
- Do not silently ignore unknown fields or keywords.
- Preserve standalone comments and blank lines in the CST.
- Inline comments are not part of grammar version 1.
- The formatter and parser share the same grammar version.

## 4. Characters and files

### 4.1 encoding

- File encoding is UTF-8.
- A UTF-8 BOM is accepted only at the start of a file.
- A BOM has no semantic meaning and is preserved by source-preserving operations.
- The canonical serializer does not emit a BOM.
- An invalid UTF-8 byte sequence is a file-read error and is not passed to the parser.

### 4.2 line ending

- Accept LF and CRLF.
- Mixed LF and CRLF within one document is a warning.
- The parser accepts a final physical line without a line ending.
- The lexer may place a virtual `NEWLINE` immediately before EOF for grammar processing.
- The virtual `NEWLINE` has a source span of length zero.
- The source-preserving formatter retains the document's existing predominant line ending.
- The canonical serializer uses LF and a final newline.

### 4.3 source position

- Internal offsets, lines, and columns are zero based.
- Offsets and columns are measured in UTF-16 code units.
- CLI output converts lines and columns to one-based values.
- A span is the half-open interval `[start, end)`.
- Raw file digests and file sizes apply to UTF-8 byte sequences.

## 5. Indentation and whitespace

### 5.1 structural indentation

- Structural indentation uses ASCII spaces only.
- One level is two spaces.
- A top-level declaration begins at column 0.
- Declaration fields are indented two spaces.
- Child fields of `estimate` and `requires` are indented four spaces.
- Block-text content is indented at least two spaces more deeply than its owning field.
- A tab in syntax is a lexical error.
- A tab after the common indentation of block text may be preserved as text.
- A semantically meaningless over-indent deeper than the prescribed level is an error.

### 5.2 horizontal whitespace

In the EBNF, `HSPACE` denotes one or more ASCII spaces, and `OWS` denotes zero or more ASCII spaces.

- `HSPACE` is required between a keyword and its value.
- `HSPACE` is required on both sides of `->` in a task or gate header.
- Do not place a space immediately before a colon.
- Do not place a space immediately before a list comma.
- `OWS` is allowed after a list comma, after `[`, and before `]`.
- Trailing ASCII spaces on a syntax line are accepted but are warning candidates and removed by the formatter.
- Trailing spaces in block text are preserved as text.

### 5.3 blank line

- Blank lines are allowed at top level, in declaration bodies, and in estimate bodies.
- Spaces on a blank line do not affect structure.
- In source-preserving mode, the formatter retains blank-line positions and counts.

## 6. comment

### 6.1 syntax

A comment is a standalone line with `#` after the line's indentation.

```pert
# top-level comment
milestone READY:
  # field comment
  title "Preparation complete"
```

Rules:

- The content from `#` through immediately before the line ending is comment text.
- A comment is placed at the indentation of the current structural level.
- Inline comments are not allowed.
- A `#` in a quoted string is string content.
- A `#` in block text is block-text content.
- Comments are not included in the AST semantic model and are retained as CST trivia.
- Do not derive an ID, dependency, or state from a comment alone.

### 6.2 ownership

Source-preserving edits retain comment positions.

- Consecutive comments immediately before a declaration are that declaration's leading trivia.
- Consecutive comments at the same block level immediately before a field are that field's leading trivia.
- A comment after a declaration or field is standalone trivia at that position.
- When deleting an element, follow the leading-comment ownership rules in the [Mutation Semantics specification](mutation.md).

## 7. lexical token

### 7.1 Identifier

```ebnf
Identifier = ASCIIAlpha, { ASCIIAlpha | Digit | "-" | "_" } ;
ASCIIAlpha = "A" ... "Z" | "a" ... "z" ;
Digit      = "0" ... "9" ;
```

Rules:

- IDs are case-sensitive.
- Do not perform Unicode normalization.
- Entity IDs and endpoint references use the same lexical rule.
- Bare tags may use the same character set.
- An exactly lowercase reserved word cannot be used as an entity ID or endpoint ID.
- A reserved word may be used as a bare tag.

Reserved words:

```text
project resource milestone task gate
version title description as_of duration_unit velocity finish
critical_epsilon target_duration state tags
duration estimate optimistic most_likely pessimistic
status priority owner blocked_reason source reason
capacity requires
planned reached active blocked done
day hour point
```

### 7.2 Integer

```ebnf
Integer = Digit, { Digit } ;
```

- Signs and exponents are not allowed.
- In grammar version 1, Integer is used for `version`, resource `capacity`, task `priority`, and resource requirement quantities.
- Field validation accepts only the range 0..2147483647.
- Leading zeros are syntactically accepted but removed by the formatter.

### 7.3 Decimal

```ebnf
Decimal = Digit, { Digit }, [ ".", Digit, { Digit } ] ;
```

Valid:

- `0`
- `2`
- `0.5`
- `12.25`

Invalid:

- `.5`
- `2.`
- `+2`
- `-1`
- `1e3`
- `NaN`
- `Infinity`

Decimal is converted exactly from a finite decimal number to a Rational.

### 7.4 Duration

```ebnf
Duration = Decimal, DurationSuffix ;
DurationSuffix = "d" | "h" | "p" ;
```

- A suffix is required.
- Do not place a space between Decimal and its suffix.
- `d` corresponds to `duration_unit day`, `h` to `duration_unit hour`, and `p` to `duration_unit point`.
- `0d`, `0h`, and `0p` are lexically and syntactically valid.
- Field validation checks the positive-value requirement for task durations and estimates.
- A suffix that differs from the document's project unit is a semantic error.
- A source migration between Point and a linked time unit rewrites every
  base-unit Duration under the independently versioned
  [Unit Migration Semantics specification](unit-migration.md). Grammar version
  1 itself does not infer or apply that migration.

### 7.5 Velocity

```ebnf
Velocity = Decimal, "p", "/", Decimal, ( "d" | "h" ) ;
```

- Place exactly one `/` between the point quantity and duration quantity, with no spaces.
- Field validation requires both Decimals to be greater than zero.
- With `duration_unit point`, this is a required field, and the duration suffix determines the forecast unit.
- With `duration_unit day|hour`, this is optional, and the duration suffix must match the project unit.
- Velocity is a project-wide constant; per-task, per-resource, and per-period overrides are not included in grammar version 1.
- Retaining or explicitly replacing this constant during source-unit migration
  follows the Unit Migration Semantics specification. A read-only velocity
  forecast does not rewrite this field.

### 7.6 String

String uses the same double-quoted form as a JSON string literal.

```ebnf
String = '"', { StringCharacter | EscapeSequence }, '"' ;
EscapeSequence = "\\\"" | "\\\\" | "\\/" | "\\b" | "\\f"
               | "\\n" | "\\r" | "\\t" | UnicodeEscape ;
UnicodeEscape  = "\\u", HexDigit, HexDigit, HexDigit, HexDigit ;
```

Rules:

- A literal newline and U+0000..U+001F cannot occur directly in a string.
- Unicode characters may be written directly without escaping.
- An invalid escape is a lexical error.
- A `\uXXXX` escape that produces an unpaired surrogate is an error.
- Do not perform Unicode normalization on decoded strings.
- The canonical formatter uses JSON escaping.

### 7.7 ISO date/date-time

```ebnf
IsoDate     = Year, "-", Month, "-", Day ;
IsoDateTime = IsoDate, "T", Hour, ":", Minute, ":", Second,
              [ Fraction ], Offset ;
Fraction    = ".", Digit, { Digit } ;
Offset      = "Z" | ( "+" | "-" ), Hour, ":", Minute ;
Year        = Digit, Digit, Digit, Digit ;
Month       = Digit, Digit ;
Day         = Digit, Digit ;
Hour        = Digit, Digit ;
Minute      = Digit, Digit ;
Second      = Digit, Digit ;
```

Rules:

- A date or time that does not exist in the calendar is a field-validation error.
- Date-times write `T` and `Z` in uppercase.
- A local date-time without a time-zone offset is not allowed.
- Leap seconds are not allowed in grammar version 1.
- `as_of` accepts a date or date-time.

### 7.8 TagList

```ebnf
TagList = "[", OWS, [ Tag, { OWS, ",", OWS, Tag } ], OWS, "]" ;
Tag     = Identifier | String ;
```

- Both a bare Identifier and a String are normalized to a decoded string.
- The empty list `[]` is allowed.
- A trailing comma is not allowed.
- A duplicate tag is a semantic error.
- A tag safe as an ASCII Identifier may use bare notation in the canonical formatter.
- All other tags are emitted as Strings.

## 8. block text

### 8.1 syntax

Multiline text fields use the `|` marker.

```pert
description |
  First line
  Second line

  The fourth line follows a blank line
```

Rules:

- Nothing may follow `|` except trailing spaces.
- The next nonblank line is at least one level deeper than the owning field.
- Block text requires at least one line of nonblank content.
- The minimum indentation of nonblank lines in a block is the common indentation.
- Remove the common indentation from each nonblank line.
- Spaces or tabs deeper than the common indentation are retained as content.
- A blank line between nonblank content is retained as `\n`.
- A blank line immediately before the next structural line is structural trivia if no block content follows it.
- AST text joins lines with `\n` and does not retain a terminal newline.
- `#`, `:`, `->`, and quotes have no special meaning in block text.
- `FieldNode.valueSpan` for block text points to the `|` marker.
- `FieldNode.contentSpan` for valid block text runs from immediately after the common indentation of the first nonblank line through the end of the last nonblank line.
- Blank lines before the first nonblank content and after the last nonblank content are not included in decoded content and are retained as CST trivia.

### 8.2 TextValue

The following fields accept String or block text.

- `description`
- `blocked_reason`
- `reason`

`title`, `owner`, and `source` accept only String.

## 9. indentation token

The parser grammar uses the following tokens produced by the lexer.

- `NEWLINE`
- `INDENT`
- `DEDENT`
- `COMMENT`
- `BLOCK_TEXT`
- lexical token
- `EOF`

Rules:

- Generate `INDENT` where the structural level increases by one.
- Generate one `DEDENT` for each level returned.
- Indentation that increases by two or more levels at once is an error.
- Blank or comment lines alone do not modify the indentation stack.
- In block-text mode, do not convert content indentation to structural `INDENT` or `DEDENT`.
- After invalid indentation, recovery may proceed to the nearest valid lower level.

## 10. Complete EBNF

This EBNF applies to the token stream after indentation tokenization. Keywords are case-sensitive literals.

```ebnf
Document = Trivia, ProjectDecl,
           { Trivia, Declaration }, Trivia, EOF ;

Declaration = ResourceDecl | MilestoneDecl | TaskDecl | GateDecl ;

Trivia = { NEWLINE | CommentLine } ;
BlockTrivia = NEWLINE | CommentLine ;
CommentLine = COMMENT, NEWLINE ;

ProjectDecl = "project", HSPACE, Identifier, ":", NEWLINE,
              INDENT, ProjectEntry, { ProjectEntry }, DEDENT ;
ProjectEntry = BlockTrivia | ProjectField ;
ProjectField = VersionField
             | TitleField
             | DescriptionField
             | AsOfField
             | DurationUnitField
             | VelocityField
             | FinishField
             | CriticalEpsilonField
             | TargetDurationField ;

VersionField = "version", HSPACE, Integer, NEWLINE ;
TitleField = "title", HSPACE, String, NEWLINE ;
DescriptionField = "description", HSPACE, TextValue ;
AsOfField = "as_of", HSPACE, ( IsoDateTime | IsoDate ), NEWLINE ;
DurationUnitField = "duration_unit", HSPACE, ( "day" | "hour" | "point" ), NEWLINE ;
VelocityField = "velocity", HSPACE, Velocity, NEWLINE ;
FinishField = "finish", HSPACE, Identifier, NEWLINE ;
CriticalEpsilonField = "critical_epsilon", HSPACE, Duration, NEWLINE ;
TargetDurationField = "target_duration", HSPACE, Duration, NEWLINE ;

ResourceDecl = "resource", HSPACE, Identifier, ":", NEWLINE,
               INDENT, ResourceEntry, { ResourceEntry }, DEDENT ;
ResourceEntry = BlockTrivia | ResourceField ;
ResourceField = TitleField
              | DescriptionField
              | CapacityField
              | TagsField ;
CapacityField = "capacity", HSPACE, Integer, NEWLINE ;

MilestoneDecl = "milestone", HSPACE, Identifier, ":", NEWLINE,
                INDENT, MilestoneEntry, { MilestoneEntry }, DEDENT ;
MilestoneEntry = BlockTrivia | MilestoneField ;
MilestoneField = TitleField
               | DescriptionField
               | StateField
               | TagsField ;
StateField = "state", HSPACE, ( "planned" | "reached" ), NEWLINE ;
TagsField = "tags", HSPACE, TagList, NEWLINE ;

TaskDecl = "task", HSPACE, Identifier,
           HSPACE, Identifier, HSPACE, "->", HSPACE, Identifier,
           ":", NEWLINE,
           INDENT, TaskEntry, { TaskEntry }, DEDENT ;
TaskEntry = BlockTrivia | TaskField ;
TaskField = TitleField
          | DescriptionField
          | DurationField
          | EstimateField
          | StatusField
          | PriorityField
          | RequirementsField
          | OwnerField
          | TagsField
          | BlockedReasonField
          | SourceField ;
DurationField = "duration", HSPACE, Duration, NEWLINE ;
StatusField = "status", HSPACE,
              ( "planned" | "active" | "blocked" | "done" ), NEWLINE ;
PriorityField = "priority", HSPACE, Integer, NEWLINE ;
OwnerField = "owner", HSPACE, String, NEWLINE ;
BlockedReasonField = "blocked_reason", HSPACE, TextValue ;
SourceField = "source", HSPACE, String, NEWLINE ;

EstimateField = "estimate", ":", NEWLINE,
                INDENT, EstimateEntry, { EstimateEntry }, DEDENT ;
EstimateEntry = BlockTrivia | EstimateValueField ;
EstimateValueField = OptimisticField | MostLikelyField | PessimisticField ;
OptimisticField = "optimistic", HSPACE, Duration, NEWLINE ;
MostLikelyField = "most_likely", HSPACE, Duration, NEWLINE ;
PessimisticField = "pessimistic", HSPACE, Duration, NEWLINE ;

RequirementsField = "requires", ":", NEWLINE,
                    INDENT, RequirementEntry, { RequirementEntry }, DEDENT ;
RequirementEntry = BlockTrivia | ResourceRequirement ;
ResourceRequirement = Identifier, HSPACE, Integer, NEWLINE ;

GateDecl = "gate", HSPACE, Identifier,
           HSPACE, Identifier, HSPACE, "->", HSPACE, Identifier,
           ":", NEWLINE,
           INDENT, GateEntry, { GateEntry }, DEDENT ;
GateEntry = BlockTrivia | GateField ;
GateField = ReasonField ;
ReasonField = "reason", HSPACE, TextValue ;

TextValue = String, NEWLINE | "|", NEWLINE, BLOCK_TEXT ;

TagList = "[", OWS, [ Tag, { OWS, ",", OWS, Tag } ], OWS, "]" ;
Tag = Identifier | String ;

Duration = Decimal, ( "d" | "h" | "p" ) ;
Velocity = Decimal, "p", "/", Decimal, ( "d" | "h" ) ;
Decimal = Digit, { Digit }, [ ".", Digit, { Digit } ] ;
Integer = Digit, { Digit } ;
Identifier = ASCIIAlpha, { ASCIIAlpha | Digit | "-" | "_" } ;

HSPACE = " ", { " " } ;
OWS = { " " } ;
```

`String`, `IsoDate`, `IsoDateTime`, and `BLOCK_TEXT` follow the lexical rules in the preceding sections.

## 11. Document rules

### 11.1 Top level

- Exactly one `project` is required.
- `project` must be the first declaration excluding trivia.
- Any number of resources, milestones, tasks, and gates may follow the project.
- A document must not contain two or more projects.
- A resource, milestone, task, or gate must not precede the project.
- A field or estimate must not appear directly at the top level.
- Grammar version 1 does not include include/import directives.

### 11.2 Declarations

- Forward references are allowed.
- An endpoint milestone may be declared after its task or gate.
- Declaration order does not affect semantics.
- Parallel edges are allowed when tasks or gates have the same from/to pair.
- Entity IDs must be unique across the entire document, including projects, resources, milestones, tasks, and gates.
- An endpoint may refer only to a milestone ID.
- A task resource requirement may refer only to a resource ID.
- Resource requirements are sharing/capacity constraints and are not converted into DAG precedence edges.
- Titles and IDs are distinct; titles are not used for reference resolution.

## 12. Field tables

### 12.1 Project

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `version` | 0..1 | Integer | Defaults to 1. The v1 parser accepts only 1. |
| `title` | 1 | String | Decoded text is nonempty. |
| `description` | 0..1 | TextValue | Nonempty when specified. |
| `as_of` | 0..1 | ISO date/date-time | An existing date/time. |
| `duration_unit` | 1 | `day`, `hour`, or `point` | Matches duration suffixes in the document. |
| `velocity` | 0..1 | Velocity | Required for `point`. A positive point amount per positive period amount. |
| `finish` | 1 | Identifier | Refers to a milestone. |
| `critical_epsilon` | 0..1 | Duration | Defaults to zero in the project unit. Zero or greater. |
| `target_duration` | 0..1 | Duration | Greater than zero when specified. |

### 12.2 Resource

A resource represents a renewable resource that is held while a task executes and returned when it completes.

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `title` | 1 | String | Nonempty. |
| `description` | 0..1 | TextValue | Nonempty when specified. |
| `capacity` | 1 | Integer | At least 1. `1` is an exclusive resource. |
| `tags` | 0..1 | TagList | Defaults to empty. Duplicates are not allowed. |

### 12.3 Milestone

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `title` | 1 | String | Nonempty. |
| `description` | 0..1 | TextValue | Nonempty when specified. |
| `state` | 0..1 | `planned` or `reached` | Defaults to `planned`. |
| `tags` | 0..1 | TagList | Defaults to empty. Duplicates are not allowed. |

### 12.4 Task

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `title` | 1 | String | Nonempty. |
| `description` | 0..1 | TextValue | Nonempty when specified. |
| `duration` | 0..1 | Duration | Mutually exclusive with estimate. Greater than zero. |
| `estimate` | 0..1 | Estimate block | Mutually exclusive with duration. Exactly one is required. |
| `status` | 0..1 | task status | Defaults to `planned`. |
| `priority` | 0..1 | Integer | Defaults to 0. Higher values are preferred by the resource schedule. |
| `requires` | 0..1 | Requirements block | Defaults to no resource reservation. |
| `owner` | 0..1 | String | Nonempty when specified. |
| `tags` | 0..1 | TagList | Defaults to empty. Duplicates are not allowed. |
| `blocked_reason` | 0..1 | TextValue | Required when status=blocked; forbidden otherwise. |
| `source` | 0..1 | String | Nonempty when specified. Does not access the network. |

A task has exactly one of `duration` or `estimate`.

Each line of `requires` has the form `<resource-id> <units>`.

```pert
requires:
  TEST_DEVICE 1
  DEVELOPERS 2
```

Rules:

- A `requires` block contains one or more resource requirements.
- Units are an integer of at least 1.
- The same resource ID must not be specified more than once in a task.
- Units must not exceed the capacity of the referenced resource.
- A task may start only when it can acquire all declared resources simultaneously.
- A task holds its resources for its whole execution interval and returns all units upon completion.
- Grammar version 1 does not express preemption, mid-task allocation changes, or consumable resources.

### 12.5 Estimate

| Field | Count | Constraint |
| --- | ---: | --- |
| `optimistic` | 1 | Zero or greater. |
| `most_likely` | 1 | Zero or greater. |
| `pessimistic` | 1 | Zero or greater. |

Additional constraints:

- `optimistic <= most_likely <= pessimistic`
- `pessimistic > 0`
- The three fields use the same suffix.
- Field order is arbitrary.

### 12.6 Gate

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `reason` | 1 | TextValue | Nonempty. |

A gate cannot have `duration`, `estimate`, or `status`.

## 13. Boundary between syntax and semantic validation

### 13.1 Parser-detected conditions

- Missing keyword, colon, arrow, bracket, or comma.
- A header that does not begin a block.
- An invalid indentation level.
- Tab indentation.
- An invalid Identifier, String, Decimal, Duration, or date token.
- An unknown top-level keyword.
- An unknown field not permitted in a block.
- An unknown value in a closed enum.
- An inline comment.
- Invalid block-text indentation.

### 13.2 Field-validator-detected conditions

- A missing required field.
- A duplicate field.
- A duration/estimate exclusivity violation.
- Missing or duplicate estimate fields, or a violation of their ordering constraints.
- A zero/positive constraint violation.
- A nonempty-text constraint violation.
- An inconsistency between `blocked_reason` and status.
- A duplicate tag.
- An Integer constraint on resource capacity, task priority, or requirement units.
- A duplicate resource requirement in one task.
- A mismatch between the project unit and a duration suffix.
- A point project missing velocity, zero velocity, or a period-suffix mismatch with a time project.
- A version mismatch.
- An invalid calendar `as_of` value.

### 13.3 Conditions passed to the graph validator

- A duplicate entity ID.
- A reserved-word ID.
- An undefined endpoint or finish.
- An undefined resource reference.
- A resource requirement that exceeds capacity.
- An endpoint kind mismatch.
- A self-loop.
- A cycle.
- Finish outdegree.
- Finish reachability.
- Root/reached state.
- The reached-start condition for an active/done task.
- A contradiction between a reached milestone and an unfinished incoming edge.

An analyzable Graph must not be generated from a document with parse or field-validation errors.

## 14. Initial diagnostic codes

| Code | Meaning | Help topic |
| --- | --- | --- |
| `PTDSL-001` | Tab used for structural indentation | `syntax.indentation` |
| `PTDSL-002` | Invalid indentation width/level | `syntax.indentation` |
| `PTDSL-003` | Invalid top-level declaration | `syntax.top-level` |
| `PTDSL-004` | Invalid declaration header | `syntax` |
| `PTDSL-005` | Unknown field | Applicable `syntax.*` |
| `PTDSL-006` | Invalid string/escape | `syntax.string` |
| `PTDSL-007` | Invalid duration/velocity/decimal | `syntax.duration` or `syntax.velocity` |
| `PTDSL-008` | Invalid date/date-time | `syntax.project` or `syntax.temporal` |
| `PTDSL-009` | Invalid list | `syntax.tags` |
| `PTDSL-010` | Invalid block text | `syntax.text` |
| `PTDSL-011` | Inline comment | `syntax.comments` |
| `PTDSL-012` | Unknown value in a closed enum | Applicable `syntax.*` |
| `PTSEM-101` | Missing required field | Applicable `syntax.*` |
| `PTSEM-102` | Duplicate field | Applicable `syntax.*` |
| `PTSEM-103` | Invalid field combination | Applicable `syntax.*` |
| `PTSEM-104` | Invalid duration/estimate constraint | `syntax.duration` |
| `PTSEM-105` | Project unit mismatch | `syntax.duration` |
| `PTSEM-106` | Empty text | Applicable `syntax.*` |
| `PTSEM-107` | Duplicate tag | `syntax.tags` |
| `PTSEM-108` | Unsupported grammar version | `syntax.project` |
| `PTSEM-109` | Invalid positive/range constraint for resource capacity or requirement units | `syntax.resource` |
| `PTSEM-110` | Duplicate resource requirement | `syntax.task` |
| `PTSEM-111` | Invalid velocity constraint | `syntax.velocity` |
| `PTSEM-112` | Grammar v2/v3 temporal field without `project.as_of` | `syntax.temporal` |
| `PTSEM-113` | Duplicate principal in one governance delegate list | `syntax.project` |
| `PTSEM-114` | Deprecated `duration_unit day|hour`; migrate to Point estimates | `editing.unit-migration` |

Graph diagnostic codes are fixed by the [Graph Semantics specification](graph-semantics.md).

## 15. Source spans

The parser/CST retains the following spans:

- document
- Whole declaration
- declaration keyword
- entity ID
- Task/gate from ID
- arrow
- Task/gate to ID
- Whole field
- field keyword
- field value
- Whole estimate block and each child field
- Whole requirements block and each resource requirement
- comment
- Block-text marker and content

Rules:

- A diagnostic primary span identifies the smallest token/field that needs correction.
- A missing token uses a zero-length span at its insertion point.
- For a duplicate field/ID, the later declaration is primary and the earlier declaration is a related location.
- An invalid endpoint identifies the endpoint token.
- A block-indentation error identifies the leading whitespace.

## 16. Error recovery

The parser does not discard the entire document for one error and reports independent problems where possible.

### 16.1 Top-level recovery

- An invalid top-level line is skipped through the next known declaration header at column 0.
- If an invalid line ends in a colon, its following indented block is also skipped as the same error region.
- Lines within the same error region are not redundantly reported as individual top-level/indentation errors.
- Even without a project, following declarations can be collected in a recovery AST.

### 16.2 Declaration recovery

- An invalid field line synchronizes at the next same-level field, comment, or blank line in the current block.
- If an invalid field starts a nested block, it is skipped through its DEDENT.
- An unknown nested block returns one `PTDSL-005` at the block name and does not diagnose child lines individually.
- Within `estimate`/`requires`, recovery synchronizes at the next entry at the four-space level or the owning block's DEDENT.
- A block-text error synchronizes at the next structural line of its owning field.

### 16.3 Suppression

- A parser error for the same token caused by a lexical error is not reported redundantly.
- Do not add required-field errors for a declaration whose header cannot be recovered.
- Do not add a positive/unit-mismatch error for an invalid duration token.
- For a document with one or more parse errors, do not run the field validator or graph validator, and do not add derived `PTSEM-*`/`PTDAG-*` diagnostics.
- Do not generate graph diagnostics for a document with parse errors.
- A caller may set the maximum number of diagnostics with `maxDiagnostics`, from 1 through 1000; the default is 100.
- A `ParseResult`/`CheckResult` that exceeds the limit returns `diagnosticsTruncated=true`, and CLI JSON returns `diagnostics_truncated=true`.

## 17. Formatter contract

### 17.1 Source-preserving formatting

For an existing `.pert`, `dsl format` preserves the following:

- declaration order
- field order
- Comment text and relative positions
- Blank-line positions and count
- Decoded block-text content
- Presence or absence of a BOM
- Predominant line ending

The predominant line ending is the more frequent of LF and CRLF; on a tie, it is the first line ending seen; without a line ending, it is LF. Core `formatDocument` performs no I/O, diff, or write, and returns non-overlapping `TextEdit`s at 0-based UTF-16 offsets together with a candidate document.

It normalizes the following:

- Structural indentation to two spaces
- Spacing between tokens
- Spacing around arrows
- Spacing around colons, commas, and brackets
- Removal of trailing space from syntax lines
- Unnecessary leading/trailing zeroes in Decimal values
- Grammar version 3 Duration tokens according to the exact canonical
  serializer in Section 20.2
- String escapes
- A final newline

A document with parse/field-validation errors must not be written with `--write`. Any future preview-only recovery formatting is a separate action.

### 17.2 Canonical serializer

Use the canonical serializer for new generation, Mermaid import, and AST-fixture generation.

Field order:

```text
project:
  version, title, description, as_of, duration_unit, velocity, finish,
  critical_epsilon, target_duration

milestone:
  title, description, state, tags

resource:
  title, description, capacity, tags

task:
  title, description, duration|estimate, status, priority, requires,
  owner, tags,
  blocked_reason, source

estimate:
  optimistic, most_likely, pessimistic

gate:
  reason
```

Declaration order:

1. project
2. Resources in lexical ID order
3. Milestones in lexical ID order
4. Tasks/gates in edge-ID lexical order

Other rules:

- Indentation is two spaces.
- Line endings are LF.
- The file has a final newline.
- One blank line separates top-level declarations.
- Empty optional fields are not emitted.
- The canonical serializer may omit default fields, except source formatting preserves values explicitly provided by a user.

### 17.3 Idempotence

For a valid document `x`, the following holds:

```text
format(format(x)) == format(x)
AST(parse(format(x))) == AST(parse(x))
```

## 18. Valid example

```pert
project SAMPLE:
  version 1
  title "Sample"
  description |
    A representative grammar-specification example.
    A task is written as an edge.
  as_of 2026-07-21
  duration_unit day
  finish RELEASED
  critical_epsilon 0d
  target_duration 10d

resource DEVELOPERS:
  title "Developers"
  capacity 2

resource TEST_DEVICE:
  title "Test device"
  capacity 1

milestone NOW:
  title "Current"
  state reached

milestone DESIGNED:
  title "Design complete"

milestone RELEASED:
  title "Released"

task DESIGN NOW -> DESIGNED:
  title "Design"
  estimate:
    optimistic 1d
    most_likely 2d
    pessimistic 4d
  status active
  priority 10
  requires:
    DEVELOPERS 1
  owner "team-a"
  tags [design, "important"]

task RELEASE DESIGNED -> RELEASED:
  title "Release"
  duration 1d
  requires:
    DEVELOPERS 1
    TEST_DEVICE 1
```

## 19. Invalid examples

### 19.1 Indentation

```pert
milestone BAD:
   title "3 spaces"
```

Expected: `PTDSL-002`.

### 19.2 Inline comment

```pert
task BAD START -> END:
  title "inline comment"
  duration 2d # unsupported
```

Expected: `PTDSL-011`.

### 19.3 Task field combination

```pert
task BAD START -> END:
  title "Both specified"
  duration 2d
  estimate:
    optimistic 1d
    most_likely 2d
    pessimistic 3d
```

Expected: `PTSEM-103`.

### 19.4 Resource capacity

```pert
resource DEVICE:
  title "Test device"
  capacity 1

task BAD START -> END:
  title "Two devices required simultaneously"
  duration 1d
  requires:
    DEVICE 2
```

Expected: `PTSEM-109`.

### 19.5 Blocked reason

```pert
task BAD START -> END:
  title "Blocked without a reason"
  duration 1d
  status blocked
```

Expected: `PTSEM-103`.

## 20. Grammar version

- An omitted version is interpreted as version 1.
- A version 1 parser accepts only `version 1`.
- Do not silently interpret a newer version as version 1.
- For a grammar-breaking change, provide a project version and a migration
  procedure.
- Update help, examples, fixtures, and formatter in the same change as a grammar version.
- Explicitly state tool-version compatibility, recognizing that even a minor field addition causes older parsers to reject the unknown field.

### 20.1 Grammar version 2 temporal delta

Grammar version 2 is selected only by an explicit `version 2`. It adds:

```ebnf
DeadlineField  = "deadline", HSPACE, ( IsoDateTime | IsoDate ), NEWLINE ;
NotBeforeField = "not_before", HSPACE, ( IsoDateTime | IsoDate ), NEWLINE ;

MilestoneFieldV2 = MilestoneField | DeadlineField ;
TaskFieldV2      = TaskField | NotBeforeField | DeadlineField ;
```

`deadline` and `not_before` are contextual field keywords rather than global
reserved IDs. The version 1 reserved-word set and valid entity IDs remain
unchanged.

| Entity | Field | Count | Value | Constraint |
| --- | --- | ---: | --- | --- |
| milestone | `deadline` | 0..1 | ISO date/date-time | Latest desired reach; not a dependency or hard cap |
| task | `not_before` | 0..1 | ISO date/date-time | Earliest permitted start for a new start |
| task | `deadline` | 0..1 | ISO date/date-time | Latest desired finish; not a hard cap |

A version 2 document with at least one `deadline` or `not_before` requires
`project.as_of`; absence is `PTSEM-112`. Mixed date/date-time kinds remain a
valid document and produce an unavailable temporal relationship rather than a
validation error. Temporal fields on active/done tasks and reached milestones
remain valid declared source even when their operation is not applicable or
historical compliance is unavailable.

Grammar version 2 canonical field order is:

```text
milestone:
  title, description, state, deadline, tags

task:
  title, description, duration|estimate, not_before, deadline, status,
  priority, requires, owner, tags, blocked_reason, source
```

All other EBNF, field tables, validation phases, spans, recovery, and
source-preserving formatting rules remain those of version 1. Version 1
rejects the added fields as `PTDSL-005`.

Unit migration version 1 supports versions 1 and 2 because the version 2
delta adds no base-unit-bearing field. It preserves `as_of`, `deadline`, and
`not_before` tokens and does not change the project grammar version. Its
finite-Decimal-only behavior remains the accepted historical version 1
contract.

### 20.2 Grammar version 3 exact Duration delta

Grammar version 3 is selected only by an explicit `version 3`. It inherits
every grammar version 2 field, validation rule, contextual keyword, and
canonical field order, and changes only the accepted `Duration` value syntax:

```ebnf
DurationV3              = ( Decimal | DurationFraction ), DurationSuffix ;
DurationFraction        = DurationFractionInteger, "/",
                          DurationFractionInteger ;
DurationFractionInteger = Digit, { Digit } ;
```

Rules:

- The numerator and denominator are unsigned base-10 integers. Signs,
  exponents, decimal points, whitespace, and a second slash are not accepted
  inside a DurationFraction.
- The denominator must be greater than zero. A zero denominator is an invalid
  Duration token and reports `PTDSL-007`; it does not reach Rational
  arithmetic.
- Fraction components use arbitrary-precision integer semantics and are not
  subject to the 32-bit field constraint for resource capacity or priority.
- The numerator may be zero. `0/7d` denotes the exact same Rational as `0d`.
- A valid Fraction is reduced to one normalized Rational for semantic
  validation and analysis. The source token and span remain available to
  source-preserving operations.
- The existing suffix, project-unit, positivity, and PERT estimate-order rules
  apply to the normalized Rational without change.
- Velocity remains the Decimal-only syntax in Section 7.5. Fraction Duration
  does not introduce an ambiguous fraction form for velocity.

Canonical Duration serialization is deterministic:

1. reduce the Rational with a positive denominator;
2. if the denominator has only prime factors 2 and 5, emit the shortest exact
   Decimal followed by the suffix;
3. otherwise emit `numerator/denominator` in reduced form followed by the
   suffix; and
4. emit exact zero as `0` followed by the suffix.

The explicit formatter applies this canonical spelling to Decimal and
Fraction Duration tokens. Source-preserving mutations and migration retain an
unrelated valid token byte-for-byte and use the canonical serializer only for
new or replaced Duration values.

Unit migration version 2 accepts grammar versions 1, 2, and 3. A version 1 or
2 candidate remains at its source grammar version when every generated token
is a finite Decimal. If at least one generated token requires a Fraction, the
same atomic candidate sets the project to version 3. A version 3 source is
never downgraded automatically.

### 20.3 Grammar version 4 governance delta

Grammar version 4 is selected only by an explicit `version 4`. It inherits
every grammar version 3 declaration, temporal field, exact Duration form,
validation rule, contextual keyword, and canonical field order. It adds:

```ebnf
PrincipalId         = Identifier ;
PrincipalList       = "[", OWS,
                      [ PrincipalId,
                        { OWS, ",", OWS, PrincipalId } ],
                      OWS, "]" ;
GoalOwnerField      = "goal_owner", HSPACE, PrincipalId, NEWLINE ;
GoalDelegatesField  = "goal_delegates", HSPACE, PrincipalList, NEWLINE ;
DagOwnerField       = "dag_owner", HSPACE, PrincipalId, NEWLINE ;
DagDelegatesField   = "dag_delegates", HSPACE, PrincipalList, NEWLINE ;

ProjectFieldV4 = ProjectField
               | GoalOwnerField
               | GoalDelegatesField
               | DagOwnerField
               | DagDelegatesField ;
```

The four field spellings are contextual project-field keywords rather than
global reserved IDs. Existing entity and endpoint identifiers accepted by
Grammar 1, 2, or 3 remain accepted. A principal uses the Identifier character
form, compares case-sensitively without Unicode normalization, and may use a
spelling that is reserved only for an entity ID.

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `goal_owner` | 0..1 | PrincipalId | Effective default `user` |
| `goal_delegates` | 0..1 | PrincipalList | Effective default empty; no duplicates |
| `dag_owner` | 0..1 | PrincipalId | Effective default `user` |
| `dag_delegates` | 0..1 | PrincipalList | Effective default empty; no duplicates |

An empty principal list is valid. A duplicate exact principal ID in one list
is `PTSEM-113`; source order otherwise has no authority meaning.

Grammar version 4 canonical project-field order is:

```text
version, title, description, as_of, duration_unit, velocity, finish,
goal_owner, goal_delegates, dag_owner, dag_delegates,
critical_epsilon, target_duration
```

Grammar versions 1, 2, and 3 reject governance fields as `PTDSL-005`.
Existing documents require no source migration because omitted governance
metadata has effective `user` owners and empty delegate sets. Adding any
governance field to an older source atomically sets `project.version` to `4`.
Clearing the last governance field does not automatically downgrade the
document. An explicit downgrade is valid only when no governance field remains
and the final candidate is accepted by the selected older grammar.

The complete principal, declared/effective metadata, source-preservation,
project-init/show, pre-change snapshot, and adapter boundaries are normative
in the [Governance Source and Effective-Metadata
specification](governance-source.md).

### 20.4 Grammar version 5 project-actuals delta

Grammar version 5 is selected only by an explicit `version 5`. It inherits
every Grammar 4 declaration, temporal field, exact Duration form, governance
field, validation rule, contextual keyword, and canonical field order. It
adds the top-level `work_event` evidence declaration and task status
`suspended`.

```ebnf
ExactUnsignedV5 = Decimal | DurationFraction ;
EventDateTimeV5 = IsoDate, "T", Hour, ":", Minute, ":", Second,
                  [ Fraction ], NumericOffsetV5 ;
NumericOffsetV5 = ( "+" | "-" ), Hour, ":", Minute ;
ActiveHoursV5 = ExactUnsignedV5, "h" ;
PersonHoursV5 = ExactUnsignedV5, "ph" ;

WorkEventDeclV5 = "work_event", HSPACE, Identifier, ":", NEWLINE,
                  INDENT, WorkEventEntryV5,
                  { WorkEventEntryV5 }, DEDENT ;
WorkEventEntryV5 = BlockTrivia | WorkEventFieldV5 ;
WorkEventFieldV5 = EventModelFieldV5
                 | EventTaskFieldV5
                 | EventKindFieldV5
                 | OccurredAtFieldV5
                 | PlannedValueFieldV5
                 | ActiveTimeFieldV5
                 | EffortFieldV5
                 | ReasonField ;
EventModelFieldV5 = "model", HSPACE, Integer, NEWLINE ;
EventTaskFieldV5 = "task", HSPACE, Identifier, NEWLINE ;
EventKindFieldV5 = "kind", HSPACE,
                   ( "start" | "suspend" | "resume" | "finish" ),
                   NEWLINE ;
OccurredAtFieldV5 = "occurred_at", HSPACE, EventDateTimeV5, NEWLINE ;
PlannedValueFieldV5 = "planned_value", HSPACE, DurationV3, NEWLINE ;
ActiveTimeFieldV5 = "active_time", HSPACE, ActiveHoursV5, NEWLINE ;
EffortFieldV5 = "effort", HSPACE, PersonHoursV5, NEWLINE ;

StatusFieldV5 = "status", HSPACE,
                ( "planned" | "active" | "blocked" | "suspended" | "done" ),
                NEWLINE ;
ProjectEntryV5 = BlockTrivia | ProjectFieldV4 ;
ProjectDeclV5 = "project", HSPACE, Identifier, ":", NEWLINE,
                INDENT, ProjectEntryV5, { ProjectEntryV5 }, DEDENT ;
MilestoneFieldV5 = MilestoneField | DeadlineField ;
MilestoneEntryV5 = BlockTrivia | MilestoneFieldV5 ;
MilestoneDeclV5 = "milestone", HSPACE, Identifier, ":", NEWLINE,
                  INDENT, MilestoneEntryV5,
                  { MilestoneEntryV5 }, DEDENT ;
TaskFieldV5 = TitleField
            | DescriptionField
            | DurationField
            | EstimateField
            | NotBeforeField
            | DeadlineField
            | StatusFieldV5
            | PriorityField
            | RequirementsField
            | OwnerField
            | TagsField
            | BlockedReasonField
            | SourceField ;
TaskEntryV5 = BlockTrivia | TaskFieldV5 ;
TaskDeclV5 = "task", HSPACE, Identifier,
             HSPACE, Identifier, HSPACE, "->", HSPACE, Identifier,
             ":", NEWLINE,
             INDENT, TaskEntryV5, { TaskEntryV5 }, DEDENT ;

DeclarationV5 = ResourceDecl | MilestoneDeclV5 | TaskDeclV5 | GateDecl
              | WorkEventDeclV5 ;
DocumentV5 = Trivia, ProjectDeclV5,
             { Trivia, DeclarationV5 }, Trivia, EOF ;
```

`work_event`, `model`, `kind`, `occurred_at`, `planned_value`,
`active_time`, `effort`, `start`, `suspend`, `resume`, `finish`,
`suspended`, and `ph` are contextual in the positions above. They do not
expand the Grammar 1 reserved-ID set. Grammar 1 through 4 retain their
existing entity-ID acceptance and reject a top-level `work_event` as
`PTDSL-003` and a `suspended` status value as `PTDSL-012`.

Every `work_event` has exactly one each of `model`, `task`, `kind`, and
`occurred_at`. Model 1 is the only accepted event model. A different model is
`PTACT-101` with cause `unsupported_event_model`.

The kind-specific field matrix is normative.

| Kind | `planned_value` | `active_time` | `effort` | `reason` |
| --- | --- | --- | --- | --- |
| `start` | exactly 1 | forbidden | forbidden | forbidden |
| `suspend` | forbidden | forbidden | forbidden | 0..1 |
| `resume` | forbidden | forbidden | forbidden | forbidden |
| `finish` | forbidden | 0..1 | 0..1 | forbidden |

`planned_value` uses the document base-unit suffix and may be zero.
`active_time` is an exact non-negative number of elapsed hours. `effort` is
an exact non-negative number of person-hours. Decimal and Fraction forms use
the Grammar 3 exact parsing and canonicalization rules. A zero denominator is
`PTDSL-007`; signs, exponents, spaces inside a Fraction, and negative values
are not accepted.

An event date-time requires a numeric offset. `Z`, a date-only value, a local
date-time, and `-00:00` are `PTDSL-008`. Calendar fields, offset range, and
instant comparison otherwise use the active fixed-offset calendar rules.
Source-preserving operations retain the declared token. Canonical generation
removes a zero fractional second, removes trailing fractional zeroes, retains
the declared numeric offset, and emits UTC as `+00:00`.

Work-event IDs share the global document ID namespace. The `task` field must
resolve to a task; another entity kind or a missing ID is `PTACT-102`.
`planned_value` must equal the exact expected value of the referenced task in
the project base unit at the candidate's first start. Kind/field mismatch or
an unequal planned value is `PTACT-103`. Sequence, stored-state, identity,
measurement, and resource rules are defined by the
[Project Actuals and Git History Contract](project-actuals.md).

Grammar 5 canonical work-event field order is:

```text
model, task, kind, occurred_at, planned_value, active_time, effort, reason
```

Canonical declaration order is project, resources, milestones, task/gate
edges, then work events. Existing source declaration order remains preserved.
New work events append after the last declaration in event-ID order only when
one request creates more than one event. A work event owns its indented field
comments. The ordinary leading-comment rule applies to the whole declaration;
removing an event removes only its owned leading comments and body.

Adding a work event or `suspended` state to an older source atomically sets
`project.version` to `5`. A Grammar 5 document is never downgraded
automatically. An explicit downgrade is valid only when no work event or
`suspended` state remains and the complete candidate is valid under the
selected older grammar.

Unit migration version 3 accepts Grammar 5 and converts every
`work_event.planned_value` together with the existing base-unit inventory.
It never converts `occurred_at`, `active_time`, `effort`, or `reason`, retains
Grammar 5, and never removes actual evidence. Unit migration versions 1 and 2
reject Grammar 5 as unsupported.

### 20.5 Grammar version 6 plan-assurance delta

Grammar version 6 is selected by an explicit `version 6` or by the atomic
`plan-assurance seal` migration. It inherits every Grammar 5 declaration,
field, exact-value form, validation rule, contextual keyword, and source
ownership rule. It adds the paired project fields `plan_assurance_model` and
`plan_assurance_hash_model` and the top-level `task_relation`, `plan_seal`,
`task_outcome`, and `assurance_receipt` declarations.

Sections 2.1 through 2.6 of the [Plan Assurance Interface
Contract](plan-assurance-interface.md) are the normative Grammar 6 EBNF,
field-presence matrix, nested-entry syntax, canonical field order, contextual
keyword, global-ID, task-reference, digest-token, and source-ownership delta.
The semantic hash recurrence, dependency-mode validity, receipt self-hash, and
outcome meaning are owned by the [Conditional Plan Assurance
Contract](plan-assurance.md).

Grammar 1 through 5 reject the new project fields and declarations without
expanding their reserved-ID sets. Grammar 6 without the paired model fields is
valid with assurance coverage `not_enabled`. When either model field is
present, both are required. Model 1 accepts only value `1`; an unknown positive
model value is preserved but its assurance projection is `unavailable`.

Generic formatting, project metadata, unit migration, actuals history, mixed
batch, and Mermaid operations validate the complete Grammar 6 source and
candidate. Unit migration never downgrades Grammar 6 and preserves every
assurance-owned declaration byte-semantically. Semantic Mermaid profile 2 is
the lossless Grammar 6 carrier; profile 1 or plain output is lossy and requires
the non-strict conversion boundary.

### 20.6 Grammar version 7 milestone-acceptance delta

Grammar version 7 is selected only by the committed-source
`document migrate --target-grammar 7` workflow. It inherits every Grammar 6
declaration, field, exact-value form, validation rule, contextual keyword,
and source-ownership rule. It adds the top-level
`milestone_criterion_set`, `milestone_acceptance_receipt`, and
`milestone_acceptance_migration` declarations.

Sections 4, 5, and 7 of the [Milestone Outcome Acceptance
Contract](milestone-acceptance.md) are the normative Grammar 7 field-presence,
canonical-order, commitment, receipt, migration-provenance, source-ownership,
and semantic-validation delta. Grammar 1 through 6 reject these declarations
without expanding their reserved-ID sets. Grammar 7 formatting and unrelated
source-preserving operations retain acceptance-owned semantics, while
criterion replacement, receipt mutation, and canonical advance use their
dedicated Contract 8 guards.

### 20.7 Grammar version 8 calendar-aware temporal target

The accepted but inactive Grammar 8 target is owned in full by the
[Calendar-Aware Temporal Scheduling Contract](temporal-schedule.md). This
document does not duplicate that target EBNF as a second additive temporal
delta. Grammar 7 and CLI Contract 8 remain the active runtime until the
dependency-ordered public-contract task atomically activates the target and
synchronizes this active grammar, Help, Guide, schemas, and migration surface.

## 21. Grammar acceptance

At minimum, a parser implementation automatically checks the following:

1. Parses this specification's valid example.
2. Parses `docs/examples/minimal.pert`.
3. Parses `docs/examples/parallel.pert`.
4. Independently checks every project/resource/milestone/task/gate field.
5. Rejects invalid indentation, string, duration, list, and date values.
6. Distinguishes missing, duplicate, and unknown fields.
7. Checks duration/estimate exclusivity.
8. Preserves comments and blank lines in a CST round trip.
9. Preserves block-text paragraphs and common indentation.
10. Matches source spans in UTF-16 code units.
11. Returns multiple independent errors during error recovery, suppresses duplicate diagnostics for the same error region and derived diagnostics from later phases, and indicates when the limit is exceeded.
12. Keeps the formatter idempotent and AST-equivalent.
13. Detects drift between help samples and parser fixtures.
14. Parses and validates resource capacity, `requires`, and priority.
15. Keeps version 1 behavior closed while version 2 accepts exactly the three
    temporal fields and requires an explicit anchor.
16. Treats `deadline` and `not_before` as contextual fields without invalidating
    an existing entity ID that uses either spelling.
17. Keeps grammar version 2 Duration acceptance finite-Decimal-only while
    grammar version 3 accepts Decimal or exact Fraction Duration.
18. Rejects zero denominators, signs, whitespace, exponents, decimal fraction
    components, and multiple slashes as `PTDSL-007`.
19. Canonicalizes terminating Rationals to the shortest Decimal and all other
    Rationals to a reduced Fraction without rounding.
20. Preserves unrelated valid Fraction tokens in source-preserving operations
    and retains exact Rational equivalence across explicit formatting.
21. Keeps Grammar 1, 2, and 3 behavior closed while Grammar 4 accepts exactly
    the four governance project fields under an explicit version.
22. Treats governance field spellings as contextual without invalidating
    existing entity IDs.
23. Rejects duplicate delegates with `PTSEM-113`, retains valid principal-list
    source order, and derives omission defaults without rewriting the source.
24. Adds governance metadata to an older grammar only through one atomic
    Grammar 4 candidate and never downgrades Grammar 4 automatically.
25. Keeps Grammar 1 through 4 behavior closed while Grammar 5 accepts exactly
    `work_event` declarations and the `suspended` status.
26. Treats every Grammar 5 spelling as contextual outside its declared
    position and preserves older valid entity IDs.
27. Validates model, task ownership, exact kind/field presence, numeric-offset
    event time, planned-value equality, exact hours, and exact person-hours.
28. Preserves work-event comments and unrelated source bytes, emits the
    canonical field order, and keeps explicit formatting idempotent.
29. Adds actuals source only through one valid Grammar 5 candidate and never
    downgrades Grammar 5 automatically.
30. Includes `work_event.planned_value` in unit migration version 3 while
    preserving event time, active time, effort, reason, and Grammar 5.
31. Keeps Grammar 1 through 5 behavior closed while Grammar 6 accepts exactly
    the paired assurance project fields and four assurance declarations.
32. Validates all relation modes, task references, accepted component seals,
    outcome field conditions, receipt consumers, and receipt self-hashes.
33. Preserves assurance-owned source through unrelated generic operations and
    retains Grammar 6 across unit migration and lossless Mermaid profile 2.
34. Keeps Grammar 1 through 6 behavior closed while Grammar 7 accepts exactly
    milestone criterion sets, acceptance receipts, and one migration baseline.
35. Validates criterion commitments, receipt kinds and required fields,
    revocation references, waiver reasons, and migration provenance through
    the milestone-acceptance model.
36. Preserves acceptance-owned source through unrelated operations and blocks
    canonical advance unless every affected non-grandfathered milestone is
    accepted.
