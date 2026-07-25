# SU-M2R Exact Rational Duration Acceptance

- Document status: Accepted 1.0
- Acceptance date: 2026-07-25
- Accepted contract:
  [SU-M2R contract acceptance](scheduling-units-m2r-contract-acceptance.md)
- Macro plan:
  [../../plans/scheduling-units.pert](../../plans/scheduling-units.pert)
- Detail plan:
  [../../plans/scheduling-units-m2r.pert](../../plans/scheduling-units-m2r.pert)
- Interface acceptance IDs: `TUI-001` through `TUI-020`
- Example baseline: `Perttool.TemporalUnitExampleBaseline.v2`

## 1. Decision

Accept the internal SU-M2R exact Rational Duration extension. Grammar 3 source
accepts Decimal or unsigned Fraction Duration, retains one reduced Rational
semantic value and source span, and uses one exact serializer for explicit
formatting, changed mutation fields, and future migration output. The internal
version boundary retains Grammar 1 or 2 for all-Decimal generated values,
upgrades one candidate to Grammar 3 when any generated value requires a
Fraction, and never automatically downgrades Grammar 3.

This acceptance removes the representability blocker behind the former
finite-Decimal-only TUE-015 result. The normative migration observation is now
an exact successful Grammar 3 candidate. SU-M2R provides the validated source,
serializer, formatter, mutation, safe-write, and grammar-selection components
needed to produce that candidate. SU-M4 still owns the migration inventory,
conversion orchestration, result projection, failure closure, no-op, repeat,
and inverse workflow; this acceptance does not claim that a migration command
exists.

The extension remains internal. Active Grammar 1, CLI Contract 3, the
27-command registry, public result identities, root exports, help, Guide,
README workflows, installed-package behavior, and normal NextResult v3
authority are unchanged. The source checkout and isolated installed package
reject Grammar 3 through the existing Contract 3 result identities.

There are no open SU-M2R acceptance findings. SU-M3 and SU-M4 may consume the
accepted exact syntax and internal target capabilities, but public Grammar 3,
CLI Contract 4, target result publication, release, and external distribution
remain the separately gated SU-M5 boundary.

No Git push, GitHub release, npm publication, or dist-tag change is authorized
by this acceptance.

## 2. Accepted implementation boundary

| Capability | Accepted SU-M2R implementation | Public boundary |
| --- | --- | --- |
| Grammar 3 source | Identity-checked target parsing and validation accept Decimal or exact Fraction Duration while inheriting Grammar 1/2 closure and temporal validation | Active parsing remains Grammar 1 |
| Exact source model | Duration Decimal and Fraction tokens normalize to exact Rational values while retaining original text and spans | No target source type is exported from the package root |
| Serialization | One pure serializer emits the shortest exact Decimal or reduced Fraction and never uses display rounding | No public migration result or command is added |
| Explicit formatting | The Grammar 3 formatter canonicalizes every Duration, preserves temporal and unrelated source, and is idempotent | Active formatting rejects Grammar 3 |
| Mutation and batch | Project/task changes canonicalize only changed Duration fields; one final candidate may explicitly enter or leave Grammar 3 | Contract 3 exposes no target mutation option |
| Safe write | Grammar 3 candidates reuse digest, diff, in-place, out, symlink, race, and post-write verification mechanics | No separate public write route is added |
| Grammar boundary | Canonical generated tokens select retention or one localized version upgrade and report grammar, reversibility, and qualification metadata | SU-M4 still owns complete migration orchestration and UnitMigrationResult v2 |

The package root continues to export only `"."`. It does not expose the
Grammar 3 capability, parser, validator, formatter, mutation, safe-write,
serializer, grammar selector, or version-candidate planner.

## 3. Interface observation trace

