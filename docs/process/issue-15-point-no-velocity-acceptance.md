# Issue #15 Point-without-Velocity Acceptance

- Document status: Accepted 1.0
- Decision date: 2026-08-14
- Backlog: [`ANALYSIS-001`](../backlog.md#analysis-001-analyze-point-plans-without-declared-velocity)
- External report: [GitHub Issue #15](https://github.com/mako10k/perttool/issues/15)
- Release status: Selected for `0.9.2`

## 1. Reproduced defect and cause

The released `perttool@0.9.1` and the exact `v0.9.1` source both accept the
Issue fixture after removing its declared velocity, but `dag analyze` and
`dag next` terminate with `PTCLI-070` because the temporal input projector
reads `periodUnit` through a non-null assertion. The active local executable
was `0.9.1`, so the failure was not caused only by an obsolete installation.

The source contract and `project show` both retain optional velocity for Point
plans. The defect is therefore the temporal layer's stronger, unversioned
assumption rather than source validation, base scheduling, or recommendation
semantics.

## 2. Accepted correction

The effective temporal projection now retains a nullable calendar unit. A
Point plan without velocity keeps its exact Point base unit and exposes no
velocity conversion. If source calendar fields actually require conversion,
the existing unavailable-cause projection now includes `missing_velocity`.
No default rate, wall-clock read, unit migration, or source mutation occurs.

The correction does not change Grammar 7, CLI Contract 8, any command or
option, result identity, schema identity, package facade, base PERT/resource
algorithm, recommendation ranking, governance decision, or mutation path.
Adding `missing_velocity` to the existing unavailable-cause enum is the
intended fail-closed representation already required by the temporal deadline
contract.

## 3. Acceptance evidence

Focused Node.js 22 tests exercise the exact Issue #15 fixture with only its
velocity line removed. They establish:

- successful `document check` and `project show` with `duration_unit=point`
  and `velocity=null`;
- successful precedence-only, resource-only, and combined `dag analyze`;
- Point-valued precedence and resource makespans with
  `velocity_forecast=null`;
- successful `dag next`, unchanged recommended and startable task
  `GATE_NEAR`, Point-valued task facts, and null per-task forecasts;
- byte-source-equivalent semantic results from file and stdin operands; and
- explicit `missing_velocity` for a Point plan whose calendar release bound
  cannot be converted.

The complete repository, package, CI, public-artifact, and installed-package
evidence is required by the separate `0.9.2` release procedure before Issue
#15 can be closed.

## 4. Remaining boundaries

npm `latest` promotion, public VSIX publication, release-plan advance,
automatic velocity selection, plan migration, and unrelated work remain
separate. The retained Editor E0 work on the original work-in-progress branch
is not part of this correction or release.
