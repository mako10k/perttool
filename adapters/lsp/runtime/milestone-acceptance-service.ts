import {
  formatEditorContract9Document,
  inspectEditorMilestoneAcceptance,
  prepareEditorContract9Document,
} from "../../../src/application/editor-milestone-acceptance.js";
import { analyzeDocument } from "../../../src/application/contract9-temporal.js";
import { renderContract9ScheduleAlerts } from "../../../src/application/contract9-projection.js";
import type { MilestoneAcceptanceEditorApplicationV1 } from "../src/protocol.js";

export function createMilestoneAcceptanceEditorApplication():
  MilestoneAcceptanceEditorApplicationV1 {
  return Object.freeze({
    prepareDocument: prepareEditorContract9Document,
    formatDocument: formatEditorContract9Document,
    inspectTemporal: (text) => {
      const result = analyzeDocument(text, { mode: "both", sourceOperand: "FILE" });
      return Object.freeze({
        grammarVersion: result.grammarVersion,
        state: result.scheduleAlerts?.state ?? "not_applicable",
        postdue: result.scheduleAlerts?.summary.postdue ?? 0,
        postdueForecast: result.scheduleAlerts?.summary.postdueForecast ?? 0,
        lines: Object.freeze(renderContract9ScheduleAlerts(result.scheduleAlerts).trimEnd().split("\n").filter(Boolean)),
      });
    },
    inspect: inspectEditorMilestoneAcceptance,
  });
}
