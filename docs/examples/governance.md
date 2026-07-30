# Normative Owner-Aware Governance Examples

- Document status: Normative 1.0
- Created: 2026-07-26
- Related requirements: [../requirements.md](../requirements.md)
- Authority semantics: [../specs/governance-authority.md](../specs/governance-authority.md)
- Source contract: [../specs/governance-source.md](../specs/governance-source.md)
- Interface contract: [../specs/governance-interface.md](../specs/governance-interface.md)
- Design acceptance: [../process/governance-design-acceptance.md](../process/governance-design-acceptance.md)
- Machine baseline:
  [../../test/fixtures/governance/cases.json](../../test/fixtures/governance/cases.json)

## 1. Purpose and activation boundary

These cases fix the authority-decision and write-path observations accepted by
`GOV_NORMATIVE_EXAMPLES`. They complement the source-only
[governance examples](governance-source.md). The Markdown case IDs and the
machine baseline are one normative acceptance set.

Grammar 4, governance interface 1, and CLI Contract 5 are active in the
repository source and locally built or packed artifacts. The published
`perttool@0.3.0` artifact remains Contract 4 and rejects explicit Grammar 4
sources and governance options. These examples specify the active source
contract; release version selection and publication remain separate.

Unless a case says otherwise, a mutation candidate is syntactically,
semantically, and graph valid. `<SOURCE_DIGEST>` means the digest of the
pre-change source. Assertions are caller statements, not authenticated
identities or durable approval records.

## 2. Common snapshots

`DEFAULT` is any valid Grammar 1, 2, or 3 source that omits governance fields:

```text
declared:
  goal_owner      = null
  goal_delegates  = null
  dag_owner       = null
  dag_delegates   = null
effective:
  goal_owner      = user
  goal_delegates  = []
  dag_owner       = user
  dag_delegates   = []
```

`DELEGATED` has these effective values:

```text
goal_owner      = user
goal_delegates  = [llm]
dag_owner       = user
dag_delegates   = [codex]
```

`SPLIT` has distinct effective owners:

```text
goal_owner      = user
goal_delegates  = []
dag_owner       = llm
dag_delegates   = []
```

All authority facts come from the named pre-change snapshot and its source
digest.

## 3. Metadata and preview

### GOV-001 Omitted fields expose declared nulls and effective defaults

`project show DEFAULT --format json` returns
`Perttool.ProjectResult.v3`. Its four declared governance fields are `null`;
its effective owners are `user`; and its effective delegate arrays are empty.
The read-only operation does not insert fields, upgrade the grammar, or create
a governance decision.

The text projection distinguishes `declared=-` from the effective values:

```text
GOAL_OWNER declared=- effective=user
GOAL_DELEGATES declared=- effective=[]
DAG_OWNER declared=- effective=user
DAG_DELEGATES declared=- effective=[]
```

### GOV-002 A governed preview succeeds without assertions

Preview a `project.finish` change against `DEFAULT`, with omitted governance
input:

```text
intent              preview
actor               null
accepted_by_owner   []
affected_scopes     [goal]
required_owner_confirmations [user]
owner_confirmation_required  true
write_authorized             false
```

The goal scope reports owner `user`, no delegates, `actor_direct=false`,
`owner_confirmation_present=false`, `scope_authorized=false`, and
`denial_cause=actor_required`. The candidate result is still `ok=true`, has no
`PTGOV-101`, and performs no write. `write_authorized=false` describes the
corresponding persistent request; it does not turn preview into a denial.

## 4. Direct authority and owner confirmation

### GOV-003 Owner and delegate authority remains scope-local

Against `DELEGATED`:

- actor `user` may persist a goal change as its effective owner;
- actor `llm` may persist a goal change as a goal delegate;
- actor `codex` may persist a DAG change as a DAG delegate; and
- actor `codex` is not directly authorized for a goal change.

Each authorized scope has `actor_direct=true`,
`owner_confirmation_required=false`, `scope_authorized=true`, and no denial
cause. DAG delegation does not imply goal authority.

### GOV-004 Missing owner confirmation denies persistence

Actor `codex` requests a persistent `project.finish` change against `DEFAULT`
without `accepted_by_owner`.

The valid candidate is retained for review, but the result is `ok=false`,
`write.written=false`, and exits `1` with exactly one `PTGOV-101`. The goal
scope requires owner `user` and has
`denial_cause=owner_confirmation_required`. No expected-digest check,
temporary file, rename, or target mutation occurs.

### GOV-005 Matching owner confirmation authorizes the same change

Repeat the exact original source and `project.finish` candidate from
GOV-004 with:

```text
actor               codex
accepted_by_owner   [user]
```

The assertion matches the effective pre-change goal owner. The goal scope has
`actor_direct=false`, `owner_confirmation_present=true`,
`scope_authorized=true`, and no denial cause. The persistent result succeeds,
enters the retained safe-write path, and may report `write.written=true`.

The loose caller workflow does not begin GOV-005 with the assertion. It first
previews the candidate without `accepted_by_owner`, then presents operation
`project.set`, scope `goal`, required owner `user`, the source and candidate
digests, and the `project.finish` change. After matching confirmation, the
caller uses `accepted_by_owner=[user]` for this unchanged candidate only. It
does not copy that value to later maintenance or a later `dag advance`.

### GOV-006 A wrong owner assertion remains a governance denial

