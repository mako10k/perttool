import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(workspace, "dist");

await rm(dist, { force: true, recursive: true });
await mkdir(path.join(dist, "server"), { recursive: true });

await Promise.all([
  build({
    absWorkingDir: workspace,
    bundle: true,
    entryPoints: ["src/extension.ts"],
    external: ["vscode"],
    format: "cjs",
    legalComments: "none",
    outfile: "dist/extension.cjs",
    platform: "node",
    sourcemap: true,
    target: "node22",
  }),
  build({
    absWorkingDir: workspace,
    bundle: true,
    entryPoints: ["src/bindings.ts"],
    format: "esm",
    legalComments: "none",
    outfile: "dist/bindings.mjs",
    platform: "node",
    sourcemap: true,
    target: "node22",
  }),
  build({
    absWorkingDir: workspace,
    bundle: true,
    entryPoints: ["../lsp/src/main.ts"],
    format: "cjs",
    legalComments: "none",
    outfile: "dist/server/main.cjs",
    platform: "node",
    sourcemap: true,
    target: "node22",
  }),
]);
