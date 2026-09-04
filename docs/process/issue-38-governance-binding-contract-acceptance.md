# Issue #38 Governance Source-Binding Contract Acceptance

- Status: Pre-implementation contract and selected Plan Seal accepted; task
  start and implementation remain separate
- Date: 2026-09-04
- Issue: #38, `bug: lifted assurance mutations report governance bound to
  lowered source bytes`
- PERT task: `POOL_GOVERNANCE_BINDING_FIX`

## 1. Pre-implementation evidence

The accepted contract was established before implementation. The unchanged
Issue #38 preview reproduction against `plans/editor-mutations.pert` returned
the actual Grammar 7 source in both outer fields:

```text
source_digest   = sha256:bb9fd570b828c0dd9643e2739434d9963ea4c202710eed685a2d16115704d3b4
original_digest = sha256:bb9fd570b828c0dd9643e2739434d9963ea4c202710eed685a2d16115704d3b4
```

The nested `Perttool.GovernanceDecision.v2` instead retained the digest of the
lowered Grammar 6 source:

```text
governance.source_digest = sha256:605086578642142ced6d8b1d8737676c87d2424fb78cf9e9e3f17d8d63681dfe
```

The preview contained no owner assertion and wrote no file. Source inspection
confirmed the producing mechanism: the Grammar 7 candidate lift replaces the
outer original and candidate identities after applying lower-layer edits but
broadly retains the nested governance decision, and the generic Grammar 8 and
9 lifts retain that same nested object through further broad composition.

## 2. Accepted contract

Every authority-bearing governance decision returned by a generic assurance
mutation lifted through Grammar 7, 8, or 9 must bind to the same authoritative
outer source as its enclosing mutation result:

```text
source_digest = original_digest = governance.source_digest
```

The invariant applies wherever governance is present for changed, denied,
no-op, and invalid results and across preview, separate-output, and in-place
paths. The correction must preserve candidate bytes and digest, normalized
edits, affected scopes, effective owners and delegates, required owner
confirmations, denial causes, result identity, validation, stale-source,
candidate-digest, safe-write, and atomic-replacement behavior. Acceptance
requires Core, public CLI JSON, and isolated installed-package coverage.

The correction does not change governance ownership or scope classification,
make owner assertions persistent, change Grammar or CLI Contract identities,
or select a release or backport. Current evidence establishes a false public
audit and authority binding at P1; it does not establish a P0 write-authority
bypass.

## 3. Seal operation and readback

An attempted partial `plan-assurance seal` produced no candidate and failed
with `PTASSURE-303` because the enabled plan contains other inconsistent
existing seals. The accepted Issue #23 lifecycle therefore routes a newly
added unsealed task in an enabled assurance model through selected
`plan-assurance reseal` rather than an atomic initial seal.

The assertion-free selected preview affected only
`POOL_GOVERNANCE_BINDING_FIX`, added one seven-line `plan_seal`, and changed
32,271 bytes to 32,756 bytes. The owner accepted the contract meaning above,
not the candidate digest alone. One candidate-bound `user` assertion then
authorized the write from source digest
`sha256:8bd113759367c784a83a6feba785bcb2b1de8e1b1489c3cc629d0e41bb156746`
to candidate digest
`sha256:d11c9456a49bf11aee7989e26ba6176d33b8bef358a92d7195002030d74507f4`.

Readback reports contract hash
`sha256:8d28314e3f599e5890505822b1e95a100518d13d1dc9f17d997bd587c839b56f`
and equal accepted and computed basis
`sha256:95a77c4e1ce8cf8272a2cecfa32f4e1602663e7c7a93e499d3210c97ad8ad9f7`.
The task is `verified` and `unfinished`, with no direct or inherited assurance
cause. The previously rejected reason-only bulk candidate was not reused, and
the accepted Issue #37 seal and conformant outcome remain unchanged.

## 4. Preserved boundaries

The selected Plan Seal makes Issue #38 the sole normal startable task. It does
not start or finish that task, accept an implementation outcome, change a
milestone criterion or receipt, resume Gate Design, close either Issue, push a
branch, publish a package, or move a distribution tag. Those remain separate
operations and authority boundaries.
