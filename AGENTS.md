# Repository Guidelines

## Scope and communication

These instructions apply to the entire repository. English is the canonical language for tracked repository artifacts. New or substantively modified requirements, specifications, design text, process guidance, plan metadata, source comments, bundled help, and diagnostics use English. Existing Japanese content remains explicit migration debt in `plans/english-baseline.pert`; do not translate unrelated legacy text opportunistically.

User communication is independent from the repository baseline. Unless the user requests otherwise, respond to the user in Japanese. Preserve user-authored `.pert` content and intentional Unicode fixtures. Do not add runtime i18n, locale negotiation, translation catalogs, or a `--locale` option without a new requirement and architecture decision.

- 直接確認した事実、推論、未確認事項を区別する。
- 現在のcheckout、正本文書、実行結果を確認してから判断する。
- 存在しないcommand、file、package script、運用規則を推測して補わない。
- 利用者が示した用語と完了条件を、実装しやすい別の意味へ置き換えない。

## Current phase and sources of truth

perttool has accepted its TypeScript CLI MVP, the read-only AI Agent Guidance Registry v1 from Issue #2, and the first suffix-free beta release, `v0.1.0`. The release was published from one verified tarball to a GitHub prerelease and npm `beta`, then explicitly promoted to npm `latest` after acceptance; both tags resolve to `0.1.0`. The implemented surface includes `dsl check`, `dsl format`, `dsl help`, read-only `agent help`, `dag analyze`, `dag next` v3, read-only `validateOverride`, `dag advance`, Mermaid export/import, source-preserving formatter and mutation Core APIs, atomic batch, safe-write I/O, editing/advance CLI write controls, project metadata CLI, and the grammar acceptance suite. A complete and known `Perttool.NextResult.v3` remains the normal AI task-selection authority. The macro plan is complete and has no ready task. The independent English-baseline detail plan now recommends `SURFACE_INVENTORY`. Issue #3, the LSP server, VSIX, and MCP server remain post-beta backlogs. Human override apply, durable audit, and Git integration remain unavailable until MIG-08.

また、velocityを含むproject metadata一式を返す`project show`、source-preservingな`project set`、atomic batchの`project.set`も実装済みである。操作系実測Velocityは2026-07-23の5pを加えた累計29p/2 active dayから`29p/2d`へ再calibrationした。

ADR 0004 adopts English as the repository baseline. The 42p legacy-surface migration is tracked in `plans/english-baseline.pert` with a provisional `29p/2d` velocity. The `M8_BETA_RELEASED` gate is reached, and `SURFACE_INVENTORY` is the current recommended detail task.

意味や設計が競合した場合は、原則として次の順で扱う。

1. `docs/requirements.md` のMust requirement
2. `docs/specs/` の規範仕様
3. `docs/basic-design.md`
4. `docs/examples/` の規範sample
5. `docs/process/` の開発・運用手順
6. `plans/` の現在・未来の作業状態
7. `README.md` の案内

低い順位の文書だけを修正して不整合を隠さない。要件変更では、影響する仕様、設計、sample、test、helpを同じlogical changeで更新する。過去の計画や完了状態は現行文書へ復元せず、Git historyを参照する。

## Project map

