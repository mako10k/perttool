# Issue 45: committed-source proof correction

- Scope: existing Grammar 7 migration contract, focused local correction
- Issue: https://github.com/mako10k/perttool/issues/45
- Source base: 62f6d158141007ef91d00c87a0deb0b4e66a845b (0.12.2 source)
- Fix commit: c3b5878e40f272a3f6a3ecfa567e00ff27ea2a0d
- Forward compatibility check: f3b7aecfd4d10b54a656155098d74122837225c5
  over the independently completed local VSIX/model-2 branch
- Authority: bounded delegated Issue 45 correction; no release, remote write,
  global CLI replacement, VSIX installation or kn canonical mutation
- Governing contract: [milestone acceptance, section 7](../specs/milestone-acceptance.md)

## Fixed boundary and reasoning

The generic advance capture legitimately permits retained dirty ranges. It
already captures current, HEAD and index raw-content digests separately. The
G7 projection supplied currentSourceDigest as proof.sourceDigest, so the Core
compared current text with itself. Repetition of that proof established stability
without committed-content equality. The projection now requires and supplies
the captured HEAD digest. The existing Core comparison then checks actual input
text against committed content; its HEAD/index blob check remains independent.

The public proof shape, clean candidate commitment, parser, migration record,
result schema, export catalogs and normal advance capture are unchanged. The
sourceDigest field comment now identifies its committed HEAD origin. The pure
public planner consumes caller-supplied proof assertions; it does not authenticate
arbitrary dishonest callers or persist a file. CLI persistence must obtain that
proof from the real bounded Git capture. No new proof representation is required.

Focused phase testing additionally found that the final safe-write conflict
escaped the G7 runner as exit 70. It now retains the typed SafeWriteConflictError
classification as PTMAC-110 / exit 5, without retrying or swallowing unrelated
IO or verification failures. Initial unavailable capture remains PTMAC-109 /
exit 1; stable source/HEAD mismatch retains source_digest_mismatch / exit 1;
index mismatch retains stage0_not_equal_to_head / exit 1.

The command-line reasoning audit is retained in
issue-45-committed-source-rca.think. Its final audit has zero fatal, error or
warning findings. The pending-scope informational finding and heuristic hints
remain visible in the raw artifact log; the audit is not evidence of owner
permission or external truth. Two initial red tests reproduced the producer
failure before correction. The first final-guard test independently exposed
exit 70 before the additional phase correction.

## Validation and phase boundary

The review question is whether the existing committed-source and stale/race
rules are enforced by the real G7 producer, Core consumer and persistence path.
A real dirty write remaining possible is INSIDE. A new reconciliation contract,
release adoption or migration of kn is OUTSIDE. No material boundary dispute
was identified. The canonical completed VSIX plan was inspected and retained;
this bounded fix is tracked separately by Issue 45 and this focused record.

The release-base candidate passes 55 focused tests, including the 23 dedicated
Issue 45 cases, existing source/history/parser consumers, safe persistence,
public-contract preservation and later grammar migration. Six existing normal
advance tests independently retain clean/retained-dirty success, destructive
refusal, governance precedence and CLI races. All workspaces build on Node.js
22.22.3. Complete static checks pass: 147 clones, 2,735 duplicated lines,
5,403 functions and 168 baseline legacy entries, with no threshold increase.

The dedicated cases cover clean SHA-1/SHA-256 repositories, raw comment and
line-ending deltas, dirty/staged combinations, unrelated dirty files, wrong or
missing target origin, unborn HEAD, CRLF/Unicode, missing committed digest,
all proof identity fields, source/HEAD/index movement during capture and
recapture, final caller digest conflicts and preservation of the same G7
baseline through Grammar 8/9/10. Real wrapper mutations are independently
asserted to have occurred. All rejected writes preserve the applicable target
bytes and do not install a migration record.

The local latest/model-2 branch also passed 55 focused source/history/write
checks, six advance checks, nine public/format compatibility checks and complete
static checks before the fix was separately applied to the release base. Those
observations do not make the published installed CLI the whole latest-tree
artifact. No complete repository suite or Node.js 24 CI run is claimed for
this bounded request; release acceptance remains a later boundary.

## Retained actual artifact

