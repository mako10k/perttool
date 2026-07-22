import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { TextDecoder } from "node:util";

export interface DocumentContent {
  readonly bytes: Buffer;
  readonly text: string;
  readonly digest: string;
}

export function digestDocumentBytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function documentContentFromBytes(bytes: Uint8Array): DocumentContent {
  const ownedBytes = Buffer.from(bytes);
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  return {
    bytes: ownedBytes,
    text: decoder.decode(ownedBytes),
    digest: digestDocumentBytes(ownedBytes),
  };
}

export async function readDocumentFile(path: string): Promise<DocumentContent> {
  return documentContentFromBytes(await readFile(path));
}
