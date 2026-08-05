import { isAbsolute } from "node:path";
import { TextDecoder } from "node:util";
import type { NodeHostPorts } from "perttool/node";
import {
  MCP_LIMITS,
  mcpSourceError,
  type McpDocumentSourceV1,
  type McpOperation,
  type McpSourceBindingV1,
  type McpSourceErrorV1,
} from "./protocol.js";

export interface McpRegisteredDocumentV1 {
  readonly documentId: string;
  readonly path: string;
}

export interface McpResolvedSourceV1 {
  readonly text: string;
  readonly binding: McpSourceBindingV1;
}

export type McpSourceResolutionV1 =
  | { readonly ok: true; readonly value: McpResolvedSourceV1 }
  | { readonly ok: false; readonly error: McpSourceErrorV1 };

const registrationId = /^[\x21-\x7e]+$/u;

export function createRegistrationCatalog(
  registrations: readonly McpRegisteredDocumentV1[] = [],
): ReadonlyMap<string, string> {
  if (registrations.length > MCP_LIMITS.registrations) {
    throw new Error(
      `MCP registration count exceeds ${MCP_LIMITS.registrations}`,
    );
  }
  const result = new Map<string, string>();
  for (const registration of registrations) {
    if (
      registration.documentId.length === 0 ||
      registration.documentId.length > 128 ||
      !registrationId.test(registration.documentId)
    ) {
      throw new Error("MCP document IDs must be non-empty printable ASCII");
    }
    if (!isAbsolute(registration.path)) {
      throw new Error(`MCP registered path must be absolute: ${registration.documentId}`);
    }
    if (result.has(registration.documentId)) {
      throw new Error(`duplicate MCP document ID: ${registration.documentId}`);
    }
    result.set(registration.documentId, registration.path);
  }
  return result;
}

function mismatch(
  operation: McpOperation,
  binding: McpSourceBindingV1,
): McpSourceResolutionV1 {
  return {
    ok: false,
    error: mcpSourceError(
      operation,
      "PTMCP-103",
      "expected source digest does not match the exact source bytes",
      binding,
    ),
  };
}

function oversized(
  operation: McpOperation,
  binding: McpSourceBindingV1,
): McpSourceResolutionV1 {
  return {
    ok: false,
    error: mcpSourceError(
      operation,
      "PTMCP-104",
      `source exceeds ${MCP_LIMITS.sourceBytes} bytes`,
      binding,
    ),
  };
}

export async function resolveMcpSource(
  source: McpDocumentSourceV1,
  operation: McpOperation,
  catalog: ReadonlyMap<string, string>,
  host: Pick<NodeHostPorts, "digest" | "documentBytes">,
): Promise<McpSourceResolutionV1> {
  if (source.kind === "inline") {
    const bytes = Buffer.from(source.text, "utf8");
    const sourceDigest = host.digest.sha256Bytes(bytes);
    const binding = Object.freeze({
      kind: "inline" as const,
      document_id: null,
      source_digest: sourceDigest,
    });
    if (bytes.byteLength > MCP_LIMITS.sourceBytes) {
      return oversized(operation, binding);
    }
    if (
      source.expectedDigest !== undefined &&
      source.expectedDigest !== sourceDigest
    ) {
      return mismatch(operation, binding);
    }
    return {
      ok: true,
      value: Object.freeze({ text: source.text, binding }),
    };
  }

  const path = catalog.get(source.documentId);
  if (path === undefined) {
    return {
      ok: false,
      error: mcpSourceError(
        operation,
        "PTMCP-101",
        `unknown registered document ID: ${source.documentId}`,
      ),
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = await host.documentBytes.read(path);
  } catch {
    return {
      ok: false,
      error: mcpSourceError(
        operation,
        "PTMCP-102",
        `registered document is unavailable: ${source.documentId}`,
      ),
    };
  }
  const sourceDigest = host.digest.sha256Bytes(bytes);
  const binding = Object.freeze({
    kind: "registered" as const,
    document_id: source.documentId,
    source_digest: sourceDigest,
  });
  if (bytes.byteLength > MCP_LIMITS.sourceBytes) {
    return oversized(operation, binding);
  }
  if (source.expectedDigest !== sourceDigest) {
    return mismatch(operation, binding);
  }

  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    return { ok: true, value: Object.freeze({ text, binding }) };
  } catch {
    return {
      ok: false,
      error: mcpSourceError(
        operation,
        "PTMCP-102",
        `registered document is not valid UTF-8: ${source.documentId}`,
        binding,
      ),
    };
  }
}
