#!/usr/bin/env node
import process from "node:process";
import { startPerttoolMcpStdioServer } from "./stdio.js";
import type { McpRegisteredDocumentV1 } from "./source.js";

function registrations(args: readonly string[]): readonly McpRegisteredDocumentV1[] {
  const result: McpRegisteredDocumentV1[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option !== "--document") {
      throw new Error(`unknown perttool MCP launcher option: ${option ?? ""}`);
    }
    const value = args[index + 1];
    if (value === undefined) {
      throw new Error("--document requires ID=/absolute/path");
    }
    const separator = value.indexOf("=");
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error("--document requires ID=/absolute/path");
    }
    result.push(Object.freeze({
      documentId: value.slice(0, separator),
      path: value.slice(separator + 1),
    }));
    index += 1;
  }
  return Object.freeze(result);
}

try {
  startPerttoolMcpStdioServer({
    registrations: registrations(process.argv.slice(2)),
  });
} catch (error) {
  process.stderr.write(
    `perttool-mcp: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
