# SU-M4 Exact Unit-Migration Core Acceptance

- Document status: Accepted 1.0
- Acceptance date: 2026-07-25
- Accepted contracts:
  [unit-migration semantics](../specs/unit-migration.md) and
  [temporal and unit interface](../specs/temporal-unit-interface.md)
- Macro plan:
  [../../plans/scheduling-units.pert](../../plans/scheduling-units.pert)
- Detail plan:
  [../../plans/scheduling-units-m4.pert](../../plans/scheduling-units-m4.pert)
- Interface acceptance IDs: `TUI-001` through `TUI-020`
- Example baseline: `Perttool.TemporalUnitExampleBaseline.v2`

## 1. Decision

Accept the internal SU-M4 unit-migration version 2 Core. One capability-checked
application path validates a Grammar 1, 2, or 3 source, prepares the exact
request and complete Duration inventory, converts every value as a Rational,
selects Decimal or Fraction source spelling and the required grammar, plans
one source-preserving candidate, revalidates that final candidate, and projects
the complete internal `Perttool.UnitMigrationResult.v2` outcome. The same
candidate is compatible with the accepted target Grammar 3 safe-write adapter.

The accepted Core handles Point-to-day/hour and day/hour-to-Point migration,
retained/replaced/inserted velocity, every stable failure cause, exact
Fraction output, same-unit and repeated no-op, exact inverse values,
source-preserved absolute temporal fields, deterministic diagnostics and
candidate data, and qualified grammar or velocity metadata changes.

There are no open SU-M4 acceptance findings. The target modules remain
internal build artifacts. Active Grammar 1, CLI Contract 3, the 27-command
registry, public result identities, root exports, help, Guide, README
workflows, installed-package behavior, and normal NextResult v3 authority are
unchanged. The public `project migrate-unit` route, JSON/text adapters,
Contract 4 help and Guide, public Grammar 2/3, target result exports, and the
installed workflow remain one atomic SU-M5 cutover. SU-M3 independently owns
calendar, deadline, temporal analysis, and NextResult v4 target Core.

No Git push, GitHub release, npm publication, dist-tag change, or Contract 4
activation is authorized by this acceptance.

## 2. Accepted implementation boundary

| Capability | Accepted SU-M4 implementation | Public boundary |
| --- | --- | --- |
| Request and inventory | Capability-checked Grammar 1/2/3 preparation selects exact declared or replacement velocity, inventories every base-unit Duration in source order, retains absolute temporal tokens, and emits stable causes | No public request type, option, or command is added |
| Exact conversion | Point/time formulas use reduced Rational values and one exact Decimal-or-Fraction serializer; grammar 1/2 upgrades to 3 only for Fraction output and grammar 3 never downgrades | Analysis version 1 and display precision remain unchanged |
| Candidate | One normalized UTF-16 edit set changes only version when required, base unit, applicable velocity, and inventoried Duration values; only the complete candidate is validated | Ordinary Contract 3 mutation and batch do not acquire automatic migration guarantees |
| Repetition and inverse | Same-unit and repeated requests are no-ops; inverse conversion restores every exact value while retaining observable grammar and velocity metadata qualifications | No Git or hidden history is consulted |
| Result v2 | The internal schema projection exposes identity, grammar/unit and velocity dispositions, exact records, reversibility, qualifications, causes, candidate data, diagnostics, and preview/write state | No JSON/text adapter, CLI envelope, root export, or help entry is added |
| Safe write | The exact candidate reuses target Grammar 3 in-place/out, digest lock, race, symlink, atomic publication, and post-write validation mechanics | There is no Contract 3 write route for migration |

The package root continues to export only `"."`. It does not expose the
Grammar 2/3 capability, migration request, conversion, candidate, result,
serializer, target validator, or target safe-write adapter.

## 3. Interface observation trace

