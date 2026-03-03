import React from "react";
import type { PlannerGraph, PlannerRuntimeState, PlannerStage } from "@/src/services/planner/runtime";
import {
  type PlannerLanguage,
  MACRO_STAGE_SEQUENCE,
  getMacroStageVisualState,
  getSegmentVisualState,
} from "./model";

interface AnalysisPlannerFallback2DProps {
  graph: PlannerGraph;
  runtimeState: PlannerRuntimeState;
  language: PlannerLanguage;
  className?: string;
  mode?: "default" | "square";
}

function nodeClassByState(state: "pending" | "running" | "completed" | "failed" | "cancelled"): string {
  if (state === "running") return "bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.7)]";
  if (state === "completed") return "bg-emerald-500";
  if (state === "failed") return "bg-rose-400";
  if (state === "cancelled") return "bg-amber-300";
  return "bg-zinc-600";
}

function parseStageId(nodeId: string): PlannerStage | null {
  if (!nodeId.startsWith("stage:")) return null;
  return nodeId.slice("stage:".length) as PlannerStage;
}

function parseSegmentId(nodeId: string): number {
  if (!nodeId.startsWith("segment:")) return -1;
  return Number(nodeId.slice("segment:".length));
}

export function AnalysisPlannerFallback2D({
  graph,
  runtimeState,
  language,
  className,
  mode = "default",
}: AnalysisPlannerFallback2DProps) {
  const isSquare = mode === "square";
  const macroNodes = graph.nodes
    .filter((node) => node.kind === "stage")
    .sort((a, b) => {
      const aStage = parseStageId(a.id);
      const bStage = parseStageId(b.id);
      const aRank = aStage ? MACRO_STAGE_SEQUENCE.indexOf(aStage) : Number.MAX_SAFE_INTEGER;
      const bRank = bStage ? MACRO_STAGE_SEQUENCE.indexOf(bStage) : Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    });
  const segmentNodes = graph.nodes
    .filter((node) => node.kind === "segment")
    .sort((a, b) => parseSegmentId(a.id) - parseSegmentId(b.id));

  const totalSegments = Math.max(runtimeState.totalSegments, segmentNodes.length);
  const activeSegmentIndex =
    totalSegments > 0 &&
    (runtimeState.stage === "segment_running" ||
      runtimeState.stage === "animation_generating" ||
      runtimeState.stage === "tag_generating")
      ? Math.max(0, Math.min(totalSegments - 1, Math.floor(runtimeState.segmentIndex)))
      : -1;

  const containerClass = className ? `relative ${className}` : "relative";
  const macroRadius = isSquare ? 36 : 66;
  const segmentRadius = isSquare ? 22 : 40;
  const outerInsetClass = isSquare ? "inset-2.5" : "inset-4";
  const innerInsetClass = isSquare ? "inset-6" : "inset-10";
  const beamWidthClass = isSquare ? "w-7" : "w-10";
  const innerHeightClass = isSquare ? "h-full w-full" : "h-44";

  return (
    <div
      className={containerClass}
      aria-label={language === "zh" ? "分析规划回退视图" : "Analysis planner fallback view"}
    >
      <div className={`relative ${innerHeightClass} rounded-xl border border-white/10 bg-zinc-950/80 overflow-hidden`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,0.14),transparent_55%)]" />
        <div className={`absolute ${outerInsetClass} rounded-full border border-zinc-700/50`} />
        <div className={`absolute ${innerInsetClass} rounded-full border border-zinc-800/70`} />

        {macroNodes.map((node, idx) => {
          const angle = ((idx / Math.max(1, macroNodes.length)) * Math.PI * 2) - Math.PI / 2;
          const radius = macroRadius;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const stageId = parseStageId(node.id);
          const state = stageId
            ? getMacroStageVisualState(stageId, runtimeState)
            : "pending";
          const label = node.label;
          return (
            <div
              key={node.id}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              <div className={`h-2.5 w-2.5 rounded-full ${nodeClassByState(state)} ${state === "running" ? "animate-pulse" : ""}`} />
              {!isSquare && (
                <div className="mt-1 text-[9px] text-zinc-400 whitespace-nowrap text-center -translate-x-1/2 relative left-1/2">
                  {label}
                </div>
              )}
            </div>
          );
        })}

        {segmentNodes.map((node, idx) => {
          const angle = ((idx / Math.max(1, segmentNodes.length)) * Math.PI * 2) - Math.PI / 2;
          const radius = segmentRadius;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const state = getSegmentVisualState(idx, runtimeState, totalSegments);
          return (
            <div
              key={node.id}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              <div className={`h-2 w-2 rounded-full ${nodeClassByState(state)} ${state === "running" ? "animate-pulse" : ""}`} />
            </div>
          );
        })}

        {activeSegmentIndex >= 0 && totalSegments > 0 && (
          <div
            className={`absolute left-1/2 top-1/2 h-0.5 ${beamWidthClass} origin-left -translate-y-1/2 bg-cyan-300/85 animate-pulse`}
            style={{
              transform: `translateY(-1px) rotate(${(activeSegmentIndex / totalSegments) * 360 - 90}deg)`,
            }}
          />
        )}
      </div>
    </div>
  );
}
