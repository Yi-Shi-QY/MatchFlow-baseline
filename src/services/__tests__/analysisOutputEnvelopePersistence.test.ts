import { beforeEach, describe, expect, it } from "vitest";
import type { Match } from "@/src/data/matches";
import type { MatchAnalysis } from "@/src/services/ai";
import { buildAnalysisOutputEnvelope } from "@/src/services/ai/multimodalCompatibility";
import {
  ANALYSIS_OUTPUT_ENVELOPE_CODE_KEY,
  clearHistory,
  getHistory,
  saveHistory,
} from "@/src/services/history";

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

const sampleMatch: Match = {
  id: "history_envelope_match",
  league: "Premier League",
  date: "2026-03-09T12:00:00.000Z",
  status: "finished",
  homeTeam: {
    id: "home_team",
    name: "Home Team",
    logo: "https://picsum.photos/seed/home-team/200/200",
    form: ["W", "D", "W", "L", "W"],
  },
  awayTeam: {
    id: "away_team",
    name: "Away Team",
    logo: "https://picsum.photos/seed/away-team/200/200",
    form: ["L", "W", "D", "W", "L"],
  },
  stats: {
    possession: { home: 55, away: 45 },
    shots: { home: 13, away: 8 },
    shotsOnTarget: { home: 6, away: 3 },
  },
};

const sampleAnalysis: MatchAnalysis = {
  prediction: "Home side has a narrow edge.",
  keyFactors: ["midfield control", "set-piece efficiency"],
  winProbability: {
    home: 48,
    draw: 27,
    away: 25,
  },
  expectedGoals: {
    home: 1.4,
    away: 0.9,
  },
};

describe("history output envelope persistence", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
    clearHistory();
  });

  it("persists and restores output envelope via generatedCodes metadata", async () => {
    const envelope = buildAnalysisOutputEnvelope(
      "## Summary\n\nHome side has a narrow edge.",
      [
        {
          type: "text",
          title: "Segment 1",
          content: "Home side dominates second-ball recoveries.",
        },
      ],
      { provider: "test-provider" },
    );

    await saveHistory({
      domainId: "football",
      subjectId: sampleMatch.id,
      subjectType: "match",
      subjectSnapshot: sampleMatch,
      analysisOutputEnvelope: envelope,
      subjectDisplay: sampleMatch,
      analysis: sampleAnalysis,
      generatedCodes: { diagnostics: "ok" },
    });

    const records = await getHistory({
      domainId: "football",
      subjectId: sampleMatch.id,
    });

    expect(records).toHaveLength(1);
    const record = records[0];
    expect(record.analysisOutputEnvelope).toEqual(envelope);
    expect(record.generatedCodes?.diagnostics).toBe("ok");
    expect(typeof record.generatedCodes?.[ANALYSIS_OUTPUT_ENVELOPE_CODE_KEY]).toBe("string");
    expect(
      JSON.parse(record.generatedCodes?.[ANALYSIS_OUTPUT_ENVELOPE_CODE_KEY] || "{}"),
    ).toEqual(envelope);
  });

  it("keeps backward compatibility when envelope metadata is malformed", async () => {
    await saveHistory({
      subjectDisplay: sampleMatch,
      analysis: sampleAnalysis,
      generatedCodes: {
        [ANALYSIS_OUTPUT_ENVELOPE_CODE_KEY]: "not-json",
      },
      domainId: "football",
      subjectId: sampleMatch.id,
      subjectType: "match",
    });

    const records = await getHistory({
      domainId: "football",
      subjectId: sampleMatch.id,
    });

    expect(records).toHaveLength(1);
    expect(records[0].analysisOutputEnvelope).toBeUndefined();
    expect(records[0].generatedCodes?.[ANALYSIS_OUTPUT_ENVELOPE_CODE_KEY]).toBe("not-json");
  });
});
