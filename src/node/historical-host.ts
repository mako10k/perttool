import {
  probeHistoricalGitEvidence,
} from "../history/git-probe.js";

/** Default read-only Node composition for the private historical CLI path. */
export function createHistoricalGraphGitEvidenceHost() {
  return Object.freeze({
    probe: probeHistoricalGitEvidence,
  });
}
