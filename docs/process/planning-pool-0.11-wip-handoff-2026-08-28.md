# Planning Pool `0.11.0` WIP Handoff

- Date: 2026-08-28
- Branch: `codex/planning-pool-0.11-wip`
- Starting HEAD before this checkpoint: `eb6e59da5f058229fa5e2603ce86329821b4e45e`
- Verified remote base: `origin/main` at
  `39b4ab7d7e48d65a93b138683e79c798877f2170`
- Starting divergence: ahead 3, behind 0
- Pull request at handoff preparation: none
- State: WIP; independent Candidate 1.3 review rejected the acceptance
  evidence and wording, not the corrected runtime mechanism
- Release effect: none

## 1. Objective and current boundary

This branch preserves the accepted Planning Pool integration, the exact Issue
#36 forward correction, the Grammar 9 milestone-acceptance composition
correction, and the proposed `0.11.0` gate design. It is a collaboration
checkpoint, not an accepted release gate or release candidate.

The corrected runtime composes milestone criterion-set and receipt mutations
through the Grammar 9 Planning Pool and Contract 9 temporal layers using exact
localized edits. Candidate 1.3 fixes the three independently reproduced
mechanisms from Candidates 1.0 through 1.2:

1. Grammar 9 source was passed directly into the older acceptance planner.
2. One longest-common-prefix/suffix range could remove intervening Planning
   Pool declarations.
3. A governance-denied persistent request was mistaken for a candidate-less
   construction failure and exposed the lowered Grammar 7 candidate.

The source mechanism now passes independent replay. The exact checkpoint is
still not eligible for an assurance Outcome because the evidence and lifecycle
wording findings below remain unresolved.

## 2. Verified local evidence

Before this handoff document was added, the exact Candidate 1.3 worktree passed
the complete local gate with:

- static type, duplication, and complexity gates;
- 1,336 of 1,336 tests;
- the English baseline over 1,306 text files with 3 allowlisted lines;
- 373 Markdown and 7 PERT documentation inputs;
- read-only self-use over 46 plans;
- isolated LSP and MCP package checks;
- the VSIX shell, DAG, and supported VS Code 1.101.0 host gate;
- temporary npm linking; and
- the 1,019-file isolated public-package workflow.

The fresh non-authoring review independently passed the focused 12-case suite,
Grammar 7/8/9, BOM/CRLF, the actual `Perttool.MutationResult.v6` schema,
no-op empty edits, all receipt actions, stale-digest exit 5, and the denied
persistent replay. That denial returned exit 1, `PTGOV-101`, `written=false`,
an unchanged source file, a complete Grammar 9 candidate, the outer source
digest, reconstructing exact edits, and byte-identical Planning Pool blocks.

## 3. Independent review result

Final verdict: `REJECT`, with no P0 or P1, two P2 findings, and three P3
findings.

### P2 findings that block Outcome registration

1. `docs/process/grammar9-milestone-acceptance-mutation-acceptance.md`
   overstates Grammar 7 and 8 as behaviorally unchanged. Candidate bytes,
   authority, schema identity, and semantic meaning remain compatible, but the
   result now exposes exact localized edits instead of the former broad
   replacement behavior, and the library result adds `edits`.
2. The denied installed-package replay proves no-write, denial, outer binding,
   candidate reconstruction, and Planning Pool block identity, but it does
   not directly assert the requested two edits, old criterion and receipt
   removal, new criterion retention, Contract 10 identity, and result-schema
   validity. The runtime passed an independent replay; the durable installed
   evidence is incomplete.

### P3 findings to resolve in the same correction

1. `docs/basic-design.md` calls `0.11.0` selected while its owner decision is
   still proposed.
2. The technical acceptance causal analysis lists the hard-coded envelope and
   safe-write mapping as contributing causes of the composition defect; they
   are separate coexisting interface defects, not causes of missing
   composition.
3. ADR 0003 modifies the machine-readable `Status` value. Preserve
   `Status: Accepted` and state the accepted base-decision scope and proposed
   amendment status in separate metadata.

## 4. PERT and authority state

`plans/planning-pool-release-readiness.pert` is valid Grammar 6 at source
digest
`sha256:f2f8f321e8fc142cadfc62fcd7e4e19bba4eec84417448dabd744b85870f4ec1`.
`POOL_GRAMMAR9_ACCEPTANCE_MUTATION` is structurally done but has no Outcome.
Plan assurance reports `outcome_missing` and requires
`restore_assurance_evidence`. `POOL_RELEASE_GATE_DESIGN` is structurally ready
and recommended but is not startable; the same cause propagates through all
later release tasks.

No criterion set, receipt, task Outcome, owner assertion, plan advance,
package-version preparation, retained release tarball, tag, GitHub Release,
npm publication, distribution-tag mutation, Issue closure, Goal Seal work, or
affected-test selector work is authorized or completed by this checkpoint.

## 5. Resume procedure

1. Run the repository-start preflight and confirm this branch, its upstream,
   HEAD, remote base, and clean worktree before making changes.
