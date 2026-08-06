import { startPerttoolStdioServer } from "../src/stdio.js";
import { createHistoricalEditorApplication } from "./historical-service.js";

startPerttoolStdioServer(
  process.stdin,
  process.stdout,
  { historicalApplication: createHistoricalEditorApplication() },
);
