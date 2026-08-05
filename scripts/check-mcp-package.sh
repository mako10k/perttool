#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
temporary_root=$(mktemp -d)
pack_directory="$temporary_root/packs"
install_directory="$temporary_root/install"
run_directory="$temporary_root/run"
inventory="$temporary_root/mcp-inventory.txt"
before="$temporary_root/before.sha256"
after="$temporary_root/after.sha256"
node_binary=${PERTTOOL_NODE_BINARY:-node}

cleanup() {
  rm -rf "$temporary_root"
}
trap cleanup EXIT

mkdir -p "$pack_directory" "$install_directory" "$run_directory"
cd "$repository_root"

root_pack_name=$(npm pack --silent --pack-destination "$pack_directory")
mcp_pack_name=$(npm pack --silent \
  --workspace perttool-mcp-private \
  --pack-destination "$pack_directory")

tar -tzf "$pack_directory/$mcp_pack_name" | sort >"$inventory"
if grep -Ev '^package/(dist/.*|package.json)$' "$inventory" >/dev/null; then
  printf 'private MCP package contains an unaccepted file\n' >&2
  exit 1
fi
for required in \
  package/dist/main.js \
  package/dist/index.js \
  package/dist/server.js \
  package/package.json; do
  if ! grep -Fx "$required" "$inventory" >/dev/null; then
    printf 'private MCP package is missing %s\n' "$required" >&2
    exit 1
  fi
done

npm install \
  --prefix "$install_directory" \
  --ignore-scripts \
  --no-audit \
  --no-fund \
  "$pack_directory/$root_pack_name" \
  "$pack_directory/$mcp_pack_name" >/dev/null

server_entry="$install_directory/node_modules/perttool-mcp-private/dist/main.js"
root_entry="$install_directory/node_modules/perttool/dist/index.js"
document_path="$run_directory/accepted.pert"
if [[ ! -f "$server_entry" || ! -f "$root_entry" ]]; then
  printf 'isolated MCP or root package entry is missing\n' >&2
  exit 1
fi
cp "$repository_root/docs/examples/minimal.pert" "$document_path"
find "$run_directory" -type f -print0 | sort -z | xargs -0 sha256sum >"$before"

cd "$run_directory"
"$node_binary" "$repository_root/scripts/check-mcp-isolated.mjs" \
  "$server_entry" "$root_entry" "$document_path"

find "$run_directory" -type f -print0 | sort -z | xargs -0 sha256sum >"$after"
if ! cmp -s "$before" "$after"; then
  printf 'isolated MCP execution changed its project input or created files\n' >&2
  exit 1
fi

printf 'isolated MCP package acceptance passed\n'
