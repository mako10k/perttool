# Plan Review release boundary candidate

Date: 2026-09-30
Status: Exact 0.12.0 version and local preparation selected by the owner on 2026-09-30
Source: `codex/issue-21-plan-review`, `e39c739f07558cf0d6030ea89196856459efaed9`
plus retained local implementation and acceptance changes.

## Proposed target and user benefit

Select suffix-free `0.12.0`, npm `beta`, and GitHub prerelease for the accepted
Plan Review Request capability. Publish Grammar 10 and CLI Contract 11,
including four Plan Review command paths, 31 active root schemas, 155 root/Node
runtime exports and unchanged 51 Core exports. The complete Next projection
exposes plan-review state before operational recommendation. Retain exact
`perttool@0.11.1` as the previous public rollback pin. Downgrading a Grammar 10
document to a Grammar 9 consumer is not promised by that pin.

ADR 0003's accepted beta-minor pattern supports this proposed version;
`0.11.x` would understate the new grammar and contract boundary. This candidate
does not amend the ADR or select the version on the owner's behalf.

Realized public-package value remains zero until distribution and verification.
The local contribution is completed, tested technical conformance; published
consumers still receive the prior artifact. The prospective benefit is explicit
review-request tracking and guarded atomic resolution through public APIs and
CLI, once the accepted distributable is installed.

## Incident decision and evidence

The confirmed owner decision in
[mcp-discovery-timeout-rca-2026-09-30.md](mcp-discovery-timeout-rca-2026-09-30.md)
allows release judgment after a successful rerun without complete attribution
of the original timeout. The default-concurrency instrumented rerun passed all
1,421 tests. Timeout-budget adjustment remains separate work.

[plan-review-acceptance.md](plan-review-acceptance.md) retains the complete
technical trace and full local/installed-package gate evidence. Technical
completion does not supply milestone receipts or publication authority.

## Remaining release sequence and decisions

1. Owner selected the exact 0.12.0 version and local preparation scope.
2. Prepare the governed release-plan candidate through the standard preview
   route; align version-bearing surfaces, migration and release documentation;
   verify the complete supported gates on the resulting source.
3. Freeze clean committed source and one immutable tarball, then verify exact
   installed behavior, previous-version boundaries, unused external identities,
   and authenticated routes. Commit and remote writes need their own scope.
4. Present the exact candidate commit, artifact hashes, publication payload and
   visibility for the publication decision.
5. Execute separately authorized publication once, verify CI and independent
   registry/release readback, then verify installed exact and beta artifacts.

npm `latest` movement, public VSIX publication, Issue mutation, feature-plan
advance, timeout changes and velocity-observation repair are outside this
candidate. No remote freshness, version availability or publication is claimed.

## Plan state and forecast

The canonical feature plan `plans/plan-review-request.pert` passed document
check, both schedule analyses and complete Next inspection again. All five
feature tasks are done; remaining feature effort is zero. Existing undeclared
milestone-acceptance warnings remain, with no owner receipts manufactured.

Current velocity observation supplies `PTHIS-102` warnings for unsupported
source versions, so it is not a usable release-effort sample. Previously
measured acceptance active time was 39 minutes 8 seconds for a bounded final
interval, with independent person effort unmeasured; it is not converted into
release velocity.

Provisional remaining local release preparation and candidate verification:
1.0-2.0 agent-hours, low confidence, assuming one version-alignment pass and one
complete gate without a newly discovered contract issue. This excludes owner
waiting, external CI/registry waiting and publication execution. The next
measurement checkpoint is the selected preparation task's actual start and
completion; record only observed active time and independently measured effort
through the authorized canonical plan route. No release date is asserted.
