# AI Agent Guidance Registry v1 Acceptance Record

- Document status: Accepted 1.0
- Acceptance date: 2026-07-23
- Issue: [Issue #2](https://github.com/mako10k/perttool/issues/2)
- Normative specification: [AI Agent Guidance Registry specification](../specs/agent-guidance.md)
- Normative example: [AI Agent Guidance Registry normative example](../examples/agent-guidance.md)
- Provider evidence: [AI Agent Guidance Provider baseline](agent-guidance-provider-baseline.md)
- Detail plan: [../../plans/agent-guidance.pert](../../plans/agent-guidance.pert)

## 1. Decision

Accept read-only AI Agent Guidance Registry v1 for Issue #2. Versioned offline profiles for Codex, GitHub Copilot, Claude Code, Grok Build, and Antigravity can be queried through the same Core, which separates provider-specific names from common surfaces. `agent help` text and JSON are generated deterministically from the same Core result, and the package-installed CLI and public library use the same profiles.

This acceptance covers only `agent help`. `agent audit`, `agent scaffold`, hook execution, enforcement, provider configuration changes, and runtime network refresh are unimplemented and non-goals; this acceptance does not authorize them.

## 2. Issue #2 acceptance trace

| ID | Acceptance criterion | Normative source and implementation | Automated verification |
| --- | --- | --- | --- |
| AGT-AC-01 | Common-surface taxonomy and stable guidance codes | Specification sections 5.2 and 6; `src/guidance/types.ts`; `src/guidance/profile.ts` | `test/agent-guidance-contract.test.mjs`; `test/agent-guidance-core.test.mjs` |
| AGT-AC-02 | Mapping provider terminology to common concepts | Specification sections 5.2 and 7; Provider baseline | `test/agent-guidance-provider-baseline.test.mjs`; `test/agent-guidance-core.test.mjs` |
| AGT-AC-03 | Provider ID, alias, support, staleness, and unknown contract | Specification sections 5, 7.3, and 12 | `test/agent-guidance-contract.test.mjs`; `test/agent-guidance-core.test.mjs` |
| AGT-AC-04 | Read-only command, Core result, text/JSON, and exit codes | Specification sections 3 and 8 through 12; `src/application/agent-help.ts` | `test/agent-guidance-core.test.mjs`; `test/agent-guidance-publication.test.mjs` |
| AGT-AC-05 | Deterministic text and JSON from the same registry | `src/guidance/query.ts`; `src/guidance/text.ts`; `src/cli.ts` | Core serializer/CLI byte parity; text golden |
| AGT-AC-06 | Artifacts, scope, maturity, risk, sources, and verification date for five providers | Provider baseline; `test/fixtures/agent-guidance/provider-baseline.v1.json` | Provider baseline completeness; Core profile parity |
| AGT-AC-07 | Fixtures for six support statuses | `test/fixtures/agent-guidance/contract.v1.json` | One-to-one support/evidence mapping; Core verification for every status |
| AGT-AC-08 | Provider-ordering and projection fixtures/goldens | Provider/contract fixtures; `test/golden/agent-guidance/` | Five-provider by six-surface ordering; index/quick/detail; aliases; source closure |
| AGT-AC-09 | No regression in legacy `dsl help` | Specification section 11.1; separate structured command-help registry | `legacy-dsl-help-index.expected.json` byte golden |
| AGT-AC-10 | README, basic design, AI process, and help synchronization | `README.md`; `docs/basic-design.md`; `docs/process/ai-development.md`; `src/help/registry.ts` | Documentation/link check; CLI help/publication test |
| AGT-AC-11 | Offline/read-only with no hooks, file generation, or network refresh | Specification sections 3 and 9.7; read-only capabilities; pure-Core boundary | Empty-environment and temporary-directory execution; capabilities; package-installed CLI verification |
| AGT-AC-12 | Audit, scaffold, and enforcement migration boundary | Specification section 14; beta release procedure | Contract normative cases AGT-018 through AGT-020; documentation check |

The 12 criteria in the issue body correspond one-to-one with this table. Normative meaning comes not from the issue body but from the acceptance trace in specification section 15 and the references above.

## 3. Provider evidence

`verified_at` and `snapshot_as_of` in the Provider baseline and bundled profiles are `2026-07-23`. Provider-baseline-specific tests check the following.

- Five providers exist in fixed order, and each provider has the same six surfaces
- Each surface has scope, maturity evidence, risk observation, official-source references, and verification date
- Official sources use only hosts corresponding to their provider
- Artifacts whose paths cannot be determined from official documentation remain empty arrays and are not inferred
- Provider, surface, artifact, and source mappings from the baseline to bundled profiles are closed

## 4. Security boundary

`src/guidance/` is a pure Core that accepts only fixed profiles and arguments; it does not access files, environment, clock, locale catalogs, network, or provider APIs. The CLI adapter only displays results.

Acceptance tests run `agent help` in an empty temporary directory outside the project with an empty environment and confirm that no files are generated. The public capabilities fix all of the following to `false`.

- project file read
- file write
- hook execution
- command execution
- network access
- provider state read/write

The displayed risks for hooks, workflows, and connectors describe provider functionality; they do not mean perttool executed them.

## 5. Verification

The following commands were run from the repository root with Node.js 24 or later, and all succeeded.

```sh
npm run build
node --test \
  test/agent-guidance-provider-baseline.test.mjs \
  test/agent-guidance-contract.test.mjs \
  test/agent-guidance-core.test.mjs \
  test/agent-guidance-publication.test.mjs
npm run check:package
npm run check
git diff --check
```

The dedicated tests ran 30 cases. The package check packed and installed the release tarball in a temporary directory and inspected the public library, installed `agent help`, existing commands, package contents, and publish dry run. Actual publish, GitHub release, and npm dist-tag changes were not run.

## 6. Handoff to beta

This acceptance closes the Issue #2 feature gate. The next step is `BETA_RELEASE_E2E` in the macro plan, which verifies suffix-free `0.1.0`, the identical tarball, GitHub prerelease, npm `beta`, unchanged pre-existing `latest`, and isolated registry installation according to the [beta release procedure](beta-release.md).

This record does not represent completed beta distribution. Version changes, the beta release commit and its push, tag, GitHub prerelease, and npm publish occur only when `BETA_RELEASE_E2E` is explicitly executed.
