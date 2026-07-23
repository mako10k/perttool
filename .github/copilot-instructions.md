# Repository Instructions

`AGENTS.md`をCodexとGitHub Copilotで共有するrepository guidanceの正本とする。永続的なworkflowやproject ruleを変更するときは、このfileとの整合も同じcommitで確認する。

Mandatory summary:

- 利用者から指定がない限り、日本語で応答する。
- TypeScript CLIのMVP public alpha受け入れは完了した。Recommendation MIG-01からMIG-07は完了し、5 plan shadowとunknown-version safe stop dry-runを経たcompleteかつknownな`Perttool.NextResult.v3`をnormal AI task selection authorityへ採用した。`v0.1.0-alpha.2`はGitHub prereleaseとnpm `alpha`へ同一artifactで公開・検証済みである。最初のbetaはsuffixなし`0.1.0`、以後の`0.x.x`をbetaとし、alphaからのstrict compatibilityや追加soakをgateにしない。Issue #2をbeta gateへ追加し、5 provider baselineを公式資料からoffline fixtureへ固定した。固有実測Velocityは`4p/1d`、残りは18p = 4.5dで、macroのrecommended taskは`AGENT_GUIDANCE_IMPLEMENTATION`、detailは`GUIDANCE_CONTRACT`である。Issue #3はbeta blockerではない。Human override apply/auditはMIG-08まで未解禁である。
- 正本の優先順は`docs/requirements.md`、`docs/specs/`、`docs/basic-design.md`、`docs/examples/`、`docs/process/`、`plans/`である。
- non-trivialな変更前にcurrent checkout、目的、正本、acceptance criteria、non-goal、検証方法を確認する。
- 「次のタスク」はknown、complete、not-truncatedな`dag next --format json`をauthorityとし、macroのrecommended work packageからworkstreamを選んでから対応detailを再解析する。Recommended subset、またはrecommended set全件にresource-feasibleなallowed taskを1件だけ追加した集合だけをnormal selectionとする。Unknown version、incomplete trace、`PTREC-*`、deferred/discouragedでは開始せず、task stateやcapacity変更後は再解析する。
- requirements/specification、design、implementation、verificationのtraceabilityを維持する。
- task=edge、milestone=node、gate=zero-duration dependency edgeを維持し、resource共有をDAG dependencyへ変換しない。
- precedence critical pathとresource schedule上のschedule critical pathを区別する。
- `docs/process/self-use.md`のStage 3まで解禁済み。Editing/advance writeはpreview、diffと削除一覧の確認、expected digest、write後再解析を必須とする。
- repository checkはNode.js 24以上で`npm ci`、`npm run check`、whitespace checkは`git diff --check`を使用する。
- staging前にdiffとstatusを確認し、利用者の無関係な変更を含めない。
- remote writeとGitHub操作には`secdat exec`を使い、破壊的Git操作には明示許可を得る。
- npm publishはalphaの`docs/process/npm-publication.md`またはbetaの`docs/process/beta-release.md`のrelease gate、GitHub Releaseとの同一tarball、明示dist-tag、process限定`NPM_TOKEN`注入を守る。Betaは`beta` tagを使い既存`latest`を変更しない。Actual publish前に利用者の明示許可を得る。
- sub-agentやparallel agent workは、利用者の明示要求または有効なruntime policy上の明示許可がある場合だけ使用する。

詳細なproject map、domain invariant、validation、Git規則は`AGENTS.md`に従う。
