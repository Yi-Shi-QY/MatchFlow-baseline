import { describe, expect, it } from "vitest";
import type { AnalysisRequestPayload } from "@/src/services/ai/contracts";
import { resolvePlanningRoute } from "@/src/services/ai/planning";

describe("planning route compatibility", () => {
  it("honors sourceContext forced autonomous mode", () => {
    const matchData: AnalysisRequestPayload = {
      id: "match_autonomous",
      sourceContext: {
        domainId: "football",
        selectedSources: { fundamental: true },
        selectedSourceIds: ["fundamental"],
        planning: {
          mode: "autonomous",
        },
      },
    };

    const route = resolvePlanningRoute(matchData, {
      enableAutonomousPlanning: false,
      activeDomainId: "football",
    });

    expect(route.mode).toBe("autonomous");
    expect(route.allowedSourceIds).toContain("fundamental");
    expect(route.allowedAnimationTypes).toContain("none");
    expect(typeof route.plannerAgentId).toBe("string");
  });

  it("settings flag can force autonomous routing", () => {
    const matchData: AnalysisRequestPayload = {
      id: "match_settings_override",
      sourceContext: {
        domainId: "football",
      },
    };

    const route = resolvePlanningRoute(matchData, {
      enableAutonomousPlanning: true,
      activeDomainId: "football",
    });

    expect(route.mode).toBe("autonomous");
  });
});
