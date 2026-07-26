# Governance Source and Effective-Metadata Specification

- Document status: Normative 1.0
- Governance source contract version: 1
- Created: 2026-07-26
- Requirements: [../requirements.md](../requirements.md)
- DSL grammar: [dsl-grammar.md](dsl-grammar.md)
- Mutation semantics: [mutation.md](mutation.md)
- Governance authority: [governance-authority.md](governance-authority.md)
- Unit migration: [unit-migration.md](unit-migration.md)
- Related issue: [Issue #4](https://github.com/mako10k/perttool/issues/4)

## 1. Purpose and activation boundary

This specification fixes the source representation and effective project
metadata consumed by owner-aware mutation governance. It defines:

- the four project governance fields;
- principal and principal-list syntax;
- omission defaults and declared/effective metadata;
- the Grammar 4 compatibility boundary;
- canonical generation and source-preserving mutation;
- project initialization and project-metadata behavior;
- the pre-change metadata snapshot; and
- separation from scheduling, recommendation, authentication, and runtime
  interface concerns.

Grammar 4 and governance source contract version 1 are accepted design targets.
They are not active in the `0.3.0` runtime. Until the later atomic governance
source/interface cutover, the runtime continues to support Grammar 1, 2, and 3,
rejects explicit `version 4`, and rejects governance fields in older grammar
versions.

This specification does not fix public Core type names, CLI options, JSON
schema fields, text rendering, diagnostics for authority denial, or exit codes.
The governance interface contract owns those surfaces. It also does not
authenticate principals or activate write enforcement.

## 2. Normative position

Resolve source and metadata conflicts in this order:

1. Must requirements in `docs/requirements.md`
2. this governance source and effective-metadata specification
3. common lexical, CST, field, and grammar-version rules in the
   [DSL Grammar specification](dsl-grammar.md)
4. common edit and comment-ownership rules in the
   [Mutation Semantics specification](mutation.md)
5. candidate classification and authority decisions in the
   [Governance Authority specification](governance-authority.md)
6. interface, design, process, examples, tests, help, and implementation text

The DSL Grammar specification incorporates this contract's Grammar 4 delta.
The authority evaluator consumes the effective snapshot defined here and MUST
NOT reinterpret omission, list order, or source tokens.

## 3. Principal domain

### 3.1 `PrincipalId`

A principal ID uses the existing ASCII `Identifier` lexical form:

```ebnf
PrincipalId = Identifier ;
```

The rules are:

- the first character is an ASCII letter;
- later characters are ASCII letters, digits, `-`, or `_`;
- comparison is exact and case-sensitive;
- no Unicode normalization, case folding, alias lookup, or provider-specific
  canonicalization occurs; and
- the initial domain accepts at least `user`, `llm`, and `codex`.

The restriction on lowercase reserved words applies to entity and endpoint IDs,
not to a principal value in a governance field. A principal remains an opaque
caller assertion even when its spelling matches an operating-system, Git, or
provider identity.

### 3.2 `PrincipalList`

```ebnf
PrincipalList = "[", OWS,
                [ PrincipalId,
                  { OWS, ",", OWS, PrincipalId } ],
                OWS, "]" ;
```

- `[]` is valid.
- A trailing comma is invalid.
- Duplicate principal IDs in one list are `PTSEM-113`.
- Source order is retained for declared metadata and source-preserving output.
- Effective authority treats a valid list as a set. List order does not grant
  precedence or stronger authority.
- An owner may also appear in that scope's delegate list. This is redundant
  but valid and does not change the authority decision.
- The same principal may appear in goal and DAG metadata independently.

## 4. Grammar 4 project fields

Grammar 4 inherits every Grammar 3 declaration, temporal field, exact Duration
form, validation rule, and source-preservation rule. It adds exactly these
project fields:

```ebnf
GoalOwnerField     = "goal_owner", HSPACE, PrincipalId, NEWLINE ;
GoalDelegatesField = "goal_delegates", HSPACE, PrincipalList, NEWLINE ;
DagOwnerField      = "dag_owner", HSPACE, PrincipalId, NEWLINE ;
DagDelegatesField  = "dag_delegates", HSPACE, PrincipalList, NEWLINE ;

ProjectFieldV4 = ProjectField
               | GoalOwnerField
               | GoalDelegatesField
               | DagOwnerField
               | DagDelegatesField ;
```

Each field is optional and may occur at most once. The four field spellings are
contextual project-field keywords. They do not enlarge the global reserved-word
set or invalidate an existing Grammar 1, 2, or 3 entity ID.

Canonical project-field order for Grammar 4 is:

```text
version, title, description, as_of, duration_unit, velocity, finish,
goal_owner, goal_delegates, dag_owner, dag_delegates,
critical_epsilon, target_duration
```

Field order does not affect semantics. The canonical order controls only new
field insertion and full canonical generation.

## 5. Declared and effective metadata

### 5.1 Declared metadata

For every valid Grammar 1 through 4 document, derive:

```ts
interface DeclaredGovernance {
  goalOwner: PrincipalId | null;
  goalDelegates: readonly PrincipalId[] | null;
  dagOwner: PrincipalId | null;
  dagDelegates: readonly PrincipalId[] | null;
}
```

Grammar 1, 2, and 3 documents always have four `null` declared values because
their grammars do not accept governance fields. In Grammar 4, `null` means the
field was omitted. An explicit empty list is `[]`, not `null`.

Declared delegate arrays retain source order. They contain no duplicates
because duplicate validation occurs before metadata is published.

### 5.2 Effective metadata

Derive effective metadata without reading a clock, environment, configuration,
Git identity, operating-system account, or network service:

```text
effective.goalOwner     = declared.goalOwner     ?? user
effective.goalDelegates = declared.goalDelegates ?? []
effective.dagOwner      = declared.dagOwner      ?? user
effective.dagDelegates  = declared.dagDelegates  ?? []
```

The effective form is:

```ts
interface EffectiveGovernance {
  goalOwner: PrincipalId;
  goalDelegates: ReadonlySet<PrincipalId>;
  dagOwner: PrincipalId;
  dagDelegates: ReadonlySet<PrincipalId>;
}
```

Omission and an explicit default have the same effective value but different
declared metadata. Removing an explicit field is therefore an actual governance
source change even when the effective value becomes the same default.

## 6. Version compatibility and migration

- An omitted `version` continues to mean Grammar 1.
- Grammar 4 is selected only by explicit `version 4`.
- Grammar 1, 2, and 3 reject every governance field as `PTDSL-005`.
- A runtime that does not support Grammar 4 rejects explicit `version 4` as
  `PTSEM-108`; it MUST NOT reinterpret the document as an older grammar.
- Existing Grammar 1, 2, and 3 documents remain valid without source migration
  and receive the defaults in Section 5.
- Adding any governance field to a Grammar 1, 2, or 3 source is one atomic
  candidate that also sets `project.version` to `4`.
- Adding governance metadata does not alter temporal, Duration, unit,
  graph, resource, or recommendation semantics.
- Clearing the last declared governance field does not automatically downgrade
  Grammar 4.
- An explicit downgrade from Grammar 4 is valid only when the final candidate
  has no governance fields and every remaining field and Duration token is
  accepted by the selected older grammar.

There is no automatic source migration merely to materialize effective
defaults. A format, check, analysis, or read-only project operation MUST NOT add
governance fields or change the grammar version.

## 7. Source-preserving behavior

The common CST spans, line-ending, BOM, trivia, comment ownership, edit
ordering, and candidate revalidation rules remain unchanged.

- Formatting an existing document does not insert omitted governance defaults,
  add the direct-edit warning, reorder project fields, or change the grammar
  version.
- Unchanged principal and principal-list tokens remain byte-for-byte
  unchanged.
- Setting an existing owner or delegate field replaces only its value span.
- Clearing a field removes that field and its owned leading comments under the
  common mutation rule.
- Adding a field uses Section 4's canonical project-field insertion order.
- Adding the first governance field to Grammar 1, 2, or 3 and changing the
  version are edits in one candidate; no intermediate source is authoritative.
- A newly generated principal list uses `[` and `]`, comma plus one ASCII
  space between entries, no interior padding for an empty list, and the
  caller-provided principal order.
- A source-preserving operation does not sort delegate lists. Authority set
  comparison is independent from their retained presentation order.

## 8. Project initialization and generated documents

The smallest default `project init` document may remain Grammar 1 with all four
governance fields omitted. Its effective owners are `user`, and its effective
delegate sets are empty. A future initialization request containing any
non-default or explicitly declared governance value generates Grammar 4.
The governance interface contract fixes the exact request options.

After the governance source cutover, every new `.pert` document emitted by
`project init` or Mermaid import begins with this exact leading comment:

```pert
# Existing .pert plans should normally be maintained through perttool commands; direct DSL editing bypasses goal/DAG owner-confirmation checks.
```

The warning is guidance, not proof of enforcement. It is not inserted into an
existing document by formatting, project mutation, unit migration, advance, or
existing-document graph replacement. Its presence or absence has no authority
semantics.

New-document creation has no pre-change governance snapshot and therefore does
not invent an actor or owner confirmation. A later mutation of the created
document uses its effective current metadata normally.

## 9. Project metadata and pre-change snapshot

`project show` exposes both declared and effective governance metadata for
every supported grammar version. It distinguishes omitted delegate fields
from explicit empty lists and preserves declared list order. The governance
interface contract fixes the exact public type, JSON placement, text order,
schema identity, and compatibility cutover; adapters MUST derive both
projections from the same validated metadata rather than reimplementing
defaults.

Before planning a mutation of an existing document, bind one immutable source
snapshot:

```ts
interface GovernanceFieldSource {
  fieldSpan: SourceSpan;
  valueSpan: SourceSpan;
}

interface GovernanceSourceSnapshot {
  originalDigest: string;
  grammarVersion: 1 | 2 | 3 | 4;
  declared: DeclaredGovernance;
  effective: EffectiveGovernance;
  sourceSpans: {
    goalOwner: GovernanceFieldSource | null;
    goalDelegates: GovernanceFieldSource | null;
    dagOwner: GovernanceFieldSource | null;
    dagDelegates: GovernanceFieldSource | null;
  };
}
```

`sourceSpans` identify complete declared-field and value spans through the
normal CST; the public interface may keep them internal. The authority
evaluator consumes only the original digest and effective values. The final
candidate is parsed separately and never replaces the pre-change authority
snapshot.

The snapshot contains no actor, acceptance, identity proof, timestamp, or
durable audit event.

## 10. Adapter and analysis boundaries

- The active Mermaid Profile v1 does not carry governance metadata. Grammar 4
  lossless export/import MUST remain unavailable until a versioned profile
  contract preserves declared governance values and effective equivalence.
- Plain Mermaid import creates a new document with omitted defaults unless a
  later interface version adds explicit governance input.
- Exact unit migration preserves every governance field and token and retains
  Grammar 4 as defined by the Unit Migration specification.
- Governance fields do not add an Activity-on-Arrow edge, milestone, resource
  requirement, duration, release condition, or deadline.
- Declared or effective governance values are not recommendation candidate
  facts and do not alter ranking, tiers, resource feasibility, temporal
  eligibility, or start authority.
- Principal values are not authentication, authorization evidence, Git
  identity, signatures, credentials, or RBAC records.

## 11. Acceptance invariants

Implementations and later interface/examples MUST establish at least:

1. Grammar 1, 2, and 3 documents remain valid and expose four omitted declared
   values plus `user`/empty effective defaults;
2. Grammar 4 inherits Grammar 3 and adds only the four project fields;
3. older grammar versions and older runtimes fail closed for governance source;
4. principal comparison is case-sensitive and duplicate delegates fail with
   `PTSEM-113`;
5. omission, explicit defaults, and explicit empty lists are distinguishable
   in declared metadata but resolve to the specified effective values;
6. formatting and read-only operations do not materialize defaults or upgrade
   source;
7. governance set/clear uses localized edits, retained list order, common
   comment ownership, final-candidate validation, and an atomic Grammar 4
   upgrade when required;
8. automatic downgrade never occurs;
9. project initialization and import-generated documents carry the exact
   warning after cutover without claiming enforcement;
10. `project show` derives declared and effective values from one validated
    metadata result;
11. the authority evaluator uses the digest-bound pre-change effective
    snapshot, not candidate metadata;
12. unit migration preserves governance source and Grammar 4;
13. lossless Mermaid conversion cannot silently drop governance metadata; and
14. governance source has no effect on DAG, resource, temporal, unit,
    recommendation, or normal start-authority results.