2. Read this handoff, the technical acceptance record, the `0.11.0` gate
   design, ADR 0003, and the release-readiness PERT.
3. Correct all two P2 and three P3 findings without registering assurance
   evidence or starting the gate-design task.
4. Run the focused Contract 10, milestone-acceptance, release-design, English,
   documentation, package, and diff checks, then repeat the complete
   `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run check` gate because production,
   package, and lifecycle evidence are coupled.
5. Freeze the exact changed-file manifest and hashes and obtain a fresh,
   non-authoring, read-only review covering P0 through P3.
6. Only after an independent PASS, prepare the exact criterion-set, receipt,
   and conformant Outcome previews for
   `POOL_GRAMMAR9_ACCEPTANCE_MUTATION`. Explain Outcome validity in one or two
   lines and obtain a new candidate-bound owner confirmation before any PERT
   write.
7. Re-read assurance and Next results after that write. Gate design,
   preparation, candidate commitment, PUBLISH, durable acceptance, and every
   external mutation remain separate decisions.

## 6. Useful read-only commands

```sh
git status --short --branch
git log --oneline --decorate origin/main..HEAD
node dist/cli.js document check plans/planning-pool-release-readiness.pert --format json
node dist/cli.js dag analyze plans/planning-pool-release-readiness.pert --schedule both --format json
node dist/cli.js dag next plans/planning-pool-release-readiness.pert --format json
node --test test/contract10-milestone-acceptance-mutation.test.mjs test/milestone-acceptance-mutation.test.mjs test/release-0.11.0-design.test.mjs
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run check
git diff --check
```

Use `secdat exec git push ...` for any later authorized remote Git write. Do
not infer release or assurance authority from this WIP commit or its remote
availability.

## 7. 2026-08-31 resumption

Candidate 1.4 remediates all five Candidate 1.3 review findings without
changing the corrected runtime mechanism. The denied installed-package replay
now requires the exact Contract 10 mutation identity, two localized edits,
old criterion-set and receipt removal, the new criterion, unchanged source and
Planning Pool blocks, and strict validation against the schema catalog shipped
in that installed package. Compatibility wording now distinguishes preserved
candidate semantics and schema identity from the corrected edit payload;
causal analysis classifies the envelope and safe-write defects separately.
Basic Design and ADR 0003 now keep proposal and accepted lifecycle metadata
machine-readable and distinct.

The complete Candidate 1.4 gate passed 1,336 tests, the 1,307-file English
baseline, 374 Markdown and 7 PERT documentation inputs, 46 self-use plans, and
the 1,019-file installed-package workflow. Frozen changed-file hashes, fresh
independent exact-byte review, and the separately reviewed owner-confirmed PERT
Outcome completed at commit `cca61590bc69869d786bff651491f5b5ea37c5e5`.
The authority exclusions in sections 4 and 5 remain unchanged.

## 8. Candidate 2.0 release-gate audit

`POOL_RELEASE_GATE_DESIGN` started at `2026-08-31T14:39:25+09:00`. Fresh npm,
Git, and GitHub reads retain `beta=0.10.6`, `latest=0.10.5`, unused `0.11.0`,
and exact `0.10.6` rollback, so the proposed minor version remains truthful.
The gate is not ready for acceptance: Candidate 2.0 records two P1 findings.
Generic Grammar 7 through 9 assurance mutation preserves a nested governance
decision bound to lowered source bytes, and Issue #37 permits a complete
NextResult to recommend a task that it marks non-runnable. The exact reviewed
external mutation pair was applied once: open Issue #38 has the exact reviewed
body and `bug` plus `priority:P1`, while open Issue #37 gained only those two
labels. Their readback excluded comments, assignees, milestones, and project
items. The exact two-step PERT replan was separately authorized, applied once,
and independently read back at 31,121 bytes with SHA-256
`6c0592deaa94395325fffc817e855a1732db3d13f0bc5b36c3cb0ecb4fe7b3b5`.
It leaves both new tasks unsealed and five existing release tasks review-
required. Reseal, correction implementation, gate finish, Outcome,
preparation, and every external release write remain pending separate
authority.

## 9. Issue #37 selected-frontier reseal

The separately reviewed and owner-authorized reseal selected only
`POOL_NEXT_SIGNAL_CONSISTENCY`. One expected-digest write changed the PERT from
31,121 bytes and
`sha256:6c0592deaa94395325fffc817e855a1732db3d13f0bc5b36c3cb0ecb4fe7b3b5`
to 31,574 bytes and
`sha256:23ef7711c89afba91733e540e0bd4a91675cbfd6672af2f4c19f4b1bdfe510b7`.
Readback reports that task as verified and the sole runnable, recommended, and
startable task. `POOL_GOVERNANCE_BINDING_FIX` remains unsealed. Gate Design is
still suspended, and Preparation, Candidate, Publish, and Acceptance remain
review-required. No task start, Outcome, Gate Design resume, commit, push,
Issue mutation, or release operation followed from the reseal.