- `docs/requirements.md`: product要求とMVP境界。
- `docs/basic-design.md`: architecture、module境界、実装slice。
- `docs/specs/`: grammar、graph semantics、analysis、mutation、interfaceの規範仕様。
- `docs/adr/`: 採用済みarchitecture/runtime判断。
- `docs/examples/`: parserとanalysisの規範sample。
- `docs/process/`: 自己利用とAI開発の運用手順。
- `plans/`: current and future work for perttool. Use `mvp.pert` as the macro roadmap through beta, and use `grammar.pert`, `control-plane.pert`, `operations.pert`, `recommendation.pert`, `agent-guidance.pert`, and `english-baseline.pert` as Stage 3 preview-first detail plans.
- `scripts/`: repository-local verification command。
- `.github/workflows/`: local verificationと同じ入口を使うCI。
- `src/`: TypeScriptのparser、validator、Core API、CLI、help実装。
- `src/analysis/`: exact Rationalを使うresidual graph、precedence CPM、resource schedule実装。
- `src/recommendation/`: actual ready taskからcandidate fact、complete order、selection horizon、joint-feasible recommended set、tier、typed explanation graph、PTREC invariant、JSON projection、read-only override validationとcanonical artifactを導出するpure Core。
- `src/conversion/`: Mermaid profile/plain export/import、semantic metadata、projection生成、fail-closed復元。
- `src/editing/`: formatterとmutationが共有するdeterministic unified diff。
- `src/formatter/`: source-preserving formatter Core。
- `src/guidance/`: version付きoffline AI Agent Guidance profile、validator、query、index/quick/detail projection、deterministic JSON/textを提供するread-only pure Core。
- `src/io/`: raw-byte document read、digest、symlink/race拒否、atomic safe-write adapter。
- `src/mutation/`: project/task/milestone/resourceとatomic batchのrequest、canonical advance、source-preserving UTF-16 TextEdit生成、適用規則。
- `src/application/`: check/project metadata/analyze/nextと、再検査済みmutation resultを返すpure service。
- `test/`: Node.js built-in test runnerのfixture、analysis/next/formatter/mutation/conversion/write-safety unit test、CLI integration/E2E test。
- `package.json`: Node.js 24以上、npm script、binary/library entrypoint。

実装を追加した時点で、実際のdirectoryとcommandに合わせてこのmapを更新する。

## Work start and task selection

非自明な変更の前に、次を短く確認する。

1. current branch、HEAD、worktree state
2. 利用者の目的と今回の変更範囲
3. 読んだ正本文書と、引き継いだ前提の有効性
4. acceptance criteriaと明示的なnon-goal
5. 実行する検証と予定する外部side effect

Project ID、as_of、duration_unit、velocity、finishなどのmetadataは、通常はsource fileを直接閲覧せず`project show --format json`で確認する。変更は手編集でなく`project set`のpreview/diffを経て、Stage 3のsafe-write手順で適用する。

利用者が「次のタスク」を求めた場合は、まず`docs/requirements.md`の推奨仕様作業、未解決事項、現在のGit状態から候補を提示する。自己利用Stage 1以降は、`mvp.pert`でmacro recommendationからworkstreamを選び、対応する詳細planを再解析してdetail recommendationからtaskを選ぶ。Macroと対象詳細planの`check`、`analyze`、`next --format json`結果を候補選択の前提にし、異なる詳細planのtaskをmacro判断なしに直接比較しない。

Normal task selectionでは、known `Perttool.NextResult.v3`、recommendation interface 1、ranking algorithm 1、reason taxonomy 1.0、explanation/expression/description model 1、locale `en`、completeかつnot-truncatedなtraceだけをauthorityとして使用する。Recommended taskのsubset、またはrecommended set全件を維持してresource-feasibleな`allowed` taskを1件だけ追加した集合を選べる。Unknown version、incomplete trace、`PTREC-*`、`deferred`/`discouraged` selectionでは開始せず、安全に停止する。Task start、completion、block、capacity変更後は同じresultを再利用せず再解析する。Human overrideを必要とする選択はMIG-08まで適用せず、normal recommendationとの差と未解禁のaudit/apply境界を報告する。

正しさに影響する変更は、原則としてrequirements/specification、design、implementation、verificationの順に進める。実装中に仕様の穴を発見した場合は、推測をcodeだけへ固定せず、対応する正本を先に、または同じchangeで更新する。

## Domain invariants

