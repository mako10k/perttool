import process from "node:process";
import { Transform } from "node:stream";
import { TextDecoder } from "node:util";
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

function strictJsonLineInput(maximumLineBytes: number): Transform {
  let buffered = Buffer.alloc(0);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        buffered = Buffer.concat([buffered, chunk]);
        while (true) {
          const newline = buffered.indexOf(0x0a);
          if (newline < 0) break;
          const line = buffered.subarray(0, newline);
          buffered = buffered.subarray(newline + 1);
          if (line.byteLength > maximumLineBytes) {
            throw new Error(`MCP JSON-RPC line exceeds ${maximumLineBytes} bytes`);
          }
          JSON.parse(decoder.decode(line));
          this.push(Buffer.concat([line, Buffer.from("\n")]));
        }
        if (buffered.byteLength > maximumLineBytes) {
          throw new Error(`MCP JSON-RPC line exceeds ${maximumLineBytes} bytes`);
        }
        callback();
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    },
    flush(callback) {
      callback(buffered.byteLength === 0
        ? undefined
        : new Error("MCP JSON-RPC input ended with an incomplete line"));
    },
  });
}

export function startPerttoolMcpStdioServer(
  options: PerttoolMcpAdapterOptions = {},
): StdioServerHandle {
  const adapter = createPerttoolMcpAdapter(options);
  const input = strictJsonLineInput(MCP_LIMITS.requestBytes);
  process.stdin.pipe(input);
  return serveStdio(
    () => adapter.createServer(),
    {
      legacy: "reject",
      maxSubscriptions: 0,
      transport: new StdioServerTransport(
        input,
        process.stdout,
        { maxBufferSize: MCP_LIMITS.requestBytes },
      ),
      onerror(error) {
        process.stderr.write(`perttool-mcp: ${error.message}\n`);
      },
    },
  );
}