| ID | SU-M2R evidence | State after SU-M2R |
| --- | --- | --- |
| `TUI-001` | The target Grammar 3 capability alone accepts Fraction Duration; Grammar 1 and Grammar 2 rejection remains covered | Exact source delivered; public activation remains SU-M5 |
| `TUI-002` | Grammar 3 inherits the explicit `as_of`, mixed-kind, and no-host-clock rules from Grammar 2 | Source validation delivered; calendar projection remains SU-M3 |
| `TUI-003` | Parser, formatter, mutation, and grammar selection share the exact Duration source model and serializer | Target Core delivered; Guide remains SU-M5 |
| `TUI-004` | Existing target CheckResult v2 and ProjectResult v2 identities need no new shape; public v1 results remain unchanged | Identity boundary delivered |
| `TUI-005` | Exact Rational Duration remains available to the future target temporal analysis without changing AnalysisResult v3 identity | Temporal analysis remains SU-M3 |
| `TUI-006` | Existing temporal source and completion-state validation remains unchanged under Grammar 3 | Deadline evaluation remains SU-M3 |
| `TUI-007` | The active complete NextResult v3 graph remains unchanged | Target time-gated NextResult v4 remains SU-M3 and SU-M5 |
| `TUI-008` | Grammar 3 source does not alter active start authority | Temporal runnable/start authority remains SU-M3 |
| `TUI-009` | Grammar 3 project/task mutation is source-preserving and final-candidate validated | Exact Duration mutation delivered |
| `TUI-010` | One target batch can explicitly upgrade or return grammar and replace Duration without validating intermediate source | Delivered |
| `TUI-011` | `project.migrate-unit` remains rejected as a batch member | Complete migration planner remains SU-M4 |
| `TUI-012` | Grammar and reversibility metadata meanings are fixed and implemented at the selector boundary | Complete UnitMigrationResult v2 remains SU-M4 |
| `TUI-013` | Grammar 3 candidates reuse the accepted target safe-write path | Exact mutation half delivered; migration composition remains SU-M4 |
| `TUI-014` | The active registry remains exactly 27 Contract 3 commands with no migration route or target schema | Contract 4 cutover remains SU-M5 |
| `TUI-015` | Active Guide and help remain closed and contain no target syntax or migration recovery claim | Contract 4 Guide cutover remains SU-M5 |
| `TUI-016` | Exact source, formatter, mutation, and boundary results are deterministic and candidate validation is fail closed | Target analysis text/JSON remains SU-M3 and SU-M5 |
| `TUI-017` | Formatting, mutation, and version selection preserve absolute temporal tokens byte-for-byte | Complete migration and inverse qualification remain SU-M4 |
| `TUI-018` | Root exports, installed behavior, authority, release, and publication remain unchanged | Activation boundary delivered |
| `TUI-019` | Grammar 3 accepts exact Fraction Duration, Grammar 2 rejects it, malformed forms report `PTDSL-007`, and Decimal behavior remains compatible | Delivered |
| `TUI-020` | Exact serialization and grammar selection emit Decimal or Fraction and upgrade only when required without downgrading Grammar 3 | Components delivered; migration orchestration remains SU-M4 |

## 4. Example observation trace