| ID | SU-M4 evidence | State after SU-M4 |
| --- | --- | --- |
| `TUI-001` | Migration consumes the accepted Grammar 1/2/3 target validation boundary and can atomically upgrade exact Fraction output to Grammar 3 | Migration source delivered; public Grammar 2/3 remains SU-M5 |
| `TUI-002` | Validated temporal input and explicit `as_of` pass through migration unchanged; request preparation reads no clock or host zone | Migration preservation delivered; calendar projection remains SU-M3 |
| `TUI-003` | Inventory, exact serializer, grammar selection, candidate edits, and diagnostics have one canonical field order | Migration Core delivered; public Guide remains SU-M5 |
| `TUI-004` | Migration adds no field to active CheckResult v1 or ProjectResult v1 and does not publish the target v2 results | Public schema cutover remains SU-M5 |
| `TUI-005` | Migration retains exact source needed by later AnalysisResult v3 without changing AnalysisResult v2 | Temporal analysis remains SU-M3 |
| `TUI-006` | Absolute deadline inputs and completion states remain byte-preserved and are not treated as conversion inputs | Deadline evaluation remains SU-M3 |
| `TUI-007` | The complete active NextResult v3 recommendation graph and authority are unchanged | Target NextResult v4 remains SU-M3 and SU-M5 |
| `TUI-008` | Migration does not reinterpret `not_before`, readiness, or start authority | Temporal release gating remains SU-M3 |
| `TUI-009` | Migration reuses final-candidate source-preservation rules but adds no temporal mutation operation | Temporal mutation was accepted in SU-M2 |
| `TUI-010` | Migration is one coordinated candidate and remains excluded from ordinary batch membership | Automatic batch migration remains prohibited |
| `TUI-011` | The internal migration planner alone owns inventory, exactness, velocity disposition, and inverse guarantees | Public `project migrate-unit` remains SU-M5 |
| `TUI-012` | Internal Result v2 exposes exact converted fields, source/target grammar, both dispositions, reversibility, candidate data, and all stable causes | Delivered internally |
| `TUI-013` | Preview candidate, diff, digest, in-place/out write, race, symlink, and post-write behavior reuse the common safe-write mechanics | Delivered internally; public route remains SU-M5 |
| `TUI-014` | The active registry remains exactly 27 Contract 3 commands and rejects `project migrate-unit` | Contract 4 registry remains SU-M5 |
| `TUI-015` | Active help and Guide contain no target migration route, option, schema, or recovery topic | Contract 4 help and Guide remain SU-M5 |
| `TUI-016` | Request, exact records, candidate bytes, failures, diagnostics, and Result v2 Core are deterministic | Public JSON/text adapters remain SU-M5 |
| `TUI-017` | Grammar 2/3 absolute temporal tokens are byte-preserved; exact inverse values and grammar-upgrade qualification are implemented | Delivered internally |
| `TUI-018` | Root exports, installed behavior, Next v3 authority, release, and publication remain closed | Activation boundary delivered; cutover remains SU-M5 |
| `TUI-019` | Migration accepts the Grammar 3 exact Fraction source model and emits reduced Decimal-or-Fraction output without rounding | Delivered internally |
| `TUI-020` | Malformed Fraction source fails before migration arithmetic; changing output upgrades only when Fraction is required and never downgrades Grammar 3 | Delivered internally |

## 4. Example observation trace

| ID | SU-M4 observation | Remaining owner |
| --- | --- | --- |
| `TUE-001` | Active Grammar 1 remains closed while migration target capability selection is explicit and internal | Public activation: SU-M5 |
| `TUE-002` | Missing-anchor diagnostics are retained as invalid-original evidence; migration never supplies an anchor | Complete for migration |
| `TUE-003` | Invalid calendar source exposes no migration candidate or edits | Complete for migration |
| `TUE-004` | Leap-day source tokens are preserved exactly and never enter unit conversion | Calendar/deadline results: SU-M3 |
| `TUE-005` | Offset-bearing source tokens remain byte-equal across forward and inverse candidates | Relationship projection: SU-M3 |
| `TUE-006` | Mixed temporal kinds remain valid source and are ignored by migration arithmetic | Temporal authority: SU-M3 |
| `TUE-007` | A date anchor and hour Duration remain distinct inputs; migration invents no clock | Calendar availability: SU-M3 |
| `TUE-008` | Current deadline comparison source is preserved and migration changes no comparison rule | Deadline comparison: SU-M3 |
| `TUE-009` | Resource requirements and graph structure remain unchanged while source Duration values convert exactly | Temporal resource assessment: SU-M3 |
| `TUE-010` | Block reason and blocked structure remain unchanged; migration invents no duration for a block | Deadline qualification: SU-M3 |
| `TUE-011` | Done/reached state remains unchanged and migration invents no actual completion history | Historical deadline result: SU-M3 |
| `TUE-012` | Point-to-day converts the full ordered inventory, retains `20p/10d`, preserves every temporal token, and returns exact Result v2 records | Complete for SU-M4 |
| `TUE-013` | Hour-to-Point accepts explicit `8p/4h`, inserts canonical velocity, and qualifies metadata-changed reversibility | Complete for SU-M4 |
| `TUE-014` | Period mismatch, unsupported direction, and same-unit velocity change expose stable causes/codes and no partial candidate | Complete for SU-M4 |
| `TUE-015` | Non-terminating results emit exact `1/3d` and `2/3d`, upgrade the same candidate to Grammar 3, and never emit reserved `PTMIG-408` | Complete for SU-M4 |
| `TUE-016` | Same-unit and repeated requests return identical source/digest with empty edits and diff and never rescale | Complete for SU-M4 |
| `TUE-017` | Point-to-day-to-Point restores every Rational and semantic velocity, retains temporal/trivia bytes, and canonicalizes `4.00p` to `4p` | Complete for SU-M4 |
| `TUE-018` | Internal Result v2 records have deterministic semantic order but no public JSON/text projection exists | Public projection: SU-M5 |
| `TUE-019` | Decimal and Fraction inputs participate in exact property and inverse tests without rounding | Complete for SU-M4 |
| `TUE-020` | Malformed Fraction source exposes no candidate and never reaches conversion | Complete for SU-M4 |

