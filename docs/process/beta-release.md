# Beta Transition and Release Procedure

- Status: Accepted 1.2
- Decision date: 2026-07-23
- Versioning: [ADR 0003](../adr/0003-beta-versioning.md)
- Feature gate: [Issue #2](https://github.com/mako10k/perttool/issues/2)
- Feature acceptance: [AI Agent Guidance Registry v1 acceptance record](agent-guidance-acceptance.md)
- Release acceptance: [`v0.1.0` beta release acceptance record](beta-release-acceptance.md)
- Macro plan: [../../plans/mvp.pert](../../plans/mvp.pert)
- Detail plan: [../../plans/agent-guidance.pert](../../plans/agent-guidance.pert)

## 1. Scope

The first beta is suffix-free `0.1.0` and includes read-only v1 of the AI Agent Guidance Registry. It does not include provider-specific configuration generation, hook execution, audit, scaffolding, enforcement, Issue #3, an LSP server, a VSIX, or an MCP server.

Strict compatibility from alpha to beta is not required. Necessary breaking changes are allowed, but update schema versions, specifications, migrations, CHANGELOG, fixtures, and help in the same change. Alpha dogfooding and local use are sufficient; additional usage time is not a release gate.

## 2. Engineering gate

- All tasks in `plans/agent-guidance.pert` are complete
- The [Issue #2 acceptance record](agent-guidance-acceptance.md) demonstrates that the acceptance criteria are met in the specification, Core, CLI, text/JSON, fixtures/goldens, and package
- v1 is offline and read-only and does not execute hooks, project code, file generation, or network refresh
- Reconfirm the official sources and `verified_at` for all five provider profiles at implementation time
- `npm run check` and `git diff --check` succeed
- Complete macro `AGENT_GUIDANCE_IMPLEMENTATION` preview-first and make `BETA_RELEASE_E2E` recommended

## 3. Release change

Update the following together in the release commit.

- Change the package, lockfile, and CLI version to `0.1.0`
- Change CHANGELOG and README to the beta guidance path
- Change `publishConfig.tag` and the publish guard to `beta`
- Validate the publish script from an explicit channel parameter or manifest channel, leaving no hard-coded `alpha`
- Use `npm install --global perttool@beta` before any separately authorized `latest` promotion; after promotion, the unqualified install is the primary example

`0.1.0` is suffix-free but remains beta in perttool product maturity. Publish it as a GitHub prerelease and to npm `beta`. The publish operation must not change `latest`; any later promotion is an independent, explicitly authorized post-acceptance action.

## 4. Distribution gate

1. Push the clean release commit to `origin/main`
2. Create and push annotated tag `v0.1.0` at the same commit
3. Generate the tarball exactly once outside the worktree and inspect the package
4. Attach the tarball and `SHA256SUMS` to the GitHub prerelease, then install from the published asset in isolation
5. After the user authorizes actual publication, publish the same tarball exactly once to npm `beta` with a process-limited `NPM_TOKEN` through `secdat`
6. Verify registry, GitHub, and local artifact identity, the `beta` dist-tag, and that the publish operation left the pre-existing `latest` value unchanged
7. Install from the registry in isolation and confirm CLI version, help, `agent help`, and existing-command smoke tests
8. Retain the release record and complete `BETA_RELEASE_E2E`
9. If the user separately approves making the accepted beta the default install, move `latest` with one explicit dist-tag operation and verify registry metadata without retrying an ambiguous mutation

Perform Git push, GitHub operations, and npm publication under `secdat exec` as required by repository rules. Adding this plan alone does not authorize actual publication.

## 5. Accepted outcome

The procedure was completed on 2026-07-23. The immutable release tag, artifact identity, GitHub prerelease, npm dist-tags, isolated registry installation, explicit post-acceptance `latest` promotion, verification results, and plan transition are recorded in the [`v0.1.0` beta release acceptance record](beta-release-acceptance.md).
