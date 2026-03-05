import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { toNumber, toText } from "../../helpers";
import type { AnimationTemplate } from "../../types";

const StatsComparison: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const homeValue = data.homeValue || 0;
  const awayValue = data.awayValue || 0;
  const maxValue = Math.max(homeValue, awayValue, 1);
  const progress = spring({ frame, fps, config: { damping: 15 } });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "40px", width: "100%", padding: "0 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "60px", fontWeight: "bold", color: "#10b981" }}>{data.homeLabel}</div>
        <div style={{ fontSize: "40px", color: "#a1a1aa" }}>{data.metric}</div>
        <div style={{ fontSize: "60px", fontWeight: "bold", color: "#3b82f6" }}>{data.awayLabel}</div>
      </div>

      <div style={{ display: "flex", gap: "20px", height: "60px" }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              width: `${(homeValue / maxValue) * 100}%`,
              background: "#10b981",
              borderRadius: "10px",
              transform: `scaleX(${progress})`,
              transformOrigin: "right",
            }}
          />
        </div>
        <div style={{ width: "4px", background: "#3f3f46" }} />
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
          <div
            style={{
              width: `${(awayValue / maxValue) * 100}%`,
              background: "#3b82f6",
              borderRadius: "10px",
              transform: `scaleX(${progress})`,
              transformOrigin: "left",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "80px", fontWeight: "bold" }}>
        <div style={{ opacity: interpolate(frame, [0, 20], [0, 1]) }}>{homeValue}</div>
        <div style={{ opacity: interpolate(frame, [0, 20], [0, 1]) }}>{awayValue}</div>
      </div>
    </div>
  );
};

export const statsTemplate: AnimationTemplate = {
  id: "stats-comparison",
  name: "Stats Comparison",
  description: "Compare two numerical values (e.g., possession, shots) with animated bars.",
  schema: {
    type: "object",
    properties: {
      homeLabel: { type: "string" },
      awayLabel: { type: "string" },
      metric: { type: "string", description: "Name of the stat (e.g. Possession)" },
      homeValue: { type: "number" },
      awayValue: { type: "number" },
    },
    required: ["homeLabel", "awayLabel", "metric", "homeValue", "awayValue"],
  },
  requiredParams: ["homeLabel", "awayLabel", "metric", "homeValue", "awayValue"],
  example: {
    homeLabel: "Man City",
    awayLabel: "Liverpool",
    metric: "Possession (%)",
    homeValue: 65,
    awayValue: 35,
  },
  fillParams: (params: any) => ({
    homeLabel: toText(params?.homeLabel, "Home Team"),
    awayLabel: toText(params?.awayLabel, "Away Team"),
    metric: toText(params?.metric, "Metric"),
    homeValue: toNumber(params?.homeValue, 0),
    awayValue: toNumber(params?.awayValue, 0),
  }),
  validateParams: (params: any) => {
    const errors: string[] = [];
    if (!Number.isFinite(params?.homeValue)) errors.push("homeValue must be a finite number");
    if (!Number.isFinite(params?.awayValue)) errors.push("awayValue must be a finite number");
    return errors;
  },
  buildFallbackParams: ({ homeName, awayName, baseExample }) => ({
    ...baseExample,
    homeLabel: homeName || "Home Team",
    awayLabel: awayName || "Away Team",
    metric: "Comparison",
    homeValue: 0,
    awayValue: 0,
  }),
  buildPromptExample: ({ homeName, awayName, baseExample }) => ({
    ...baseExample,
    homeLabel: homeName || "Home Team",
    awayLabel: awayName || "Away Team",
  }),
  Component: StatsComparison,
};

export const ANIMATION_TEMPLATE_ENTRIES: AnimationTemplate[] = [statsTemplate];
