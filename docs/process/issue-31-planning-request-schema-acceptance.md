# Issue #31 Planning Pool Request Schema Acceptance

Document status: Accepted 1.0  
Acceptance date: 2026-08-26  
Implementation scope: local source and package candidate only

## 1. Accepted boundary

Issue #31 is complete in the current local source. The public schema catalog
adds exactly these three standalone Draft 2020-12 request roots:

- `Perttool.PlanningObservationRequest.v1`
- `Perttool.PlanningReshapeRequest.v1`
- `Perttool.WindowMutationRequest.v1`

The catalog therefore grows from the historically accepted 26 result or
library roots to 29 current roots. CLI Contract 10 remains at 67 commands,
and the root, Node, and portable Core export counts remain 139, 139, and 51.
Grammar 9, package version `0.10.5`, result identities, request meanings, and
write authority are unchanged.

## 2. Evidence

- **E-REQSCHEMA-001:** Issue #31 and
  `plans/planning-pool-release-readiness.pert` select exactly three identities
  and require closed roots, catalog/package discovery, strict enum and unknown-
  field rejection, Help linkage, compiled examples, and atomic count updates.
- **E-REQSCHEMA-002:** The existing result artifacts already own the exact
  request definitions at
  `Perttool.PlanningPoolResult.v1#/$defs/request`,
  `Perttool.PlanningReshapePreflightResult.v1#/$defs/normalizedRequest`, and
  `Perttool.PlanningMutationResult.v1#/$defs/windowRequest`.
- **E-REQSCHEMA-003:** `test/issue-31-planning-request-schemas.test.mjs`
  resolves all three public roots, compiles all bundled artifacts under strict
  Draft 2020-12, validates the three documented examples, rejects unknown root
  fields and invalid enum/version values, and verifies all seven applicable
  Help option links.
- **E-REQSCHEMA-004:** `TMPDIR=/tmp npm test` passed all 1,317 tests on
  2026-08-26 with zero failure, cancellation, skip, or todo.
- **E-REQSCHEMA-005:** `npm run check:static` passed TypeScript checking for
  the root and all three private adapters, the pinned jscpd 5.0.15 ratchet at
  147 clones / 2,743 lines / 2.680%, and the pinned Lizard 1.23.0 ratchet at
  5,085 functions / 168 legacy entries.
- **E-REQSCHEMA-006:** `bash scripts/check-package.sh` accepted the generated
  1,019-file `perttool@0.10.5` tarball, its dry-run publication route, isolated
  install, all three request artifacts, and installed CLI/API selection of
  every new identity.
- **E-REQSCHEMA-007:** `bash scripts/check-npm-link.sh` accepted the temporary
  link, catalog count 29, and installed selection of all three request roots;
  npm reported zero vulnerabilities.
- **E-REQSCHEMA-008:** `git diff --check` passed. The separately scoped,
  Codex-authored proposed ADR 0009, created at the user's request to save the
  Goal Coverage consideration, remained outside this change and was later
  committed separately at `f761dfb`.

## 3. Claims and reasoning

- **C-REQSCHEMA-001 `high`, accepted:** The three standalone roots are exact
  discovery surfaces for existing request contracts rather than new semantic
  owners. References: E-REQSCHEMA-001, E-REQSCHEMA-002, E-REQSCHEMA-003.
- **C-REQSCHEMA-002 `high`, accepted:** Schema discovery, Help, source tests,
  tarball inventory, isolated installation, and temporary linking agree on one
  current 29-root catalog. References: E-REQSCHEMA-003, E-REQSCHEMA-004,
  E-REQSCHEMA-006, E-REQSCHEMA-007.
- **C-REQSCHEMA-003 `high`, accepted:** The additive schema publication does
  not widen Planning Pool commands, runtime exports, mutation authority, or
  release authority. References: E-REQSCHEMA-001, E-REQSCHEMA-002,
  E-REQSCHEMA-004, E-REQSCHEMA-005.

The roots reference the already active closed definitions instead of copying
their fields. This keeps one semantic owner while allowing a consumer to
compile a request before invoking a Planning Pool command. The reshape root
additionally constrains the shared normalized request definition to the v1
schema identity and normalization contract; the existing v2 intent-builder
shape remains outside Issue #31.

## 4. Actions

- **A-REQSCHEMA-001 `implementation permitted`, executed:** add the three
  standalone schema artifacts and public catalog entries. Reference:
  C-REQSCHEMA-001.
- **A-REQSCHEMA-002 `implementation permitted`, executed:** link the seven
  applicable low-level `--request` Help options to their exact schema command.
  Reference: C-REQSCHEMA-002.
- **A-REQSCHEMA-003 `implementation permitted`, executed:** add compiled
  examples, strict source tests, installed-package checks, and current-count
  assertions while retaining historical 26-root evidence. References:
  C-REQSCHEMA-002, C-REQSCHEMA-003.

## 5. Retained boundaries

This acceptance does not authorize or perform a commit, push, Issue mutation,
release selection, tag, GitHub Release, npm publication or dist-tag movement,
Planning Pool plan advance, or a successor-task start. The current PERT task
may be finished locally after this record and the final source readback agree;
its assurance outcome remains a separate candidate-bound confirmation.
