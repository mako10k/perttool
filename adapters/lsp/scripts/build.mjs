import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const run = promisify(execFile);
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(workspace, "../..");

await run(process.execPath, [
  path.join(repositoryRoot, "node_modules", "typescript", "bin", "tsc"),
  "-p",
  path.join(workspace, "tsconfig.json"),
]);

await build({
  absWorkingDir: workspace,
  bundle: true,
  entryPoints: ["runtime/main.ts"],
  external: ["perttool/core", "vscode-languageserver/node.js"],
  format: "esm",
  legalComments: "none",
  outfile: "dist/main.js",
  platform: "node",
  sourcemap: true,
  target: "node22",
});
