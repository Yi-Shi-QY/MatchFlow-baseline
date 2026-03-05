import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { toText } from "../../helpers";
import type { AnimationTemplate } from "../../types";

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

export const ANIMATION_TEMPLATE_ENTRIES: AnimationTemplate[] = [tacticalTemplate];
