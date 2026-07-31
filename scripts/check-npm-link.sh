#!/usr/bin/env bash

set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

temporary_root=${TMPDIR:-/tmp}
link_prefix=$(mktemp -d "$temporary_root/perttool-npm-link.XXXXXX")
case "$link_prefix" in
  "$temporary_root"/perttool-npm-link.*) ;;
  *)
    printf 'unsafe temporary npm prefix: %s\n' "$link_prefix" >&2
    exit 1
    ;;
esac
trap 'rm -rf -- "$link_prefix"' EXIT

npm_config_prefix=$link_prefix npm link --foreground-scripts

linked_cli=$link_prefix/bin/perttool
if [[ ! -x "$linked_cli" ]]; then
  printf 'linked CLI is not executable: %s\n' "$linked_cli" >&2
  exit 1
fi

expected_version=$(node -p '"perttool " + require("./package.json").version')
actual_version=$("$linked_cli" --version)
if [[ "$actual_version" != "$expected_version" ]]; then
  printf 'linked CLI version mismatch: expected %s, got %s\n' \
    "$expected_version" "$actual_version" >&2
  exit 1
fi

(
  cd "$link_prefix"
  "$linked_cli" document check "$repo_root/docs/examples/minimal.pert" --format=json >/dev/null
  "$linked_cli" document check \
    "$repo_root/test/fixtures/project-actuals-v5.pert" \
    --format=json |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const result = JSON.parse(input);
        if (
          result.schema_version !== "Perttool.CheckResult.v3" ||
          result.cli_contract_version !== 6 ||
          result.grammar_version !== 5 ||
          result.actuals_inputs?.events?.length !== 0
        ) process.exit(1);
      });
    '
  "$linked_cli" task start \
    "$repo_root/test/fixtures/project-actuals-v5.pert" \
    WORK \
    --at=2026-07-29T09:00:00+09:00 \
    --actor=user \
    --format=json |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const result = JSON.parse(input);
        if (
          result.schema_version !== "Perttool.MutationResult.v3" ||
          result.cli_contract_version !== 6 ||
          result.changed !== true ||
          result.write?.mode !== "preview" ||
          result.lifecycle?.from_state !== "planned" ||
          result.lifecycle?.to_state !== "active"
        ) process.exit(1);
      });
    '
  "$linked_cli" guide --format=json |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const result = JSON.parse(input);
        const topicIds = result.topics?.map(({ id }) => id);
        if (
          result.schema_version !== "Perttool.GuideResult.v1" ||
          result.cli_contract_version !== 6 ||
          result.operation !== "guide" ||
          JSON.stringify(topicIds) !== JSON.stringify([
            "syntax",
            "analysis",
            "next",
            "editing",
            "actuals",
            "mermaid",
            "workflows",
            "errors",
            "samples",
          ]) ||
          /[\u3040-\u30ff\u4e00-\u9fff]/u.test(JSON.stringify(result))
        ) process.exit(1);
      });
    '
  "$linked_cli" guide next --level=detail --format=json |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const result = JSON.parse(input);
        const sectionIds = result.sections?.map(({ id }) => id);
        if (
          result.schema_version !== "Perttool.GuideResult.v1" ||
          result.cli_contract_version !== 6 ||
          result.operation !== "guide" ||
          result.topic_id !== "next" ||
          JSON.stringify(sectionIds) !== JSON.stringify([
            "classification",
            "recommendation",
            "consumer-safety",
            "authority-adoption",
            "selection",
            "override-validation",
            "explanation",
          ]) ||
          /[\u3040-\u30ff\u4e00-\u9fff]/u.test(JSON.stringify(result))
        ) process.exit(1);
      });
    '
  "$linked_cli" project show "$repo_root/docs/examples/minimal.pert" --format=json >/dev/null
  "$linked_cli" help dag advance --format=json |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const result = JSON.parse(input);
        const command = result.commands?.[0];
        if (
          result.schema_version !== "Perttool.CommandHelpResult.v1" ||
          JSON.stringify(command?.result_schemas) !== JSON.stringify([
            "Perttool.AdvanceResult.v1",
            "Perttool.CliError.v1",
          ]) ||
          !command?.options?.some(
            ({ name }) => name === "force-history-loss",
          )
        ) process.exit(1);
      });
    '
  "$linked_cli" guide editing --level=detail --format=json |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const result = JSON.parse(input);
        const serialized = JSON.stringify(result);
        if (
          result.schema_version !== "Perttool.GuideResult.v1" ||
          result.topic_id !== "editing" ||
          !serialized.includes("PTADV-101") ||
          !serialized.includes("PTADV-102") ||
          !serialized.includes("PTADV-103") ||
          !serialized.includes("--force-history-loss")
        ) process.exit(1);
      });
    '
  "$linked_cli" schema Perttool.AdvanceResult.v1 --format=json |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const result = JSON.parse(input);
        if (
          result.schema_version !== "Perttool.SchemaResult.v1" ||
          result.schemas?.length !== 19 ||
          result.schema?.$id !==
            "https://github.com/mako10k/perttool/schemas/Perttool.AdvanceResult.v1.schema.json" ||
          result.schema?.properties?.history_guard === undefined
        ) process.exit(1);
      });
    '
  "$linked_cli" schema Perttool.NextResult.v5 --format=json |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const result = JSON.parse(input);
        if (
          result.schema_version !== "Perttool.SchemaResult.v1" ||
          result.cli_contract_version !== 6 ||
          result.schemas?.length !== 19 ||
          result.schema?.$schema !==
            "https://json-schema.org/draft/2020-12/schema" ||
          result.schema?.$id !==
            "https://github.com/mako10k/perttool/schemas/Perttool.NextResult.v5.schema.json"
        ) process.exit(1);
      });
    '
  "$linked_cli" dag advance \
    "$repo_root/docs/examples/advance-partial-before.pert" \
    --format=json |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const result = JSON.parse(input);
        if (
          result.schema_version !== "Perttool.AdvanceResult.v1" ||
          result.history_guard?.status !== "not_applicable" ||
          result.history_guard?.cause !== "preview" ||
          result.history_guard?.destructive_entity_ids?.length === 0
        ) process.exit(1);
      });
    '
  "$linked_cli" schema Perttool.NextResult.v5 --view=outline --format=json |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const result = JSON.parse(input);
        if (
          result.query?.view !== "outline" ||
          Object.hasOwn(result.schema ?? {}, "$defs") ||
          result.schema?.properties?.groups?.$ref !==
            "https://github.com/mako10k/perttool/schemas/Perttool.NextResult.v5.schema.json#/properties/groups"
        ) process.exit(1);
      });
    '
  "$linked_cli" help project init --format=json >/dev/null
  "$linked_cli" agent help codex instruction --format=json >/dev/null
  "$linked_cli" dag render "$repo_root/docs/examples/minimal.pert" --to mermaid --format=json >/dev/null
)

printf 'npm link check passed (%s)\n' "$actual_version"
