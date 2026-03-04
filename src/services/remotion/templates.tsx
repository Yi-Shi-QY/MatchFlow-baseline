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

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
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

const FengshuiQiRadar: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 14 } });
  const fade = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const metrics = [
    { label: "Qi Flow", value: clampPercent(toNumber(data?.qiFlowScore, 0)), color: "#34d399" },
    { label: "Harmony", value: clampPercent(toNumber(data?.harmonyScore, 0)), color: "#60a5fa" },
    { label: "Pressure", value: clampPercent(toNumber(data?.pressureScore, 0)), color: "#f97316" },
  ];

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "28px", opacity: fade }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "38px", color: "#e4e4e7" }}>
        <div>{data?.subjectLabel || "Subject"}</div>
        <div style={{ color: "#a1a1aa" }}>{data?.metric || "Qi Structure"}</div>
        <div>{data?.referenceLabel || "Reference"}</div>
      </div>

      {metrics.map((metric, idx) => (
        <div key={metric.label} style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div style={{ width: "160px", fontSize: "28px", color: "#d4d4d8" }}>{metric.label}</div>
          <div style={{ flex: 1, height: "26px", background: "#18181b", borderRadius: "999px", overflow: "hidden" }}>
            <div
              style={{
                width: `${metric.value}%`,
                height: "100%",
                borderRadius: "999px",
                background: metric.color,
                transform: `scaleX(${reveal})`,
                transformOrigin: "left",
                transition: "width 300ms ease",
              }}
            />
          </div>
          <div
            style={{
              width: "90px",
              textAlign: "right",
              fontSize: "34px",
              fontWeight: 700,
              color: metric.color,
              opacity: interpolate(frame, [idx * 6, idx * 6 + 18], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {Math.round(metric.value)}
          </div>
        </div>
      ))}
    </div>
  );
};

export const fengshuiQiTemplate: AnimationTemplate = {
  id: "fengshui-qi-radar",
  name: "Feng Shui Qi Radar",
  description: "Shows qi flow, harmony, and pressure as a domain-specific structure panel.",
  schema: {
    type: "object",
    properties: {
      subjectLabel: { type: "string" },
      referenceLabel: { type: "string" },
      metric: { type: "string" },
      qiFlowScore: { type: "number" },
      harmonyScore: { type: "number" },
      pressureScore: { type: "number" },
    },
    required: ["subjectLabel", "referenceLabel", "qiFlowScore", "harmonyScore", "pressureScore"],
  },
  requiredParams: ["subjectLabel", "referenceLabel", "qiFlowScore", "harmonyScore", "pressureScore"],
  example: {
    subjectLabel: "Riverview Apartment A",
    referenceLabel: "South Ridge Axis",
    metric: "Qi Structure",
    qiFlowScore: 78,
    harmonyScore: 72,
    pressureScore: 34,
  },
  fillParams: (params: any) => ({
    subjectLabel: toText(params?.subjectLabel, "Subject"),
    referenceLabel: toText(params?.referenceLabel, "Reference"),
    metric: toText(params?.metric, "Qi Structure"),
    qiFlowScore: clampPercent(toNumber(params?.qiFlowScore, 0)),
    harmonyScore: clampPercent(toNumber(params?.harmonyScore, 0)),
    pressureScore: clampPercent(toNumber(params?.pressureScore, 0)),
  }),
  Component: FengshuiQiRadar,
};

const FengshuiCompassGrid: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  const pulse = interpolate(frame % 60, [0, 30, 60], [0.85, 1, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "26px" }}>
      <div
        style={{
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          border: "4px solid #d4d4d8",
          position: "relative",
          transform: `scale(${pop})`,
          background:
            "radial-gradient(circle at center, rgba(34,197,94,0.16) 0%, rgba(24,24,27,0.92) 62%, rgba(9,9,11,1) 100%)",
        }}
      >
        <div style={{ position: "absolute", top: "18px", left: "50%", transform: "translateX(-50%)", fontSize: "26px", color: "#e4e4e7" }}>N</div>
        <div style={{ position: "absolute", bottom: "18px", left: "50%", transform: "translateX(-50%)", fontSize: "26px", color: "#e4e4e7" }}>S</div>
        <div style={{ position: "absolute", left: "18px", top: "50%", transform: "translateY(-50%)", fontSize: "26px", color: "#e4e4e7" }}>W</div>
        <div style={{ position: "absolute", right: "18px", top: "50%", transform: "translateY(-50%)", fontSize: "26px", color: "#e4e4e7" }}>E</div>
        <div
          style={{
            position: "absolute",
            inset: "50% auto auto 50%",
            width: "170px",
            height: "170px",
            borderRadius: "50%",
            border: "2px solid #a3a3a3",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "34px",
            fontWeight: 700,
            color: "#f4f4f5",
            background: "rgba(39,39,42,0.72)",
          }}
        >
          {toText(data?.direction, "South")}
        </div>
        <div
          style={{
            position: "absolute",
            top: "14%",
            right: "12%",
            background: "rgba(16,185,129,0.22)",
            color: "#34d399",
            border: "1px solid #34d399",
            borderRadius: "999px",
            padding: "8px 16px",
            fontSize: "22px",
            transform: `scale(${pulse})`,
          }}
        >
          {toText(data?.activeSector, "Active Sector")}
        </div>
      </div>

      <div style={{ width: "90%", display: "flex", gap: "16px" }}>
        <div style={{ flex: 1, background: "#18181b", border: "1px solid #3f3f46", borderRadius: "14px", padding: "16px" }}>
          <div style={{ fontSize: "18px", color: "#a1a1aa", marginBottom: "4px" }}>Support</div>
          <div style={{ fontSize: "24px", color: "#e4e4e7" }}>{toText(data?.supportSector, "Support Sector")}</div>
        </div>
        <div style={{ flex: 1, background: "#18181b", border: "1px solid #3f3f46", borderRadius: "14px", padding: "16px" }}>
          <div style={{ fontSize: "18px", color: "#a1a1aa", marginBottom: "4px" }}>Caution</div>
          <div style={{ fontSize: "24px", color: "#e4e4e7" }}>{toText(data?.cautionSector, "Caution Sector")}</div>
        </div>
      </div>
    </div>
  );
};

