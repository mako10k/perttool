# Issue #19 retained milestone acceptance correction

- Status: Local source accepted
- Date: 2026-08-14
- Scope: `ADV-006` implementation and repository evidence
- External state: Issue #19 remains open; published `0.9.3` remains affected

## Decision

The local correction is accepted. Contract 8 `dag advance` now protects the
exact acceptance-record spans owned by every milestone in
`keptMilestoneIds`, continues to remove records owned by
`removedMilestoneIds`, and reports diagnostics from the complete composed
Contract 8 candidate. Release selection, publication, consumer-plan writes,
Issue closure, plan advance, and resumed editor work remain separate.

## RCA

The structured RCA is
[`issue-19-advance-criterion-rca.think`](issue-19-advance-criterion-rca.think).
`llmthink dsl audit` completed with zero fatal, error, or warning findings and
one intentional information finding for the unselected release boundary. The
thought was finalized under ID
`docs-process-issue-19-advance-criterion-rca`, and the repeated thought audit
returned the same result.

Direct code and range inspection established two distinct causes:

1. The milestone-acceptance layer masks Grammar 7 records with
   offset-preserving comment-shaped Grammar 6 trivia. Lower advance layers can
   therefore produce a valid pure-deletion range crossing those masked spans.
2. The original Issue #17 correction split those ranges around
   `stateChangedMilestoneIds`. Issue #19 contains accepted records owned by
   unchanged retained milestones, so that set was narrower than the true
   ownership boundary.

The detection escape was independent: final CLI composition parsed acceptance
syntax but reused the lower Contract 7 diagnostics. A candidate that lost
required retained criterion sets could therefore report no diagnostic even
though a fresh Contract 8 check produced `PTMAC-102`.

## Reported-plan reproduction

The external plan
`/home/katsumata-m/image/plans/image-platform.pert` was read without modifying
the image-platform repository. Its exact source digest was
`sha256:52e3feb15e3937fbe662a288d500527636ee3db33261c4629f6fa67055d9f7d7`.
Before the correction, preview returned `ok: true` and no diagnostics with
candidate digest
`sha256:0e68a855416f897657758b8561248087fefca8f0bcc9e9044697dfea36e565c0`,
but removed the retained criterion sets for:

- `DETERMINISTIC_RASTER_READY_R1`;
- `DETERMINISTIC_BATCH_READY_R1`;
- `I2I_GUIDANCE_READY_R1`;
- `ADVANCED_IMAGE_EDITING_READY_R1`;
- `DETERMINISTIC_COLOR_READY_R1`; and
- `EDIT_INTERMEDIATE_PREVIEWS_READY_R1`.

A fresh candidate check reported six `PTMAC-102` diagnostics. The separate
`I2I_CONTROL_READY_R1` set belonged to the milestone actually removed by advance
and was correctly contracted.

## Correction

`composeProvisionalBase` and final CLI composition now pass
`keptMilestoneIds` to the accepted exact-span preservation function. Existing
acceptance-removal edits remain derived from `removedMilestoneIds`. After all
assurance and acceptance edits are composed, the CLI executes the complete
Contract 8 checker and uses that result's diagnostics and truncation state.

No command, grammar construct, schema, result identity, authority policy,
force option, shared edit-normalization rule, or persistence boundary changed.

## Focused acceptance

`test/issue-19-advance-criterion-retention.test.mjs` covers four independent
properties:

1. a synthetic branch topology places acceptance records for a state-changed
   and an unchanged retained milestone inside a lower-layer deletion span and
   proves all retained records remain byte-identical;
2. real CLI preview, separate output, and clean tracked in-place write produce
   the same candidate, pass the history guard, and pass
   `document check --warnings-as-errors`; and
3. removal of a retained finish criterion set is reported as final-candidate
   `PTMAC-102`, proving that diagnostics are not stale; and
4. requirements, design, correction contract, acceptance record, and backlog
   retain the same local-versus-release boundary.

The corrected read-only image-platform preview retained all six affected sets,
removed only `I2I_CONTROL_READY_R1`, and produced candidate digest
`sha256:26d3a6dc49da2da3c73e3384573cd33df111f11561c8cdb4422cc68dbba84682`.
The exact candidate passed `document check --warnings-as-errors` with no
diagnostics.

## Acceptance boundary

The complete `npm run check` gate passed after the correction:

- 1,090 repository tests passed;
- jscpd 5.0.15 passed its ratchet with 148 clones, 2,746 duplicated lines,
  and 3.350%;
- lizard 1.23.0 passed its ratchet over 3,540 functions and 173 accepted legacy
  entries;
- the English baseline checked 918 text files and three allowlisted lines;
- documentation checked 281 Markdown files and seven PERT examples;
- read-only self-use checked all 42 plans;
- isolated LSP, MCP, supported-host VSIX, temporary-link, and public-package
  gates passed; and
- the 717-file `perttool@0.9.3` dry-run artifact passed installed Contract 8
  file-first and plan-assurance compatibility checks.

The self-use recommendation golden was synchronized with the already accepted
`EDITOR_REPAIR_CONTRACT` completion: source digest
`sha256:fac511d01ca7bcb632203fb1e255723a82f19043cb3731a7e92f71d55987af00`
now recommends only `EDITOR_REPAIR_ACCEPTANCE`. This mechanical correction did
not modify the selected plan or resume its paused task.

These gates establish repository compatibility; the specific Issue #19
behavior is owned by the focused Core and real CLI cases above.

This record does not select a version, create a release plan, modify a consumer
plan, push a source revision, publish a package, move a dist-tag, close Issue
#19, advance a plan, or resume `EDITOR_REPAIR_ACCEPTANCE`.
