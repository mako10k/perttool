# npm publication手順

- 本書は`v0.1.0-alpha.2`のalpha release手順と公開記録である。最初のsuffixなし`0.1.0` beta以降は[beta release手順](beta-release.md)を正とする。
- 文書状態: Published 1.1
- 作成日: 2026-07-23
- 対象registry: `https://registry.npmjs.org/`
- 配布tag: `alpha`
- Release gate: [MVP release readiness監査](mvp-release-readiness.md)
- Current runtime baseline: [ADR 0005](../adr/0005-node-22-runtime-baseline.md)

## 1. 現在の状態

公開準備時点では`perttool`はnpm registryへ未公開だった。2026-07-23に`npm view perttool`が`E404`であること、`NPM_TOKEN`を`secdat`から注入した`npm whoami`がmaintainer accountで成功することを確認した。

公開準備時のcheckoutは`0.1.0-alpha.1`だったが、同名のGit tagとGitHub Releaseより後の変更を含んでいたため、そのversionではpublishしなかった。Recommendation受け入れ後に`RELEASE_E2E`が唯一のreadyかつrecommended work packageとなり、`0.1.0-alpha.2`をrelease versionとして選定した。

2026-07-23の最初の人間overrideはpublish準備だけを前倒しし、当時の工程statusや外部publish authorityを変更しなかった。その後MIG-07まで完了し、利用者は`secdat exec`配下でのGit pushとnpm publishを明示許可した。この許可は同一tarball、release commit/tag、GitHub asset、registry未公開version、process限定TOKENという本書のgateを省略しない。

同日に`v0.1.0-alpha.2`をGitHub prereleaseとnpmへ公開し、registryからの隔離installまで完了した。公開artifactと検証値は第7節へ固定する。

## 2. 安全境界

- npmへ送るtarballは、package checkとGitHub Release assetに使用したものと同一にする
- prereleaseは必ず`alpha` dist-tagへpublishし、既存packageではpublish前後の`latest`を一致させる
- 初回package publishでregistryが必須の`latest`を同versionへ作成した場合は、削除を前提にせず例外としてrelease記録へ残す。利用者向け導線は`@alpha`を明示する
- `package.json`、CLI `--version`、annotated Git tag、`origin/main`、tarball manifestのversionを一致させる
- package manifestの`bin.perttool`はnpm publish normalization後も`dist/cli.js`でなければならない
- TOKENをargument、tracked `.npmrc`、logへ書かない
- publishは明示的な人間承認後に一度だけ実行する
- responseが不明瞭な場合は`npm view perttool@VERSION`でdurable stateを確認し、確認前にretryしない

## 3. Repository preflight

認証不要のdry-runはcurrent directoryまたは生成済みtarballへ実行できる。

```sh
bash scripts/publish-npm.sh --dry-run
bash scripts/publish-npm.sh --dry-run /absolute/path/to/perttool-VERSION.tgz
```

`npm run check:package` builds the tarball and verifies its contents, isolated installation, CLI/library smoke paths, and publish normalization. The dry-run alone uses npm `--force` so the check remains repeatable after the exact version has been published; actual publication never uses `--force`. Manifest auto-correction still fails the check.

## 4. Release artifact

`RELEASE_E2E`の再開条件を満たした後、release commitでversion、CHANGELOG、READMEを更新する。`npm run check`と`git diff --check`が成功し、cleanなrelease commitを`origin/main`へpushして同じcommitへannotated tagを作成する。

tarballはworktree外の一時directoryへ一度だけ生成する。次の変数名は例であり、system変数を流用しない。

```sh
PERTTOOL_RELEASE_DIR=$(mktemp -d)
npm pack --pack-destination "$PERTTOOL_RELEASE_DIR"
PERTTOOL_RELEASE_TARBALL="$PERTTOOL_RELEASE_DIR/perttool-VERSION.tgz"
sha256sum "$PERTTOOL_RELEASE_TARBALL"
bash scripts/check-package.sh "$PERTTOOL_RELEASE_TARBALL"
```

tarballと`SHA256SUMS`を同じtagのGitHub prereleaseへ添付し、公開assetからの隔離installを確認する。GitHub操作とGit pushはrepository規則どおり`secdat exec gh ...`と`secdat exec git ...`を使う。

