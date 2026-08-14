# Issue #19 retained milestone acceptance correction

- Status: Local source accepted; release acceptance pending
- Date: 2026-08-14
- Scope: `ADV-006` implementation and repository evidence
- Selected release: compatible patch `0.9.4`

## Decision

The local correction is accepted. Contract 8 `dag advance` now protects the
exact acceptance-record spans owned by every milestone in
`keptMilestoneIds`, continues to remove records owned by
`removedMilestoneIds`, and combines diagnostics from the complete composed
Contract 8 candidate with operation diagnostics. Publication and Issue closure
remain ordered behind the immutable candidate and durable public readback.

## RCA

The structured RCA is
[`issue-19-advance-criterion-rca.think`](issue-19-advance-criterion-rca.think).
`llmthink dsl audit` completed with zero fatal, error, or warning findings and
one intentional information finding for the then-unselected release boundary.
The thought was finalized under ID
`docs-process-issue-19-advance-criterion-rca`.

The milestone-acceptance layer masks Grammar 7 records with offset-preserving
comment-shaped Grammar 6 trivia. Lower layers can therefore produce a valid
pure-deletion range crossing those masked spans. The Issue #17 correction
split those ranges around `stateChangedMilestoneIds`; Issue #19 contains
records owned by unchanged retained milestones, so that set was narrower than
the true ownership boundary.

The detection escape was separate: final CLI composition parsed acceptance
syntax but retained only lower Contract 7 diagnostics. A candidate that lost
required retained criterion sets could report no diagnostic even though a
fresh Contract 8 check produced `PTMAC-102`.

## Reported-plan reproduction

The external plan
`/home/katsumata-m/image/plans/image-platform.pert` was read without modifying
the image-platform repository. Its exact source digest was
`sha256:52e3feb15e3937fbe662a288d500527636ee3db33261c4629f6fa67055d9f7d7`.
Before the correction, preview returned `ok: true` and no diagnostics with
candidate digest
`sha256:0e68a855416f897657758b8561248087fefca8f0bcc9e9044697dfea36e565c0`,
but removed these retained criterion sets:

- `DETERMINISTIC_RASTER_READY_R1`;
- `DETERMINISTIC_BATCH_READY_R1`;
- `I2I_GUIDANCE_READY_R1`;
- `ADVANCED_IMAGE_EDITING_READY_R1`;
- `DETERMINISTIC_COLOR_READY_R1`; and
- `EDIT_INTERMEDIATE_PREVIEWS_READY_R1`.

A fresh candidate check reported six `PTMAC-102` diagnostics. The separate
`I2I_CONTROL_READY_R1` set belonged to the milestone actually removed by
advance and was correctly contracted.

## Correction and focused acceptance

`composeProvisionalBase` and final CLI composition now pass
`keptMilestoneIds` to the exact-span preservation function. Existing removal
edits remain derived from `removedMilestoneIds`. The CLI checks the complete
Contract 8 candidate and deterministically combines those diagnostics with
operation diagnostics under the existing limit.

`test/issue-19-advance-criterion-retention.test.mjs` proves:

1. byte-identical retained records for state-changed and unchanged milestones
   whose spans are crossed by a lower-layer deletion;
2. real CLI preview, separate-output, and clean tracked-write candidate
   identity with the history guard and warnings-as-errors;
3. final-candidate `PTMAC-102` projection instead of stale diagnostics; and
4. requirements, design, correction contract, acceptance record, and backlog
   agreement.

The corrected read-only image-platform preview retained all six affected sets,
removed only `I2I_CONTROL_READY_R1`, and produced candidate digest
`sha256:26d3a6dc49da2da3c73e3384573cd33df111f11561c8cdb4422cc68dbba84682`.
The exact candidate passed `document check --warnings-as-errors` with no
diagnostics.

No command, grammar construct, schema, result identity, authority policy,
force option, shared edit-normalization rule, or persistence boundary changed.

## Release boundary

Repository, documentation, static-analysis, private-adapter, temporary-link,
isolated-package, exact installed-package, and rollback gates remain required
for the immutable `0.9.4` candidate. GitHub/npm publication must use one
tarball and close Issue #19 only after durable readback. npm `latest`, public
VSIX publication, consumer-plan writes, and unrelated feature work remain
separate.
