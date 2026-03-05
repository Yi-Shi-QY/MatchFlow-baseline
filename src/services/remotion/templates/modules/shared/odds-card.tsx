import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { toNumber, toText } from "../../helpers";
import type { AnimationTemplate } from "../../types";

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
  validateParams: (params: any) => {
    const errors: string[] = [];
    if (!Number.isFinite(params?.had?.h)) errors.push("had.h must be a finite number");
    if (!Number.isFinite(params?.had?.d)) errors.push("had.d must be a finite number");
    if (!Number.isFinite(params?.had?.a)) errors.push("had.a must be a finite number");
    return errors;
  },
  buildFallbackParams: ({ homeName, awayName, baseExample }) => ({
    ...baseExample,
    homeLabel: homeName || "HOME",
    awayLabel: awayName || "AWAY",
  }),
  buildPromptExample: ({ homeName, awayName, baseExample }) => ({
    ...baseExample,
    homeLabel: homeName || "HOME",
    awayLabel: awayName || "AWAY",
  }),
  Component: OddsCard,
};

export const ANIMATION_TEMPLATE_ENTRIES: AnimationTemplate[] = [oddsTemplate];