## 5. TOKEN注入とpublish

Maintainer domainではsecret名を`NPM_TOKEN`とする。値は表示せず、publish processだけへ注入する。

非対話publishにはnpmのgranular access tokenをread/write、Bypass 2FA付きで用意する。`npm whoami`成功は認証だけの証拠であり、publish権限やBypass 2FAを証明しない。権限と有効期限は[npm access token公式文書](https://docs.npmjs.com/about-access-tokens/)と[2FA publication要件](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)に従い、release直前に確認する。

認証確認:

```sh
printf '%s\n' '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' |
secdat --dir /home/katsumata-m exec \
  --inject secret:only=NPM_TOKEN \
  --inject route:prefer=secret \
  --inject final:require=NPM_TOKEN \
  -- npm whoami --userconfig=/dev/stdin
```

同一tarballのpublish:

```sh
secdat --dir /home/katsumata-m exec \
  --inject secret:only=NPM_TOKEN \
  --inject route:prefer=secret \
  --inject final:require=NPM_TOKEN \
  -- bash scripts/publish-npm.sh --publish "$PERTTOOL_RELEASE_TARBALL"
```

`--publish`は次をfail-closedで検査する。

1. 明示tarballである
2. worktreeがcleanである
3. tarballとcheckoutのname/versionが一致する
4. local tag、remote annotated tag、`origin/main`がHEADと一致する
5. `NPM_TOKEN`が存在し、`npm whoami`が成功する
6. 同じversionがregistryに存在しない
7. publish後の伝播中`E404`をbounded pollingし、registryから同じversionを取得できる
8. `alpha`が公開versionを指し、既存の`latest`がpublish前後で変わらない

## 6. 公開後検証

`npm view`でversionとdist-tagを確認し、user-ownedの一時prefixへregistryからinstallする。

```sh
npm view perttool@VERSION name version dist
npm view perttool dist-tags
PERTTOOL_VERIFY_PREFIX=$(mktemp -d)
npm install --global --prefix "$PERTTOOL_VERIFY_PREFIX" perttool@VERSION
"$PERTTOOL_VERIFY_PREFIX/bin/perttool" --version
"$PERTTOOL_VERIFY_PREFIX/bin/perttool" dsl check docs/examples/minimal.pert
```

検証結果、registry integrity、GitHub asset SHA-256、release URLをrelease記録へ残してから`RELEASE_E2E`を完了する。

## 7. `v0.1.0-alpha.2` release記録

- Release commit/tag: `dd4fc3efc01945544a2dad7e1838fdd4d06d7275` / `v0.1.0-alpha.2`
- GitHub prerelease: <https://github.com/mako10k/perttool/releases/tag/v0.1.0-alpha.2>
- GitHub/registry共通tarball SHA-256: `aadb757a5d7bb82eed677158ce5c4b0672c5695a6dde97bec6f10c438711be8a`
- npm version/dist-tag: `perttool@0.1.0-alpha.2` / `alpha`
- npm integrity: `sha512-jLwW2MDQbibQK8skb3qrIU7x5Ek+ZjDhesI8yPbb5SsKJqkX8tNqxhAoBukFgx8X1Kyv/9LuxgrwbPXTIGyBnA==`
- npm SHA-1: `d1bc681e68384d29b3130ba9a21c99e44605d51d`
- Verification: GitHub公開assetとregistry tarballのSHA-256一致、`perttool@alpha`の隔離install、`perttool 0.1.0-alpha.2`、`dsl check docs/examples/minimal.pert`

Publish本体は成功応答を返したが、直後のregistry照会は伝播中の`E404`となった。再publishせずdurable stateを照会し、versionとintegrityを確認した。この観測に基づき、publish scriptは`E404`だけをbounded pollingする。

初回package publishでは、明示した`alpha`に加えてregistryが`latest=0.1.0-alpha.2`を作成した。`npm dist-tag rm perttool latest`はregistryから`E400`で拒否されたため、破壊的なunpublishは行わず、初回package metadataの例外として保持する。今後のprereleaseではpublish前後の既存`latest`一致をguardし、READMEの導入例は`perttool@alpha`を明示する。
