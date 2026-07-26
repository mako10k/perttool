# Owner-Aware Governance Interface Contract

- Document status: Normative 1.0
- Interface ID: `perttool.governance-interface`
- Interface version: `1`
- Target grammar version: `4`
- Target CLI contract version: `5`
- Created: 2026-07-26
- Requirements: [../requirements.md](../requirements.md)
- Governance source: [governance-source.md](governance-source.md)
- Governance authority: [governance-authority.md](governance-authority.md)
- Mutation semantics: [mutation.md](mutation.md)
- Active temporal/unit interface: [temporal-unit-interface.md](temporal-unit-interface.md)
- Prior CLI contract: [cli-contract-3.md](cli-contract-3.md)
- Related basic design: [../basic-design.md](../basic-design.md)
- Related issue: [Issue #4](https://github.com/mako10k/perttool/issues/4)

## 1. Purpose and activation boundary

This contract fixes the public interface for owner-aware goal and DAG
governance. It selects:

- Core caller-assertion, governance-metadata, decision, and planner types;
- one repeatable owner-confirmation shape for distinct-owner batches;
- CLI options for existing-document mutations and project metadata;
- preview, persistent-write, text, and JSON projections;
- `project show` declared/effective governance output;
- registry-driven command help and editing guidance;
- stable governance diagnostics and existing exit-code meanings; and
- the atomic compatibility cutover from Grammar 1/2/3 and CLI Contract 4.

The accepted source and authority specifications own Grammar 4 source meaning,
effective defaults, actual-change classification, and authority decisions.
This interface does not reinterpret those contracts.

Grammar 4, governance interface version 1, and CLI Contract 5 are accepted
design targets. They are not active in the `0.3.0` runtime. Until the later
atomic implementation and acceptance cutover, the runtime continues to expose
CLI Contract 4, rejects Grammar 4, rejects the options in this document, and
does not enforce owner-aware writes.

This contract does not authorize runtime implementation, release publication,
or a package-version choice.

## 2. Normative position and version matrix

Resolve conflicts in this order:

1. Must requirements in [Requirements](../requirements.md)
2. source and effective metadata in the
   [Governance Source specification](governance-source.md)
3. classification and authority decisions in the
   [Governance Authority specification](governance-authority.md)
4. this public interface contract
5. mutation, write-safety, Contract 3, and Contract 4 mechanics retained here
6. basic design, examples, help, tests, and implementation

The selected identities are:

| Concern | Active Contract 4 identity | Governance cutover identity |
| --- | --- | --- |
| DSL grammar | `1`, `2`, or `3` | `1`, `2`, `3`, or `4` |
| CLI contract | `4` | `5` |
| Governance interface | absent | `perttool.governance-interface@1` |
| Governance source contract | target only | `1` |
| Governance semantics | target only | `1` |
| Project result | `Perttool.ProjectResult.v2` | `Perttool.ProjectResult.v3` |
| Mutation and advance result | `Perttool.MutationResult.v1` | `Perttool.MutationResult.v2` |
| Nested governance decision | absent | `Perttool.GovernanceDecision.v1` |

The following result identities retain their payload meanings while every CLI
envelope reports `cli_contract_version=5`:

- `Perttool.CheckResult.v2`;
- `Perttool.AnalysisResult.v3`;
- `Perttool.NextResult.v4`;
- `Perttool.FormatResult.v1`;
- `Perttool.InitResult.v1`;
- `Perttool.UnitMigrationResult.v2`;
- active conversion results;
- `Perttool.CommandHelpResult.v1`;
- `Perttool.GuideResult.v1`;
- `Perttool.AgentGuidanceResult.v1`; and
- `Perttool.CliError.v1`.

Schema retention does not waive Grammar 4 behavior. For example,
CheckResult v2 can report `grammar_version=4`, and unit migration preserves
Grammar 4 governance source without adding governance authority to the
migration itself.

## 3. Core request boundaries

### 3.1 Principal values and normalized assertions

Public Core input reuses the exact case-sensitive `PrincipalId` syntax from the
Governance Source specification. It does not infer an identity.

```ts
type GovernancePersistenceIntent = "preview" | "persist";

interface GovernanceRequestInput {
  readonly intent?: GovernancePersistenceIntent;
  readonly actor?: PrincipalId | null;
  readonly acceptedByOwner?: readonly PrincipalId[];
}

interface GovernanceRequest {
  readonly intent: GovernancePersistenceIntent;
  readonly actor: PrincipalId | null;
  readonly acceptedByOwner: readonly PrincipalId[];
}
```

Omitted `GovernanceRequestInput` values normalize to
`intent="preview"`, `actor=null`, and `acceptedByOwner=[]`.
`acceptedByOwner` is the concrete public shape for the abstract
`acceptedOwners` set in the authority specification.

The normalized owner-confirmation set has no duplicates. Its public result
projection is sorted by exact ASCII code-unit order so that equivalent caller
assertions have byte-identical JSON. Ordering carries no authority meaning.

An invalid principal, duplicate `acceptedByOwner` value, unsupported request
field, non-array owner-confirmation value, or non-string array member is
`PTGOV-102`. A missing actor is valid input; it becomes an authority fact, not
a request-shape error.

### 3.2 Mutation and advance planning

The public mutation options extend the current planner options:

```ts
interface MutationOptions extends CheckOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
  readonly governance?: GovernanceRequestInput;
}

planMutation(
  text: string,
  mutation: Mutation,
  options?: MutationOptions,
): MutationResultV2;

planBatchMutation(
  text: string,
  mutation: BatchMutation,
  options?: MutationOptions,
): MutationResultV2;

planAdvance(
  text: string,
  options?: MutationOptions,
): AdvanceResultV2;
```

The omitted-governance default is a preview. A write-capable adapter MUST pass
`intent="persist"` before relying on the result as write authority. It MUST
NOT plan with the preview default and then persist that candidate through a
separate ungoverned path.

The common Core path:

1. validates and snapshots the original document;
2. validates the mutation request;
3. creates and validates one final candidate;
4. classifies the actual original-to-candidate change;
5. evaluates the normalized governance request against the pre-change
   snapshot; and
6. returns one MutationResult v2 containing the candidate and decision.

Classification and evaluation are one shared pure Core implementation used by
direct mutations, batch, and advance. An adapter does not infer scopes from
command names.

### 3.3 Governance project metadata requests

The public project request types add:

```ts
interface ProjectFieldSet {
  // Existing fields remain unchanged.
  readonly goalOwner?: PrincipalId;
  readonly goalDelegates?: readonly PrincipalId[];
  readonly dagOwner?: PrincipalId;
  readonly dagDelegates?: readonly PrincipalId[];
}

type ProjectClearableField =
  | ExistingProjectClearableField
  | "goal_owner"
  | "goal_delegates"
  | "dag_owner"
  | "dag_delegates";

interface ProjectInitRequest {
  // Existing fields remain unchanged.
  readonly goalOwner?: PrincipalId;
  readonly goalDelegates?: readonly PrincipalId[];
  readonly dagOwner?: PrincipalId;
  readonly dagDelegates?: readonly PrincipalId[];
}
```

An explicitly supplied empty delegate array is distinct from omission. A
project-set request that adds any governance field creates the Grammar 4
upgrade in the same final candidate. A project-init request with any of these
four properties generates Grammar 4. If `version` is omitted it selects `4`;
if `version` is explicitly present it MUST equal `4`.

Project initialization creates a new document and therefore has no
`GovernanceRequestInput`. Project set is an existing-document mutation and
uses the request in Section 3.1 in addition to its metadata fields.

## 4. Governance decision

### 4.1 Public Core type

Every successfully validated mutation or advance candidate returns:

```ts
type GovernanceScope = "goal" | "dag";

type GovernanceDenialCause =
  | "actor_required"
  | "owner_confirmation_required"
  | "owner_confirmation_mismatch";

interface GovernanceScopeDecision {
  readonly scope: GovernanceScope;
  readonly requiredOwner: PrincipalId;
  readonly effectiveDelegates: readonly PrincipalId[];
  readonly actorDirect: boolean;
  readonly ownerConfirmationRequired: boolean;
  readonly ownerConfirmationPresent: boolean;
  readonly scopeAuthorized: boolean;
  readonly denialCause: GovernanceDenialCause | null;
}

interface GovernanceDecisionV1 {
  readonly schemaVersion: "Perttool.GovernanceDecision.v1";
  readonly governanceInterfaceVersion: 1;
  readonly governanceSourceContractVersion: 1;
  readonly governanceSemanticsVersion: 1;
  readonly sourceDigest: string;
  readonly intent: GovernancePersistenceIntent;
  readonly applicable: boolean;
  readonly actor: PrincipalId | null;
  readonly acceptedByOwner: readonly PrincipalId[];
  readonly affectedScopes: readonly GovernanceScope[];
  readonly requiredOwnerConfirmations: readonly PrincipalId[];
  readonly ownerConfirmationRequired: boolean;
  readonly writeAuthorized: boolean;
  readonly scopes: readonly GovernanceScopeDecision[];
}
```

`sourceDigest` is the digest of the pre-change document. `affectedScopes` and
`scopes` use canonical `goal`, then `dag` order. Effective delegate arrays use
exact ASCII code-unit order because the semantic value is a set.

`requiredOwnerConfirmations` contains the effective owner of each scope for
which `actorDirect=false`, deduplicated by first occurrence in canonical scope
order. If both scopes have the same owner, one value is sufficient. If their
owners differ, both values occur.

`ownerConfirmationPresent` is exact membership of `requiredOwner` in
`acceptedByOwner`, whether or not direct authority makes confirmation
unnecessary. `denialCause` is null exactly when `scopeAuthorized=true`.

For a valid candidate with no affected scope:

- `applicable=false`;
- `affectedScopes=[]`;
- `requiredOwnerConfirmations=[]`;
- `ownerConfirmationRequired=false`;
- `writeAuthorized=true`; and
- `scopes=[]`.

The decision still retains the caller-asserted actor and owner-confirmation
set. Supplying assertions does not convert ordinary maintenance into a
governed change.

### 4.2 Preview and persistence

`writeAuthorized` answers whether the same candidate can enter a persistent
write using the supplied assertions. It is derived identically for both
intents.

- With `intent="preview"`, an unauthorized decision does not make an otherwise
  valid candidate fail.
- With `intent="persist"`, an applicable decision with
  `writeAuthorized=false` adds `PTGOV-101`, returns `ok=false`, and prevents
  every filesystem write.
- A not-applicable decision permits the existing write behavior without an
  actor.

An owner confirmation never substitutes for the required actor. Candidate
metadata never changes the pre-change decision.

## 5. CLI Contract 5

### 5.1 Governance assertion option group

Contract 5 adds one shared `governance` option group:

| Option | Value type | Repeatable | Default | JSON spelling |
| --- | --- | ---: | --- | --- |
| `--actor` | `principal-id` | no | absent | `actor` |
| `--accepted-by-owner` | `principal-id` | yes | empty set | `accepted_by_owner` |

The spelling `--accepted-by-owner` is the caller assertion requested by
Issue #4. Help MUST describe it as an assertion that the named owner was
consulted. It MUST NOT describe it as authenticated, verified, signed, or
recorded in a durable approval ledger.

The option group is present on every current direct command whose actual
candidate can affect a governance scope:

```text
project set
dag advance
task add
task set
task remove
gate add
gate set
gate remove
milestone add
milestone remove
batch apply
```

The options are accepted in preview and persistent modes. They are not
statically required because only Core actual-change classification determines
applicability. A `task set` that changes only a title, for example, remains
ordinary maintenance.

The following current operations cannot produce a governed candidate and do
not receive the assertion group:

- read-only operations;
- `document format`;
- `project init`;
- `project migrate-unit`;
- current new-document `dag import`;
- `task finish`;
- `milestone set`; and
- resource add, set, or remove.

Any future existing-document graph-replacement import receives the same group
and Core decision before activation.

`--actor` occurs at most once. Duplicate `--accepted-by-owner` values are a
usage error even when they use separate option occurrences. Assertions are
operation-level values. They MUST NOT be embedded in one batch member, differ
by batch member, or be accepted as fields in the `--request` JSON mutation
object.

### 5.2 Project governance options

Contract 5 extends `project init` and `project set`:

```text
[--goal-owner <principal-id>]
[--goal-delegates <principal-list>]
[--dag-owner <principal-id>]
[--dag-delegates <principal-list>]
```

`<principal-list>` is the exact bracketed Grammar 4 list, including `[]`.
Each option occurs at most once. `project set --clear` also accepts
`goal_owner`, `goal_delegates`, `dag_owner`, and `dag_delegates`.

For `project init`, any governance option selects Grammar 4 when `--version`
is omitted and conflicts with an explicit version other than `4`. For
`project set`, adding the first governance field and upgrading the version is
one source-preserving candidate governed against the original document.

### 5.3 Persistence-mode mapping

The adapter maps modes as follows:

| CLI mode | Core governance intent | Existing-document persistence |
| --- | --- | --- |
| default preview | `preview` | no |
| `--diff` | `preview` | no |
| JSON preview | `preview` | no |
| `--write` | `persist` | yes |
| existing-document `--out` | `persist` | yes |

New-document `project init --out` and current `dag import --out` remain
creation operations without a pre-change authority snapshot.

## 6. JSON result contracts

### 6.1 Common envelope

Every Contract 5 JSON envelope includes:

```text
cli_contract_version  5
```

Consumers check `schema_version`, `cli_contract_version`, and `operation`
before interpreting operation-specific fields. JSON field names use
lower-case snake-case.

### 6.2 `Perttool.ProjectResult.v3`

ProjectResult v3 retains every ProjectResult v2 field and adds
`project.governance`:

```text
governance:
  source_contract_version  1
  declared:
    goal_owner              string|null
    goal_delegates          string[]|null
    dag_owner               string|null
    dag_delegates           string[]|null
  effective:
    goal_owner              string
    goal_delegates          string[]
    dag_owner               string
    dag_delegates           string[]
```

Declared arrays preserve source order. Effective arrays use exact ASCII
code-unit order. Grammar 1, 2, and 3 return four declared nulls plus `user`
owners and empty effective delegate arrays. An invalid document returns
`project=null`, as before.

### 6.3 `Perttool.MutationResult.v2`

MutationResult v2 retains every MutationResult v1 field and adds:

```text
governance  GovernanceDecisionV1|null
```

The JSON projection of `GovernanceDecisionV1` is:

```text
schema_version                       "Perttool.GovernanceDecision.v1"
governance_interface_version         1
governance_source_contract_version   1
governance_semantics_version         1
source_digest                        string
intent                               "preview"|"persist"
applicable                           boolean
actor                                string|null
accepted_by_owner                    string[]
affected_scopes                      ("goal"|"dag")[]
required_owner_confirmations         string[]
owner_confirmation_required          boolean
write_authorized                     boolean
scopes:
  [{scope,
    required_owner,
    effective_delegates,
    actor_direct,
    owner_confirmation_required,
    owner_confirmation_present,
    scope_authorized,
    denial_cause}]
```

`governance` is non-null whenever the original, request, and final candidate
were valid enough to classify. It is null when no trustworthy candidate
exists, including `PTGOV-102`.

An unauthorized persistent result:

- has `ok=false`;
- retains `changed`, `updated_digest`, `updated_text`, `diff`, and `edits`
  from the valid candidate;
- has `write.written=false`;
- has a non-null governance decision with `write_authorized=false`; and
- contains the single `PTGOV-101` diagnostic specified in Section 8.

Retaining the candidate does not persist it. It lets a machine inspect the
same reviewable plan that failed the write-authority gate.

`dag advance` continues to use the mutation schema and appends its existing
`advance` object. It therefore also uses `Perttool.MutationResult.v2`, not a
separate advance schema.

### 6.4 Stable JSON order

The stable root order for MutationResult v2 is the retained common envelope,
candidate/write fields, `governance`, and then an operation-specific extension
such as `advance`. Within governance, fields occur in the order shown in
Section 6.3.

Scope order is `goal`, then `dag`. Declared delegate order is source order.
Caller assertion and effective delegate set projections use exact ASCII
code-unit order. Required owner confirmations use first occurrence by scope,
so equal goal and DAG owners appear once.

## 7. Text projections

### 7.1 `project show`

Project text retains its existing labels and inserts these lines after
`FINISH_DEADLINE` and before `CRITICAL_EPSILON`:

```text
GOAL_OWNER declared=<principal|-> effective=<principal>
GOAL_DELEGATES declared=<principal-list|-> effective=<principal-list>
DAG_OWNER declared=<principal|-> effective=<principal>
DAG_DELEGATES declared=<principal-list|-> effective=<principal-list>
```

`-` means an omitted declared field. A principal list uses Grammar 4 canonical
list spelling, including `[]`.

### 7.2 Mutation and advance summaries

For an applicable successful preview, applicable successful write, or denied
persistent write, stderr includes one summary followed by one line per scope:

```text
GOVERNANCE intent=<preview|persist> applicable=true actor=<principal|-> affected_scopes=<csv> required_owner_confirmations=<csv|-> accepted_by_owner=<csv|-> write_authorized=<true|false>
GOVERNANCE_SCOPE scope=<goal|dag> required_owner=<principal> delegates=<csv|-> actor_direct=<true|false> owner_confirmation_required=<true|false> owner_confirmation_present=<true|false> scope_authorized=<true|false> denial_cause=<cause|->
```

Comma-separated values contain no added spaces and `-` represents an empty
set. Scope lines use canonical order. Existing candidate, diff, preview, and
write-summary streams otherwise remain unchanged.

An ordinary, not-applicable mutation produces no additional governance text,
preserving the current human-facing output. Its JSON still contains the
not-applicable decision.

## 8. Diagnostics and exits

### 8.1 Denied persistent write

An applicable persistent decision with `write_authorized=false` emits exactly
one diagnostic:

```text
code       PTGOV-101
severity   error
message    required owner-aware write authority was not established against the pre-change document
entity_id  null
span       null
related    []
guide_topic editing
data:
  governance_semantics_version  1
  source_digest                 string
  actor                         string|null
  accepted_by_owner             string[]
  denied_scopes:
    [{scope, required_owner, cause}]
```

`denied_scopes` contains only unauthorized scopes in canonical order.
`cause` is the exact GovernanceDenialCause derived by the authority
specification. The diagnostic does not say that an identity or consultation
was authenticated or verified.

`PTGOV-101` is a domain error and exits `1`. It is emitted only for a
persistent intent; preview reports the same facts without this diagnostic.

### 8.2 Invalid Core caller assertions

Malformed `GovernanceRequestInput` is:

```text
code       PTGOV-102
severity   error
message    invalid governance caller assertions
```

Its `data.cause` is one of:

```text
invalid_intent
invalid_actor
invalid_accepted_by_owner
duplicate_accepted_by_owner
unsupported_field
```

It is a Core request/domain error and exits `1` when exposed through an
adapter. The CLI validates its typed option form before reading the document;
an invalid principal, repeated `--actor`, duplicate
`--accepted-by-owner`, or malformed occurrence is `PTCLI-001` and exits `2`.
A valid but wrong owner assertion is not PTGOV-102; a persistent attempt
reaches PTGOV-101.

### 8.3 Retained exit meanings and priority

Contract 5 adds no exit code:

| Code | Governance-relevant meaning |
| ---: | --- |
| 0 | successful preview or authorized/not-applicable write |
| 1 | document, candidate, governance-domain, or warning-policy failure |
| 2 | CLI usage or assertion-option shape error |
| 3 | input/output/encoding error |
| 4 | strict conversion loss |
| 5 | optimistic-lock, symlink, or atomic-write conflict after authorization |
| 70 | internal invariant or programmer error |

Usage validation occurs before document reads. Original and candidate
validation occur before authority evaluation. A denied persistent decision
does not enter the safe-write path. After authorization, the retained I/O and
write-conflict priorities apply unchanged.

## 9. Safe-write composition

For an existing-document persistent request, the adapter:

1. reads the original raw bytes and digest;
2. passes `intent="persist"` plus caller assertions to the common planner;
3. requires a valid candidate and `governance.writeAuthorized=true`;
4. only then applies expected-digest, current-digest, symlink, and target
   checks;
5. commits through the existing exclusive-output or atomic in-place writer;
6. verifies the written digest and candidate validity; and
7. reports both the governance decision and write result.

`PTGOV-101` performs no expected-digest assertion, target creation, temporary
file creation, rename, or in-place replacement. An authorized request that
then observes a stale digest retains `PTIO-501` and exit `5`; governance does
not wrap or weaken that conflict.

A retry after any conflict re-reads, replans, reclassifies, and reauthorizes
the new source. A prior GovernanceDecision is not reusable write authority.

`document format` and exact unit migration remain ordinary transformations.
They retain their existing safe-write gates and do not accept governance
assertions. Direct source editing can bypass tool-mediated governance and is
not represented as a successful governance decision.

## 10. Registry, help, and guidance

Every projected command descriptor has `contractVersion=5`. The authoritative
registry:

- defines the `governance` shared option group once;
- expands it only onto the commands in Section 5.1;
- adds project governance metadata options and clear values;
- changes mutation/advance success schemas to
  `Perttool.MutationResult.v2`;
- changes project-show success to `Perttool.ProjectResult.v3`;
- retains all applicable exits, including PTGOV-101 under exit `1`; and
- provides at least one preview and one persistent example that use the exact
  assertion terminology.

Text help and JSON help are projections of the same descriptor. Usage recovery
for an invalid governance option targets the exact affected command help.

`guide editing` MUST explain:

- previews require no actor or owner confirmation;
- persistent governed changes require an actor;
- owners and delegates are direct caller-asserted authority;
- another actor uses repeatable `--accepted-by-owner`;
- the pre-change document determines owners and delegates;
- one atomic batch must satisfy every affected scope;
- assertions are not authenticated or durable audit records; and
- direct DSL editing bypasses the tool-mediated check.

The generated-document warning fixed by the source contract and the README
maintenance warning use the same meaning. Their implementation remains in the
later source/guidance tasks; this contract fixes the public target.

## 11. Compatibility and atomic cutover

The governance public cutover is one atomic Contract 5 change. It activates
together:

1. Grammar 4 parsing, validation, formatting, and source-preserving mutation;
2. declared/effective metadata and `project show` v3;
3. governance request normalization and pure authority evaluation;
4. MutationResult v2 preview and persistent decisions;
5. PTGOV-101 enforcement before every affected safe-write path;
6. registry dispatch, text help, JSON help, and usage recovery;
7. editing guidance, generated warnings, and installed-package workflows; and
8. complete focused and repository-wide acceptance.

No earlier implementation slice may expose Grammar 4, governance source
fields, actor options, owner-confirmation options, ProjectResult v3,
MutationResult v2, or `cli_contract_version=5` as an active partial public
contract.

Contract 5 has no Contract 4 switch, compatibility alias, or environment
toggle. Contract 4 consumers continue to receive the published `0.3.0`
surface. Contract 5 consumers branch on the new CLI and schema identities.
Package versioning, Git publication, GitHub Release creation, npm publication,
and dist-tag movement remain separately authorized release work.

MCP, LSP, VSIX, authentication, signatures, RBAC, durable approval audit, Git
integration, recommendation override apply, and recommendation-ranking
changes remain outside this contract.

## 12. Interface acceptance invariants

Later examples and implementation acceptance MUST establish at least:

| ID | Invariant |
| --- | --- |
| GOV-IF-001 | Omitted input normalizes to preview, null actor, and no owner confirmations. |
| GOV-IF-002 | `--accepted-by-owner` is repeatable and distinct effective owners require distinct matching values. |
| GOV-IF-003 | Duplicate or malformed assertion options fail as usage before document I/O; malformed Core input is PTGOV-102. |
| GOV-IF-004 | A valid governed preview remains successful and returns a complete GovernanceDecision even when its corresponding write is unauthorized. |
| GOV-IF-005 | An unauthorized persistent result retains its valid candidate and decision, emits one PTGOV-101, reports `written=false`, and performs no write. |
| GOV-IF-006 | Owner/delegate direct authority and matching owner confirmation use only the pre-change digest-bound snapshot. |
| GOV-IF-007 | A mixed goal/DAG batch receives one operation-level actor and one unambiguous confirmation set. |
| GOV-IF-008 | Ordinary maintenance returns a not-applicable decision and writes without actor assertions under the retained safety rules. |
| GOV-IF-009 | ProjectResult v3 distinguishes omitted declarations, explicit empty lists, and effective defaults for every supported grammar. |
| GOV-IF-010 | Project init and project set expose every governance field, including an explicit empty list, with the required atomic Grammar 4 behavior. |
| GOV-IF-011 | Registry dispatch, text help, JSON help, schemas, exits, and examples agree for every affected command. |
| GOV-IF-012 | An authorized stale-digest write remains PTIO-501/exit 5 and requires a fresh governance decision on retry. |
| GOV-IF-013 | Format, exact unit migration, current new-document import, and read-only operations do not acquire fictional governance authority. |
| GOV-IF-014 | Contract 5 activation is atomic and an older runtime fails closed on Grammar 4 and governance options. |
| GOV-IF-015 | Text, JSON, Guide, README, generated warning, and installed-package behavior never claim authentication or prevention of direct editing. |
