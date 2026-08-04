# Conditional Plan Assurance Design Review

- Document status: Superseded design review; interface decisions accepted separately
- Review date: 2026-08-03
- Baseline HEAD: `876c224a99f52da453e9ef5aa9aa61e7cab28343`
- Backlog: [`ASSURE-001`](../backlog.md#assure-001-add-conditional-plan-assurance)
- Target plan-assurance model: 1
- Target hash model: 1
- Active runtime: Grammar 5 and CLI Contract 6
- Runtime status: public surface not implemented; later internal hash, source,
  mutation, and authority Cores accepted
- Successor contract: [Plan Assurance Interface Contract](../specs/plan-assurance-interface.md)

## 1. Conclusion

The requirements, semantic contract, basic design, normative examples, and
machine-readable design cases consistently define conditional plan assurance
as a separate decision axis. The first model uses the projected task
dependency DAG as its planning-dependency DAG by default and supports the
three requested effective relation modes: `both`, `planning_only`, and
`execution_only`.

No reviewed document requires lifecycle status to enter a plan hash. A status
or work-event mutation still invalidates a previously issued source-bound
Next result, but it does not change the task plan contract or recursively
invalidate downstream accepted bases. Plan-content, relation, outcome, or
frontier-receipt changes do.

This review accepted the design target as internally consistent enough for a
source/interface contract. Draft 0.2 selected the `task_relation` source
declaration, explicit `both` pinning, and `plan-dependency add|set|remove`
maintenance mapping. It is not implementation acceptance. The enclosing
grammar version, remaining assurance records and commands, public result
identities, diagnostics, governance-version activation, and implementation
plan were deliberately unselected at this review point. The successor
interface contract now closes those decisions while leaving package version
and release unselected. Current runtime help, schemas, and behavior remain
unchanged.

## 2. Reviewed authority

The review applied repository precedence in this order:

1. [Requirements](../requirements.md), especially Sections 2.7, 7.9, 9.3,
   and 11
2. [Conditional Plan Assurance Contract](../specs/plan-assurance.md)
3. [DSL Grammar](../specs/dsl-grammar.md) for the unchanged active Grammar 1
   through 5 boundary
4. [Graph Semantics](../specs/graph-semantics.md)
5. [Recommendation Semantics](../specs/recommendation.md) and the
   [Recommendation Interface](../specs/recommendation-interface.md)
6. [Project Actuals and Git History Contract](../specs/project-actuals.md)
7. [Advance History Safety](../specs/advance-history-safety.md)
8. [Governance Authority](../specs/governance-authority.md) and the
   [Governance Interface](../specs/governance-interface.md)
9. [Mutation Semantics](../specs/mutation.md)
10. [Basic Design](../basic-design.md)
11. [Normative Plan Assurance Examples](../examples/plan-assurance.md)
12. [`ASSURE-001`](../backlog.md#assure-001-add-conditional-plan-assurance)

The dependency-ordered design-case authority is
[`plan-assurance-contract-v1.json`](../../test/fixtures/plan-assurance-contract-v1.json).

## 3. Cross-surface trace

| Concern | Requirement | Contract and design | Example evidence |
| --- | --- | --- | --- |
| Disabled compatibility and atomic enablement | 2.7, 7.9 | Contract 7 and 11; Design 6.9.4 and 6.9.9 | `PAS-001` through `PAS-003` |
| Status-free semantic hashing | 2.7, 7.9 | Contract 5 and 6; Design 6.9.2 and 6.9.3 | `PAS-004` and `PAS-005` |
| Default task and plan dependency | 2.7, 7.9 | Contract 3.1 and 4.1 through 4.5; Design 6.9.1 | `PAS-003` and `PAS-005` |
| Planning-only and execution-only relations | 2.7, 7.9 | Contract 4.1 through 4.5; Design 6.9.1 | `PAS-006` through `PAS-008` |
| Outcome conformance | 2.7, 7.9 | Contract 6; Design 6.9.7 | `PAS-009` and `PAS-010` |
| Explicit replan and governed reseal | 2.7, 12.3 | Contract 8; Design 6.9.6 | `PAS-011` and `PAS-012` |
| Recommendation versus start authority | 11 | Contract 7 and 9; Design 6.9.5 | `PAS-002`, `PAS-005`, and `PAS-012` |
| Assurance-preserving advance | 9.3 | Contract 10; Design 6.9.8 | `PAS-013` and `PAS-014` |
| Threat and trust boundary | 4 | Contract 1, 8, and 12; Design 6.9.9 | `PAS-014` |

## 4. Consistency findings

### 4.1 AoA execution and planning dependencies remain distinct

The authoritative execution graph remains Activity-on-Arrow. The default
planning edge is projected only for a direct task predecessor connected
through zero or more gates and no intervening task. `planning_only` adds no
AoA edge; `execution_only` removes no AoA edge. Resource requirements, shared
owners, and recommendations create neither kind of dependency.

The effective planning graph has an independent acyclicity check. This closes
the case where an acyclic AoA graph plus an explicit reverse planning-only
relation would otherwise make recursive hashing impossible.

New tasks without accepted bases are `unsealed`; existing descendants do not
lose their prior accepted evidence and instead become `review_required` when
their recomputed basis differs. This keeps unsealed coverage distinct from a
known old basis that needs review.

The source uses `task_relation <id> <predecessor> -> <successor>:` with a
required `mode`. The arrow expresses orientation only; full mode names express
semantics. An explicit `both` pin is preserved but hash-equivalent to the
default. `=>`, `.>`, and similar punctuation aliases remain rejected target
syntax.

### 4.2 Lifecycle changes do not create assurance churn

Status, block reason, milestone state, work events, actual measurements,
derived schedules, and recommendation outputs are excluded from the plan
contract. Their source edits still change the complete document digest and
therefore make a previously issued Next or mutation result stale under the
existing optimistic-lock contract. The next read recomputes identical
assurance hashes when no semantic plan field changed.

### 4.3 Completion needs evidence the current runtime does not provide

The active Grammar 5 finish event records lifecycle and measurement evidence;
it does not prove that the delivered outcome conforms to the plan basis. The
design therefore refuses to equate `done`, event time, effort, Git time, or
free-form text with conformance. The successor interface contract adds an
explicit basis-bound outcome fact and its correction/authority rules for the
future activation.

Outcome assessment remains separate from task assurance. A known changed
outcome remains visible as `changed`, while consumer basis mismatches become
`review_required`. Once those consumers accept the new commitment by reseal,
they can return to `verified` without falsifying the producer outcome.
An assessment bound to a basis other than the producer's current computed and
accepted basis is unavailable, so editing a completed producer cannot leave its
old completion commitment silently active.

### 4.4 Recommendation is preserved and authority is filtered

Raw Recommendation interface 1 continues to state project priority. Assurance
does not rerank tasks or silently promote a lower-ranked alternative. A future
closed result retains raw facts and separately removes `unsealed`,
`review_required`, or `unavailable` tasks from new-start authority. Existing
`Perttool.NextResult.v5` cannot receive these fields without a new identity.

### 4.5 Advance preserves future assurance without becoming a ledger

An assurance-aware advance retains only commitments still consumed by a
current/future task. Each receipt retains the predecessor identity, assurance
commitment, known outcome, and per-consumer relation mode needed to reconstruct
the same planning input. A changed outcome invalidates consumers once; after
their explicit reseal, that exact versioned outcome commitment is a valid
input rather than a permanent failure. The before/after computed basis equality
check is semantic and Git-independent.

The receipt has a canonical self-hash so accidental edits to its producer,
consumer, mode, or outcome fields fail closed. Because that self-hash shares
the source trust boundary, it does not change the malicious-edit threat model.

The existing history guard remains an independent raw-byte protection. Its
narrow `--force-history-loss` boundary cannot accept a plan-assurance mismatch
or replace reseal authority. The receipt is current/future frontier state, not
a blockchain or a permanent history log.

### 4.6 Reseal is a new governed judgment

Recomputation is read-only; it never changes an accepted basis. Initial seal
and reseal are exact previewed candidates. A task edit, a prior owner
assertion, or a prior governance decision does not authorize a later reseal.
The successor interface contract selects a distinct `plan_assurance` affected
scope controlled by the effective pre-change DAG owner for the future public
cutover.

### 4.7 SHA-256 does not authenticate the editor

Domain-separated hashes provide deterministic commitment and propagation.
Because the task and accepted hash may be edited within the same source trust
boundary, they do not prove identity, approval, or malicious-tamper
resistance. Digital signatures, keys, external roots of trust, and
transparency logs remain separate security architecture.

## 5. Selected relation source interface

| Concern | Selected target |
| --- | --- |
| Source declaration | `task_relation <id> <predecessor> -> <successor>:` |
| Required field | `mode both|execution_only|planning_only` |
| Conditional field | nonempty `reason` for `execution_only` and `planning_only` |
| Explicit default | `both` pin preserved; effective graph and hash equal implicit default |
| CLI maintenance | `plan-dependency add|set|remove` |
| CLI modes | `both`, `execution-only`, `planning-only` |
| JSON operations | `plan_dependency.add|set|remove` |
| Atomic conversion | batch an AoA edit with a relation-mode change when required |
| Current runtime | unavailable; Grammar 5 and CLI Contract 6 unchanged |

The selection follows existing stable-ID, contextual-keyword, source-span,
localized edit, candidate validation, preview, and safe-write conventions. A
relation command never synthesizes an AoA edge.

## 6. Interface decisions closed by the successor contract

The [Plan Assurance Interface Contract](../specs/plan-assurance-interface.md)
selects all of the following together before implementation:

1. enclosing grammar version and model, seal, outcome, and receipt syntax,
   including their source-preservation and formatter ownership;
2. assurance read, impact-preview, initial-seal, reseal, and
   outcome-assessment operations and their exact CLI spellings;
3. result and nested schema identities, policy identities, diagnostics, exit
   behavior, text output, structured help, and Guide content;
4. governance version and exact authority for enablement, relation changes,
   outcome evidence, receipts, initial seal, and reseal;
5. outcome evidence creation and correction semantics and its composition with
   lifecycle finish;
6. receipt canonicalization, per-consumer relation preservation, ownership,
   pruning, and advance source-edit rules;
7. migration from assurance-disabled Grammar 1 through 5 documents; and
8. an independent `.pert` implementation and acceptance workstream.

Those decisions are now accepted as a target. No command, schema, package
export, or runtime warning may claim availability before the later atomic
`ASSURE_PUBLIC_CONTRACT` cutover.

## 7. Review verification target

The design review is guarded by a focused repository test that checks:

- contiguous and dependency-ordered `PAS-001` through `PAS-014` cases;
- all three dependency modes and the default projection;
- exact `task_relation` syntax, explicit `both` preservation, mode/reason
  validation, and `plan-dependency` mapping;
- status and actual-evidence exclusion from plan hashes;
- raw recommendation and assurance authority separation;
- per-consumer relation preservation across advance;
- history-force non-bypass and non-security claims; and
- the explicit Grammar 5 and CLI Contract 6 non-activation boundary.

No Git write, remote operation, issue mutation, release selection, package
publication, or dist-tag change is part of this review.