For the same change and actor, `accepted_by_owner=[llm]` does not match the
required owner `user`. The result is the same no-write `PTGOV-101` shape as
GOV-004, with `denial_cause=owner_confirmation_mismatch`. A valid but wrong
assertion is not malformed Core input and is not `PTGOV-102`.

### GOV-007 Owner confirmation never substitutes for an actor

For a persistent goal change against `DEFAULT`, `accepted_by_owner=[user]`
with no actor is denied. `owner_confirmation_present=true`, but
`scope_authorized=false` and `denial_cause=actor_required`. The result emits
one `PTGOV-101`, exits `1`, and writes nothing.

## 5. Atomic batches and pre-change authority

### GOV-008 Equal owners require one deduplicated confirmation

Actor `codex` submits one batch against `DEFAULT` that changes
`project.finish` and adds a task. Both `goal` and `dag` are affected. With
`accepted_by_owner=[user]`, both scope decisions are authorized.

`affected_scopes=[goal, dag]` uses canonical scope order and
`required_owner_confirmations=[user]` contains the shared owner once. The
assertion is operation-level; it is not copied into individual batch members.

### GOV-009 Distinct owners require both exact confirmations

Actor `codex` submits the same mixed-scope batch against `SPLIT`.

With only `accepted_by_owner=[user]`, the goal scope is authorized and the DAG
scope is denied for missing `llm`; the whole write fails atomically. With both
CLI occurrences:

```text
--accepted-by-owner user --accepted-by-owner llm
```

the normalized set projection is `[llm, user]`, while
`required_owner_confirmations=[user, llm]` retains first occurrence by
canonical scope. Both scopes are authorized and the batch may persist. One
owner assertion is never interpreted as a different owner.

### GOV-010 One operation cannot grant itself direct authority

Against `DEFAULT`, actor `codex` submits a batch that adds `codex` to
`dag_delegates` and adds a task. Both actual changes affect `dag`.

The pre-change delegate set is empty, so `actor_direct=false`. Without
`accepted_by_owner=[user]`, the batch is denied with
`owner_confirmation_required`. The new delegate value cannot authorize the
candidate that introduces it. If a separately authorized write first commits
that delegation, a later command re-reads the new digest and may recognize
`codex` as a direct DAG delegate.

## 6. Safe-write and ordinary-operation boundaries

### GOV-011 Authorization does not weaken stale-digest rejection

A governed persistent request first obtains `write_authorized=true`. If the
source digest changes before commit, the safe-write layer returns
`PTIO-501`, exit `5`, and `write.written=false`. It does not emit
`PTGOV-101`.

A retry must read the new source, reconstruct the candidate, reclassify its
actual changes, and derive a fresh governance decision. The prior decision is
not reusable authority, and the caller does not carry its loose owner
confirmation into the fresh candidate.

### GOV-012 Ordinary maintenance and byte-identical candidates are not governed

Changing a task estimate or resource capacity against a valid source with no
actor produces:

```text
applicable                   false
affected_scopes              []
required_owner_confirmations []
owner_confirmation_required  false
write_authorized             true
scopes                       []
```

The persistent operation retains its existing validation and safe-write
behavior. A byte-identical candidate has the same not-applicable governance
shape; normal no-change behavior determines whether bytes are written.

### GOV-013 Transformations and new-document creation invent no authority

`document format` and exact `project migrate-unit` remain ordinary
transformations and do not accept governance assertions. `project init` and
the current new-document `dag import` have no pre-change governance snapshot,
so they require no fictional actor or owner confirmation. They cannot use that
boundary to replace an existing document.

Any future existing-document graph-replacement import must classify the
structural delta as `dag` and use the common evaluator.

## 7. Validation, cutover, and presentation

### GOV-014 Invalid assertions fail before authority evaluation

Malformed or repeated `--actor`, malformed principal IDs, and duplicate
`--accepted-by-owner` values are `PTCLI-001`, exit `2`, before document I/O.
Malformed Core `GovernanceRequestInput` is `PTGOV-102`, exit `1`, with no
candidate governance decision. A mismatched but well-formed owner assertion
instead follows GOV-006.

Contract 5 activates Grammar 4, the governance options, ProjectResult v3,
MutationResult v2, registry/help/schema projections, and write enforcement
atomically. A Contract 4 runtime fails closed on Grammar 4 and governance
options rather than exposing a partial interface.

### GOV-015 Help and direct-edit guidance state the same limit

Registry-driven text help, JSON help, `guide editing`, README maintenance
guidance, generated/project-init headers, and installed-package acceptance use
the same boundary. Generated documents use this exact comment:

```text
# Existing .pert plans should normally be maintained through perttool commands; direct DSL editing bypasses goal/DAG owner-confirmation checks.
```

A direct text edit does not invoke the authority evaluator and produces no
successful GovernanceDecision. Documentation must not claim that actor or
owner assertions are authenticated, that consultation was verified or
durably audited, or that direct editing is technically prevented.

## 8. Acceptance map

| Boundary | Cases |
| --- | --- |
| omitted defaults and project metadata | GOV-001 |
| preview without assertions | GOV-002 |
| owner and delegate authority | GOV-003 |
| missing, matching, wrong, and actor-less confirmation | GOV-004..007 |
| equal-owner, distinct-owner, and self-authorizing batches | GOV-008..010 |
| stale digest and fresh-decision requirement | GOV-011 |
| ordinary, no-op, transformation, and creation boundaries | GOV-012..013 |
| invalid input and atomic Contract 5 cutover | GOV-014 |
| help, installed behavior, and direct-edit guidance | GOV-015 |
