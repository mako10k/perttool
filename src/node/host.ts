import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  captureAdvanceHistoryBaseline,
  probeGitHistory,
  recheckAdvanceHistoryBaseline,
} from "../history/git-probe.js";
import {
  createArtifactFile,
  createValidatedDocumentFile,
  createValidatedDocumentFileFromSource,
  replaceValidatedDocumentFile,
} from "../io/safe-write.js";
import {
  NODE_HOST_PORT_MODEL_VERSION,
  type NodeHostPorts,
  type Sha256Digest,
} from "../ports/node-host.js";

function sha256Bytes(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256Utf8(text: string): Sha256Digest {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

export function createNodeHost(): NodeHostPorts {
  const host: NodeHostPorts = {
    modelVersion: NODE_HOST_PORT_MODEL_VERSION,
    digest: Object.freeze({ sha256Bytes, sha256Utf8 }),
    documentBytes: Object.freeze({
      async read(path: string): Promise<Uint8Array> {
        return new Uint8Array(await readFile(path));
      },
    }),
    bundledArtifacts: Object.freeze({
      read(location: URL): Uint8Array {
        return new Uint8Array(readFileSync(location));
      },
    }),
    gitEvidence: Object.freeze({
      probeHistory: probeGitHistory,
      captureAdvanceBaseline: captureAdvanceHistoryBaseline,
      recheckAdvanceBaseline: recheckAdvanceHistoryBaseline,
    }),
    safePersistence: Object.freeze({
      replaceValidatedDocument: replaceValidatedDocumentFile,
      createValidatedDocument: createValidatedDocumentFile,
      createValidatedDocumentFromSource: createValidatedDocumentFileFromSource,
      createArtifact: createArtifactFile,
    }),
    processContext: Object.freeze({
      cwd: () => process.cwd(),
      pid: () => process.pid,
      platform: () => process.platform,
      umask: () => process.umask(),
    }),
  };
  return Object.freeze(host);
}