Directory: `/home/katsumata-m/perttool-artifacts/issue-45-20261029-c3b5878`

- Source fix SHA: c3b5878e40f272a3f6a3ecfa567e00ff27ea2a0d
- Tarball: perttool-0.12.2.tgz (local test candidate, 1,112 files)
- Tarball SHA-256:
  21437c60d2da88996394ef7dd0394fcd2fb870c8aca9446fbd32ea7907ea8a1d
- Actual CLI: installed/node_modules/perttool/dist/cli.js
- CLI SHA-256:
  72673d9c1b9bab475b1985f77d784a911f97bbfe003efb7feacbfcbd936e07c3
- Corrected runDocumentMigration: 3,483 bytes, SHA-256
  a91747dcb00f2b2bf8d4f622edcbe2478b93c0e093de679ef35e3859b49ec124
- receipt.json, replay command vectors, raw before/after/stdout/stderr,
  original portable bundle and logs remain alongside the artifact.

The actual installed candidate was replayed against clones of the supplied
portable bundle, rather than only against source test doubles. Clean preview
is byte-identical to the old CLI and clean write succeeds. The old installed
CLI still reproduces dirty write exit 0; the candidate returns exit 1 and
preserves those dirty bytes. The staged mismatch refuses. The old final guard
returns exit 70 without a write; the candidate returns PTMAC-110 / exit 5.

The old global CLI full SHA-256 is
600f4b233a5e2804e6da65faaa39e98ca0586ce04b370463e5a5304d1ebd16e4.
Its inspected migration function is 3,138 bytes at SHA-256
9cdff17594a06fe80392c0090f56d59b8fcaa641acf364924587e6cf5a97a9d6.
No whole installed source revision is inferred from that function match.
The global installation remains untouched. Both the global CLI and this local
candidate report base version 0.12.2, so version text alone cannot identify the
fix: use the path, receipt and exact artifact hashes above.

## kn consumer readback and next boundary

The stable observed frontend snapshot SHA-256 was
7e7e450b0d541e4c8152a6adaa96735e8a5bb28062017dce699b3db39f0ef40a.
Only a copy was put into a disposable repository. Its committed copy previews
successfully and its comment-only raw-dirty copy refuses persistence. The live
frontend file was not written and remained byte-identical during this replay.
Fixture migration outputs must not be copied back into kn: their repository,
HEAD and path provenance belongs to the fixture, not to the canonical consumer.

Before any later separately authorized kn migration, its Hub writer must pin
the selected artifact path/hash, recheck the live regular target and actual
repository/path identity, confirm current raw bytes equal the target HEAD blob
and stage-0 equals HEAD, and use a fresh digest guard. A successful copy test or
preview is not authority for a canonical migration or milestone acceptance.
The original evidence bundle and failed-source observations remain retained.

## Separate PTHIS-102 and recovery assessment

No identity-reconciliation behavior was added to Issue 45. The inspected
project-history model 1 derives task identity from the from/to pair and records
task_identity_replaced when it changes. It has no reviewed-continuation input
in the inspected source or public command surface. The existing local common
historical model 2 is a distinct read-only DAG/history observation surface; it
is not a replacement for project-history reconciliation and does not rewrite
its PTHIS-102 result. It is not bundled into this release-base artifact.

The primary worktree contains an owner-acceptance record for Plan Recovery 0.5
whose requirement bytes match SHA-256
54f1373900365d1738e77bda1fb1a28000be1f1a676eb7965c532d7705593348.
Its R1 unstarted correction overlaps the new three planned/event-free scope
redistributions. Its R3 non-success/retirement design must not automatically
reclassify the old four successful continuity/aggregate-separation cases as
failure. The inspected R3 contract candidate 0.4 explicitly says Proposed and
no runtime/source-format activation; requirement acceptance does not prove an
implemented or distributed reconciliation route.

The seven-case assessments supplied by kn remain separate owner inputs. Review
continuation, contract replacement and actual-event attribution against the
accepted recovery requirement and pending downstream design before choosing a
normalization route. No already usable canonical reconciliation operation was
confirmed by this bounded inspection; that uncertainty is not permission to
suppress warnings, reuse old success for a new contract, adopt the candidate
route, alter kn or extend Issue 45. No new requirement was adopted here.