- Activity-on-Arrowを使用し、taskはedge、milestoneはnode、gateは所要時間0のdependency edgeとする。
- resource requirementはdependency edgeではない。resource共有を正本DAGの順序へ自動変換しない。
- precedence critical pathとresource-constrained schedule上のschedule critical pathを区別する。
- resource scheduleのheuristic結果を厳密最適解と表示しない。
- 同じ入力、option、algorithm versionから同じ解析結果を返す。
- durationとPERT計算の正本にbinary floating pointを使用しない。
- `.pert`は現在と未来を表し、過去はGit historyで追跡する。
- `docs/process/self-use.md`のgateを満たす前に、未完成のperttoolを正本のwriterとして使用しない。

## Validation

Run the repository checks from the root with Node.js 24 or later. `npm run check` includes check/analyze/next validation for the MVP, grammar, control-plane, operations, recommendation, agent-guidance, and English-baseline plans.

```sh
npm ci
npm run check
git diff --check
```

Narrow checkは`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run check:docs`、`npm run check:link`、`npm run check:package`を使用する。`check:link`は一時user prefixへlinkしてCLIを検査し、実user prefixは変更しない。`check:package`は一時directoryでrelease tarballを作成し、repository-only fileの除外、npm publish normalization dry-run、隔離prefixへのinstallを検査する。`bash scripts/check-docs.sh`はdocumentationだけの下位入口である。

- 文書だけの変更でも、local link、Markdown fence、規範`.pert` sampleのbootstrap検査を実行する。
- grammar変更ではvalid/invalid example、field table、EBNF、diagnostic、formatter契約を一緒に確認する。
- analysis変更では小さなgolden graphを使い、precedence結果とresource schedule結果を別々に検証する。
- implementation追加後は、実在するnarrow testを先に実行し、共有coreに触れた場合だけ広いsuiteへ進む。
- 実行していないtestを成功したと報告しない。失敗や環境不足はcommandとともに明記する。
- package/runtime方針は`docs/adr/0002-node-typescript-package.md`を正とし、command変更時は本節、`docs/process/ai-development.md`、CIを同時に更新する。

## Review and durable guidance

commit前に意図したdiffをfileまたはhunk単位で確認し、bug、regression、仕様との不整合、missing testをsummaryより先に探す。表面的な症状修正で同じ原因が残る場合は、control pathと根本原因を確認してから修正する。暫定回避は暫定と明示し、残作業を正本backlogまたは計画へ残す。

再利用すべき教訓はchatだけに残さず、`AGENTS.md`、対応仕様、test、またはprocess文書へ反映する。`AGENTS.md`と`.github/copilot-instructions.md`の共有方針を変更する場合は、両方の整合を同じcommitで確認する。

## AI tool compatibility

- `AGENTS.md`をCodexと他のcoding agent向け共有方針の正本とする。
- GitHub Copilotは`.github/copilot-instructions.md`から同じ必須方針へ到達できるようにする。
- project-local Codex defaultは`.codex/config.toml`に置き、global設定をrepositoryへ複製しない。
- custom agentやskillは、反復する明確な役割と検証可能なexit criteriaが生じてから追加する。
- sub-agent、delegation、parallel agent workは、利用者が明示的に求めた場合、または有効なruntime policyがその利用を明示的に許可した場合だけ使う。

## Git and remote operations

- 作業開始時とstaging前に`git status --short --branch`を確認する。
- 利用者の未commit変更を保持し、今回のscopeに含まれるfileだけを明示的にstageする。
- commitは1つのcoherent changeにし、簡潔な命令形subjectを使う。
- remote設定を確認してからpushする。このrepositoryのremote writeは`secdat exec git push ...`、GitHub操作は`secdat exec gh ...`を使う。
- npm publish must satisfy the alpha or beta release gate and send the explicit GitHub Release tarball to the intended dist-tag. Beta publication uses `beta` and does not itself change `latest`. A later `latest` promotion is a separate dist-tag mutation requiring an explicit user-selected version and permission. Inject `NPM_TOKEN` only into that process through `secdat`.
- `git reset --hard`、`git clean`、force-push、共有historyのrewriteなどの破壊的操作は、対象と影響を示した明示許可なしに実行しない。
- secret、credential、local cache、生成reportをcommitしない。
