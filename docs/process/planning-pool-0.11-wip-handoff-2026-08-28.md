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
