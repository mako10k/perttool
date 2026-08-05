#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
temporary_root=$(mktemp -d)
pack_directory="$temporary_root/packs"
install_directory="$temporary_root/install"
node_binary=${PERTTOOL_NODE_BINARY:-node}

cleanup() {
  rm -rf "$temporary_root"
}
trap cleanup EXIT

mkdir -p "$pack_directory" "$install_directory"
cd "$repository_root"

root_pack_name=$(npm pack --silent --pack-destination "$pack_directory")
lsp_pack_name=$(npm pack --silent \
  --workspace perttool-language-server-private \
  --pack-destination "$pack_directory")

npm install \
  --prefix "$install_directory" \
  --ignore-scripts \
  --no-audit \
  --no-fund \
  "$pack_directory/$root_pack_name" \
  "$pack_directory/$lsp_pack_name" >/dev/null

server_entry="$install_directory/node_modules/perttool-language-server-private/dist/main.js"
if [[ ! -f "$server_entry" ]]; then
  printf 'isolated LSP server entry is missing\n' >&2
  exit 1
fi

"$node_binary" "$repository_root/scripts/check-lsp-isolated.mjs" "$server_entry"
printf 'isolated LSP package acceptance passed\n'
