import process from "node:process";
import {
  StdioServerTransport,
  serveStdio,
  type StdioServerHandle,
} from "@modelcontextprotocol/server/stdio";
import { MCP_LIMITS } from "./protocol.js";
import {
  createPerttoolMcpAdapter,
  type PerttoolMcpAdapterOptions,
} from "./server.js";

export function startPerttoolMcpStdioServer(
  options: PerttoolMcpAdapterOptions = {},
): StdioServerHandle {
  const adapter = createPerttoolMcpAdapter(options);
  return serveStdio(
    () => adapter.createServer(),
    {
      legacy: "reject",
      maxSubscriptions: 0,
      transport: new StdioServerTransport(
        process.stdin,
        process.stdout,
        { maxBufferSize: MCP_LIMITS.requestBytes },
      ),
      onerror(error) {
        process.stderr.write(`perttool-mcp: ${error.message}\n`);
      },
    },
  );
}
