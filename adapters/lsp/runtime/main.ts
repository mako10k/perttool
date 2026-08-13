import { startPerttoolStdioServer } from "../src/stdio.js";
import { createHistoricalEditorApplication } from "./historical-service.js";
import { createDagFocusApplication } from "./dag-focus-service.js";
import { createMilestoneAcceptanceEditorApplication } from "./milestone-acceptance-service.js";

startPerttoolStdioServer(
  process.stdin,
  process.stdout,
  {
    historicalApplication: createHistoricalEditorApplication(),
    dagFocusApplication: createDagFocusApplication(),
    milestoneAcceptanceApplication:
      createMilestoneAcceptanceEditorApplication(),
  },
);