export const fengshuiCompassTemplate: AnimationTemplate = {
  id: "fengshui-compass-grid",
  name: "Feng Shui Compass Grid",
  description: "Displays directional focus, active sector, and support/caution sectors.",
  schema: {
    type: "object",
    properties: {
      direction: { type: "string" },
      activeSector: { type: "string" },
      supportSector: { type: "string" },
      cautionSector: { type: "string" },
      note: { type: "string" },
    },
    required: ["direction", "activeSector"],
  },
  requiredParams: ["direction", "activeSector"],
  example: {
    direction: "South-East",
    activeSector: "Prosperity",
    supportSector: "Study",
    cautionSector: "Conflict",
    note: "Entry alignment supports stable qi intake.",
  },
  fillParams: (params: any) => ({
    direction: toText(params?.direction, "South"),
    activeSector: toText(params?.activeSector, "Active Sector"),
    supportSector: toText(params?.supportSector, "Support Sector"),
    cautionSector: toText(params?.cautionSector, "Caution Sector"),
    note: toText(params?.note, ""),
  }),
  Component: FengshuiCompassGrid,
};

const FengshuiCycleBoard: React.FC<{ data: any }> = ({ data }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const yearlyInfluence = toNumber(data?.yearlyInfluence, 0);
  const monthlyInfluence = toNumber(data?.monthlyInfluence, 0);
  const resolveTone = (value: number) => (value >= 0 ? "#34d399" : "#fb923c");

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "22px", opacity: enter }}>
      <div style={{ display: "flex", gap: "16px" }}>
        <div
          style={{
            flex: 1,
            background: "#18181b",
            border: `1px solid ${resolveTone(yearlyInfluence)}`,
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div style={{ fontSize: "22px", color: "#a1a1aa", marginBottom: "10px" }}>Yearly Influence</div>
          <div style={{ fontSize: "56px", fontWeight: 700, color: resolveTone(yearlyInfluence) }}>{yearlyInfluence.toFixed(1)}</div>
        </div>
        <div
          style={{
            flex: 1,
            background: "#18181b",
            border: `1px solid ${resolveTone(monthlyInfluence)}`,
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div style={{ fontSize: "22px", color: "#a1a1aa", marginBottom: "10px" }}>Monthly Influence</div>
          <div style={{ fontSize: "56px", fontWeight: 700, color: resolveTone(monthlyInfluence) }}>{monthlyInfluence.toFixed(1)}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ background: "#052e16", border: "1px solid #14532d", borderRadius: "12px", padding: "14px 16px" }}>
          <div style={{ fontSize: "18px", color: "#86efac", marginBottom: "6px" }}>Favorable Window</div>
          <div style={{ fontSize: "26px", color: "#dcfce7" }}>{toText(data?.favorableWindow, "N/A")}</div>
        </div>
        <div style={{ background: "#431407", border: "1px solid #7c2d12", borderRadius: "12px", padding: "14px 16px" }}>
          <div style={{ fontSize: "18px", color: "#fdba74", marginBottom: "6px" }}>Caution Window</div>
          <div style={{ fontSize: "26px", color: "#ffedd5" }}>{toText(data?.cautionWindow, "N/A")}</div>
        </div>
      </div>
    </div>
  );
};

export const fengshuiCycleTemplate: AnimationTemplate = {
  id: "fengshui-cycle-board",
  name: "Feng Shui Cycle Board",
  description: "Visualizes yearly/monthly influence and favorable/caution windows.",
  schema: {
    type: "object",
    properties: {
      yearlyInfluence: { type: "number" },
      monthlyInfluence: { type: "number" },
      favorableWindow: { type: "string" },
      cautionWindow: { type: "string" },
    },
    required: ["yearlyInfluence", "monthlyInfluence", "favorableWindow", "cautionWindow"],
  },
  requiredParams: ["yearlyInfluence", "monthlyInfluence", "favorableWindow", "cautionWindow"],
  example: {
    yearlyInfluence: 4.2,
    monthlyInfluence: 2.1,
    favorableWindow: "Bright cycle days",
    cautionWindow: "Conflict cycle days",
  },
  fillParams: (params: any) => ({
    yearlyInfluence: toNumber(params?.yearlyInfluence, 0),
    monthlyInfluence: toNumber(params?.monthlyInfluence, 0),
    favorableWindow: toText(params?.favorableWindow, "Favorable window"),
    cautionWindow: toText(params?.cautionWindow, "Caution window"),
  }),
  Component: FengshuiCycleBoard,
};

export const TEMPLATES: Record<string, AnimationTemplate> = {
  "stats-comparison": statsTemplate,
  "odds-card": oddsTemplate,
  "tactical-board": tacticalTemplate,
  "fengshui-qi-radar": fengshuiQiTemplate,
  "fengshui-compass-grid": fengshuiCompassTemplate,
  "fengshui-cycle-board": fengshuiCycleTemplate,
};
