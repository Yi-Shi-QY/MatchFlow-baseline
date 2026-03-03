import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface AnimationTemplate {
  id: string;
  name: string;
  description: string;
  schema: any;
  requiredParams: string[];
  example: any;
  fillParams: (params: any) => any;
  Component: React.FC<{ data: any }>;
}

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toText = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

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
  Component: StatsComparison,
};

const OddsCard: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 12 } });
  const had = data.had || { h: 0, d: 0, a: 0 };

  return (
    <div style={{ display: "flex", gap: "40px", width: "100%", justifyContent: "center", transform: `scale(${enter})` }}>
      <div style={{ background: "#18181b", padding: "40px", borderRadius: "20px", textAlign: "center", minWidth: "200px", border: "2px solid #10b981" }}>
        <div style={{ fontSize: "30px", color: "#a1a1aa", marginBottom: "10px" }}>{data.homeLabel || "HOME"}</div>
        <div style={{ fontSize: "60px", fontWeight: "bold", color: "#fff" }}>{had.h}</div>
      </div>
      <div style={{ background: "#18181b", padding: "40px", borderRadius: "20px", textAlign: "center", minWidth: "200px", border: "2px solid #71717a" }}>
        <div style={{ fontSize: "30px", color: "#a1a1aa", marginBottom: "10px" }}>DRAW</div>
        <div style={{ fontSize: "60px", fontWeight: "bold", color: "#fff" }}>{had.d}</div>
      </div>
      <div style={{ background: "#18181b", padding: "40px", borderRadius: "20px", textAlign: "center", minWidth: "200px", border: "2px solid #3b82f6" }}>
        <div style={{ fontSize: "30px", color: "#a1a1aa", marginBottom: "10px" }}>{data.awayLabel || "AWAY"}</div>
        <div style={{ fontSize: "60px", fontWeight: "bold", color: "#fff" }}>{had.a}</div>
      </div>
    </div>
  );
};

export const oddsTemplate: AnimationTemplate = {
  id: "odds-card",
  name: "Odds Display",
  description: "Display 1x2 (Home/Draw/Away) odds prominently.",
  schema: {
    type: "object",
    properties: {
      had: {
        type: "object",
        properties: {
          h: { type: "number" },
          d: { type: "number" },
          a: { type: "number" },
        },
      },
    },
    required: ["had"],
  },
  requiredParams: ["had.h", "had.d", "had.a"],
  example: {
    had: { h: 1.55, d: 4.2, a: 6.5 },
  },
  fillParams: (params: any) => ({
    homeLabel: toText(params?.homeLabel, "HOME"),
    awayLabel: toText(params?.awayLabel, "AWAY"),
    had: {
      h: toNumber(params?.had?.h, 0),
      d: toNumber(params?.had?.d, 0),
      a: toNumber(params?.had?.a, 0),
    },
  }),
  Component: OddsCard,
};

const TacticalBoard: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: "800px",
        height: "500px",
        background: "#064e3b",
        border: "4px solid white",
        position: "relative",
        borderRadius: "8px",
        opacity: interpolate(frame, [0, 20], [0, 1]),
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "100px",
          height: "100px",
          border: "2px solid white",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "0",
          left: "50%",
          width: "2px",
          height: "100%",
          background: "white",
          transform: "translateX(-50%)",
        }}
      />
      <div style={{ position: "absolute", top: "20px", left: "20px", color: "white", fontSize: "24px", fontWeight: "bold" }}>
        {data.formation || "Tactical View"}
      </div>
      <div style={{ position: "absolute", bottom: "20px", right: "20px", color: "#a1a1aa", fontSize: "20px" }}>
        {data.note}
      </div>
    </div>
  );
};

export const tacticalTemplate: AnimationTemplate = {
  id: "tactical-board",
  name: "Tactical Board",
  description: "A simple football pitch view for tactical notes.",
  schema: {
    type: "object",
    properties: {
      formation: { type: "string" },
      note: { type: "string" },
    },
  },
  requiredParams: ["formation"],
  example: {
    formation: "4-3-3 Attacking",
    note: "High press line",
  },
  fillParams: (params: any) => ({
    formation: toText(params?.formation, "Tactical View"),
    note: toText(params?.note, ""),
  }),
  Component: TacticalBoard,
};

export const TEMPLATES: Record<string, AnimationTemplate> = {
  "stats-comparison": statsTemplate,
  "odds-card": oddsTemplate,
  "tactical-board": tacticalTemplate,
};
