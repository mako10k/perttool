# Issue 36 milestone-acceptance delegate acceptance

Date: 2026-08-28

Status: accepted local correction; installed-package replay remains a release-candidate gate

## Scope

This record accepts the source correction for Issue #36 from the exact peeled
`v0.10.5` base
`7379870db2ec000243f02cda6d86af514af7feef`. It covers milestone criterion-set
replacement and every acceptance-receipt action. Version preparation,
publication, npm dist-tag changes, Issue mutation, plan advance, public VSIX
publication, and integration into the preserved `0.11.0` work remain separate.

## Causal analysis

### Root cause

`src/milestone-acceptance/mutation.ts` independently interpreted governance
metadata with a regular expression whose delegate syntax did not accept the
canonical bracketed `PrincipalList` representation. A valid declaration such
as `dag_delegates [codex]` was therefore converted to an empty delegate set,
and a legitimate delegated actor was denied with `PTGOV-101`.

### Contributing cause

Milestone-acceptance mutation introduced a second governance interpretation
path instead of consuming the validated document and the existing canonical
governance projection used by the rest of the application.

### Escape and detection cause

The existing mutation coverage exercised owner authority and owner
confirmation but did not cross bracketed empty, one-item, and multiple-item
delegate declarations with criterion replacement, every receipt action, and
the CLI safe-write path. This omission explains why the defect escaped; it is
not the root cause of the incorrect authority state.

### Corrective action

Milestone-acceptance mutation now removes acceptance-only records to obtain the
pre-change base document, validates that document through the target Grammar 6
validator, and derives effective governance through
`governanceMetadataFromDocument`. Validation failure remains fail-closed as
`PTMAC-103`. The independent regular expression is removed.

### Recurrence-prevention action

The dependency-ordered matrix
`test/fixtures/issue-36-milestone-acceptance-delegates-v1.json` fixes eighteen
boundaries. The focused regression covers absent, empty, one-item, and
multiple-item delegates; owner, missing, non-delegate, and wrong actors;
criterion replacement; verify, fail, unavailable, revoke, and waive receipts;
preview; expected-digest rejection; in-place safe write; and post-write
readback. Case `I36-018` requires the same replay from the immutable installed
`0.10.6` candidate before publication approval.

## Claim, evidence, and action chain

- `CLM-I36-001`: the source mechanism that created the incorrect delegate
  authority has been removed.
  - `EVD-I36-001`: exact `v0.10.5` reproduction returned `ok=false`,
    diagnostic `PTGOV-101`, `effectiveDelegates=[]`, `actorDirect=false`, and
    `writeAuthorized=false` for both delegated criterion replacement and
    delegated receipt mutation.
  - `EVD-I36-002`: the focused post-correction command passed all 17 existing
    milestone-acceptance, public-contract, and Issue #36 tests.
  - `ACT-I36-001`: retain the canonical validated governance projection as the
    single authority input.
- `CLM-I36-002`: the correction preserves the complete current repository
  behavior outside the targeted defect.
  - `EVD-I36-003`: `TMPDIR=/tmp npm test` passed 1,234 of 1,234 tests with zero
    failures, cancellations, skips, or todos.
  - `EVD-I36-004`: `npm run check:static` passed the type check, pinned jscpd
    5.0.15 duplicate ratchet, and pinned Lizard 1.23.0 complexity ratchet.
  - `ACT-I36-002`: require the isolated installed-package replay before the
    immutable candidate may be proposed for publication.

## Compatibility boundary

The correction does not change Grammar 8, CLI Contract 9, 56 commands, 23 root
schemas, 129 root and Node runtime exports, 45 Core runtime exports, result
identities, or package dependencies. It does not broaden owner or delegate
authority: missing and unauthorized actors remain denied, and the existing
digest-bound safe-write gate remains unchanged.