The machine-readable baseline remains contiguous through TUE-020. TUE-012
through TUE-017 are the direct migration witnesses; the other cases prove
that migration consumes or preserves the accepted target source without
claiming SU-M3 temporal results or SU-M5 projections.

## 5. Verification map

| Gate | Evidence |
| --- | --- |
| Request shape, direction, exact velocity, inventory, stable causes, malformed and unsupported input | `test/unit-migration-request.test.mjs` |
| Exact formulas, ordered records, grammar selection, algebraic inverse properties, and deterministic conversion | `test/unit-migration-conversion.test.mjs` |
| Atomic candidate, UTF-16 edit replay, temporal/trivia/BOM preservation, no-op, repeat, inverse, and target write reuse | `test/unit-migration-candidate.test.mjs` |
| Complete deterministic Result v2, candidate closure, and digest-matched write state | `test/unit-migration-result.test.mjs` |
| Cross-layer TUI/TUE trace, property matrix, stable cause map, Contract 3 boundary, help/Guide closure, and SU-M5 handoff | `test/scheduling-units-m4-acceptance.test.mjs` |
| Exact Fraction source, malformed forms, and normative example baseline | `test/rational-duration-source.test.mjs`, `test/temporal-unit-examples.test.mjs` |
| Common race, symlink, digest, in-place/out, atomic publication, and post-write mechanics | `test/write-safety.test.mjs`, `test/rational-duration-mutation.test.mjs` |
| Public registry, CLI identities, help, Guide, and target-operation rejection | `test/cli.test.mjs`, `test/e2e.test.mjs` |
| Packed root exports and installed Grammar 2/3 and migration-surface rejection | `scripts/check-package.sh` |
| Documentation, all self-use plans, local link, package, and repository regression | `npm run check` |

The installed-package gate operates on the actual packed tarball. It verifies
that the root omits every target-only migration and Grammar 2/3 API, command
help contains no `project migrate-unit` route or Result v2 schema, and the
installed Contract 3 CLI retains its existing identities while rejecting
Grammar 2 temporal and Grammar 3 Fraction source.

## 6. SU-M5 handoff

SU-M5 may consume the accepted internal migration planner and Result v2 only
as part of the atomic Contract 4 cutover. It must add the complete typed
descriptor, dispatch, request adapter, JSON and text projections, help,
`editing.unit-migration` Guide topic, README and installed-package workflows,
and public export policy together. It must preserve every stable cause,
diagnostic mapping, candidate/write contract, exact Rational record, and
qualification accepted here.

SU-M5 must also integrate the separately accepted SU-M3 temporal target Core,
make only a complete known NextResult v4 the normal authority, and prove that
text and JSON derive from the same Core results. It must not silently activate
only the migration command or publish a package before the integrated
acceptance and separate release authorization.

The final detail snapshot is committed at `bc75b37` and advanced to the
reached `UNIT_MIGRATION_ACCEPTED` frontier. SU-M4 completion is rolled into
`SU_M4_UNIT_MIGRATION_WORK_PACKAGE` once without copying detail task history.
The rollup is committed at `4101ef7` and advanced to reached
`UNIT_MIGRATION_ACCEPTED`. Do not start SU-M5 until both SU-M3 and SU-M4 macro
work packages are complete.