| ID | SU-M2R observation | Remaining owner |
| --- | --- | --- |
| `TUE-001` | Active Grammar 1 remains closed; target Grammar 2/3 capabilities are explicit and internal | Public activation: SU-M5 |
| `TUE-002` | Grammar 3 inherits the field-local missing-anchor diagnostic | Complete for target source |
| `TUE-003` | Grammar 3 inherits exact invalid-calendar source diagnostics | Complete for target source |
| `TUE-004` | Leap-day temporal tokens survive exact formatting and mutation | Calendar and deadline results: SU-M3 |
| `TUE-005` | Offset-bearing source tokens survive exact formatting, mutation, and version selection | Relationship projection: SU-M3 |
| `TUE-006` | Mixed temporal kinds remain valid source under Grammar 3 | Calendar, deadline, and Next v4 results: SU-M3 |
| `TUE-007` | A date anchor remains valid source with no invented clock | Unavailable calendar result: SU-M3 |
| `TUE-008` | Current comparison semantics remain unchanged by exact Duration syntax | Deadline comparison: SU-M3 |
| `TUE-009` | Resource-schedule source remains exact and deterministic | Temporal resource assessment: SU-M3 |
| `TUE-010` | Blocked source remains exact and deterministic | Block-qualified deadline assessment: SU-M3 |
| `TUE-011` | Completed source remains retained without invented history | History-unavailable deadline result: SU-M3 |
| `TUE-012` | Decimal migration inputs remain compatible and exact source tokens are available | Migration and inverse: SU-M4 |
| `TUE-013` | Replacement-velocity inputs remain Decimal-only and exact | Migration and metadata result: SU-M4 |
| `TUE-014` | Migration-shaped batches still fail closed | Stable migration failures: SU-M4 |
| `TUE-015` | The baseline now requires exact `1/3d` and `2/3d` output plus one Grammar 3 upgrade; serializer and boundary composition prove the representation path | Inventory conversion and UnitMigrationResult v2: SU-M4 |
| `TUE-016` | Target mutation and formatting are deterministic and repeatable | Migration no-op and repetition: SU-M4 |
| `TUE-017` | Exact Rational and original temporal tokens remain available to an inverse planner | Migration inverse: SU-M4 |
| `TUE-018` | Public Contract 3 projections and order remain unchanged | Target Contract 4 projections: SU-M5 |
| `TUE-019` | Decimal and Fraction literals retain exact values; explicit formatting emits `1d`, `0.5d`, `1/3d`, `2/3d`, and `0d` without rounding | Complete for target source |
| `TUE-020` | Zero denominators, signs, whitespace, decimal components, and multiple slashes fail as `PTDSL-007` with no candidate | Complete for target source |

The machine-readable baseline is contiguous through TUE-020 and records
TUE-015 as successful exact output with
`grammar_disposition=upgraded_for_exact_fraction`. Dedicated source,
serializer, formatter, mutation, and boundary tests fix the delivered
component behavior without pretending that the SU-M4 migration operation is
already implemented.

## 5. Verification map

| Gate | Evidence |
| --- | --- |
| Grammar 3 source, Decimal compatibility, malformed Fraction, and temporal inheritance | `test/rational-duration-source.test.mjs` |
| Exact Decimal-or-Fraction serialization | `test/exact-duration-source.test.mjs` |
| Canonical explicit format and exact round trip | `test/rational-duration-formatter.test.mjs` |
| Project/task/batch mutation and target safe write | `test/rational-duration-mutation.test.mjs` |
| Grammar retention/upgrade, reversibility, and temporal preservation | `test/rational-duration-version-boundary.test.mjs` |
| Cross-layer acceptance, observation trace, public exports, registry, and Contract 3 rejection | `test/scheduling-units-m2r-acceptance.test.mjs` |
| Normative TUE-015, TUE-019, and TUE-020 baseline | `test/temporal-unit-examples.test.mjs` |
| Packed root exports and installed Grammar 2/3 rejection | `scripts/check-package.sh` |
| Documentation, all self-use plans, link, package, and repository regression | `npm run check` |

The installed-package gate operates on the actual packed tarball. It verifies
that the root omits every target-only Grammar 2/3 and exact-Duration API, help
remains Contract 3, and installed `document check|format`, `project show`,
`dag analyze`, and `dag next` reject both Grammar 2 temporal source and Grammar
3 Fraction source through their existing schema identities.

## 6. SU-M3 and SU-M4 handoff

SU-M3 must consume the Grammar 3-capable validated source boundary and exact
Rational Duration values when implementing calendar, deadline, precedence,
resource, AnalysisResult v3, and NextResult v4 target Core. It must not convert
exact values through binary floating point, publish target modules, or make
NextResult v4 normal authority.

SU-M4 must compose the accepted migration inventory and formulas with
`serializeExactDurationSource` and the grammar boundary. TUE-015 must return
one exact Grammar 3 candidate rather than `nonrepresentable_decimal`;
`PTMIG-408` remains reserved for migration version 1. SU-M4 must implement the
complete UnitMigrationResult v2, no-op, repeat, inverse, temporal-token
preservation, candidate, and safe-write behavior without adding the public
command.

Only SU-M5 may atomically expose Grammar 2/3, CLI Contract 4, target result
schemas, help, Guide, README workflows, NextResult v4 authority, and installed
behavior. Release and external publication remain separate decisions.
