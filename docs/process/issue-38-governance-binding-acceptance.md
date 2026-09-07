# Issue #38 Governance Source-Binding Technical Acceptance

- Status: Implementation, local technical acceptance, and PERT task finish
  complete; conformant Outcome remains separately governed
- Date: 2026-09-07
- Issue: #38, `bug: lifted assurance mutations report governance bound to
  lowered source bytes`
- PERT task: `POOL_GOVERNANCE_BINDING_FIX`
- Public result: `Perttool.MutationResult.v6`
- Governance result: `Perttool.GovernanceDecision.v2`

## 1. Correction

Every generic assurance mutation lifted through Grammar 7, 8, or 9 now
rebinds both the enclosing `originalDigest` and any nested governance
`sourceDigest` to the SHA-256 identity of the authoritative outer source. The
shared `rebindLiftedCandidateSource` projection is applied after each outer
source digest is known on successful, denied, and failed candidate paths.
Results without governance retain that absence.

The projection does not re-evaluate governance. It copies the existing frozen
decision and changes only its source binding, preserving the affected scopes,
effective owners and delegates, caller assertions, required confirmations,
authorization result, per-scope denial causes, and governance identity. The
existing lift logic continues to own candidate text, digest, normalized edits,
diff, validation, diagnostics, and result-identity conversion.

The correction lives in the first Grammar 7 lift module and is reused by the
Grammar 8 and 9 candidate lifts. It adds no source module, production
dependency, package-root export, command, schema, or result identity.

## 2. Root cause and escape boundary

The source cause was a composition defect at each outer-grammar lift. The
lowered Grammar 6 planner correctly bound governance to the bytes it received.
The lift then replaced the enclosing source identity with the complete outer
document identity but broadly copied the nested decision without rebinding it.
The same mechanism propagated through the Grammar 8 and 9 lifts.

The persistence layer checked the authoritative outer digest and the complete
candidate, so the defect did not establish a write-authority bypass. It did,
however, expose a false public authority and audit binding. Existing milestone
acceptance mutation tests already asserted the correct binding for their
separate lift, but generic assurance-mutation coverage did not assert the
three-way equality across every outer grammar and output mode. That missing
coverage was the escape cause, not the source cause.

## 3. Acceptance evidence

`test/issue-38-governance-binding.test.mjs` proves the following for each of
Grammar 7, 8, and 9:

1. A changed Core preview has
   `source_digest = original_digest = governance.source_digest`.
2. A persist-intent denial retains the candidate and exact governance facts
   while binding the decision to the outer source.
3. An idempotent task-outcome update returns a governed semantic no-op with the
   same binding.
4. A warning-as-error result remains invalid while preserving the governed
   no-op and the same binding.
5. Public CLI JSON retains the invariant for preview, separate-output, and
   digest-locked in-place writes; source and candidate bytes are checked in
   every mode.

`scripts/check-package-assurance.mjs` repeats the Grammar 9 assertion through
a newly packed and isolated globally installed CLI. Existing Contract 8, 9,
and 10 candidate, mutation, governance, safe-write, public-contract, and
milestone-acceptance tests passed without changing their candidate bytes or
authority behavior.

The static gate passed type checking across Core, LSP, VSIX, and MCP, the exact
duplicate-code ratchet at 147 clones and 2,743 duplicated lines, and the exact
complexity ratchet. A fresh complete repository run passed all 1,341 tests.
English, documentation, and 46-plan self-use checks passed. Isolated LSP and
MCP package checks passed. The private VSIX passed its supported VS Code
1.101.0 trusted and untrusted host workflow under Xvfb, including install,
replacement, and uninstall. Temporary npm-link and the clean isolated public
package workflow passed. No package was published.

The task started at `2026-09-07T15:25:52+09:00` and finished at
`2026-09-07T15:54:26+09:00`. Its exact measured active time is `857/1800h`
and its two-resource effort is `857/900ph`. The digest-bound finish write added
work event
`WE-95d0cc29dea5f4191faaae707b0f8cff442643564c57a894eb5bce2ce2242363`
and produced plan source digest
`sha256:926336a4d9f9f1aef7c4b65299b9f2abe1d7d9329a9ea59ad4af7cd1e8afcc4f`.
The task is deliberately assurance-unavailable with direct cause
`outcome_missing`; no conformant Outcome was inferred from local verification.

The first complete repository test run passed 1,339 of 1,341 tests. Its two
failures detected an unnecessary additional Application source module and the
release-plan test's expected pre-start digest and frontier. The helper was
moved into the existing first-lift module, restoring the exact source-file
boundary, and the plan assertion was updated to the separately recorded task
start. Both focused tests and the subsequent complete run passed. A stale
generated helper artifact from the intermediate layout was removed before the
final clean package replay.

## 4. Preserved boundaries

This correction does not change governance ownership, scope classification,
write authorization, caller-assertion lifetime, candidate construction,
safe-write or stale-source behavior, Grammar 7 through 9 meaning, CLI Contract
10, public counts, VSIX or MCP mutation, release selection, backport, npm
publication, distribution tags, or GitHub Issue state. Conformant Outcome
acceptance, milestone criteria and receipt, Gate Design resumption,
push, release, and Issue closure remain separate operations.
