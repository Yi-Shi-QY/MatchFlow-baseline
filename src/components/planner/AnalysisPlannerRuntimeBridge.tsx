import React from "react";
import {
  buildPlannerRuntimeState,
  createPlannerRunId,
  type PlannerRuntimeState,
} from "@/src/services/planner/runtime";
import { AnalysisPlannerFallback2D } from "./AnalysisPlannerFallback2D";
import { ThreeAnalysisPlanner } from "./ThreeAnalysisPlanner";
import {
  buildDefaultPlannerGraph,
  getMacroStageLabel,
  getMacroStageVisualState,
  MACRO_STAGE_SEQUENCE,
  type PlannerLanguage,
} from "./model";

interface AnalysisPlannerRuntimeBridgeProps {
  runtimeStatus: PlannerRuntimeState | null;
  planTotalSegments: number;
  planCompletedSegments: number;
  parsedSegmentCount?: number;
  language: PlannerLanguage;
  className?: string;
  compact?: boolean;
}

type PlannerVisualState = "pending" | "running" | "completed" | "failed" | "cancelled";

function stepBlockClass(state: PlannerVisualState): string {
  if (state === "running") return "border-cyan-200/90 bg-gradient-to-b from-cyan-300 to-emerald-500 shadow-[0_0_16px_rgba(45,212,191,0.55)]";
  if (state === "completed") return "border-emerald-600 bg-gradient-to-b from-emerald-500 to-emerald-700";
  if (state === "failed") return "border-rose-300/90 bg-gradient-to-b from-rose-400 to-red-600 shadow-[0_0_14px_rgba(244,63,94,0.45)]";
  if (state === "cancelled") return "border-amber-300/90 bg-gradient-to-b from-amber-300 to-amber-500";
  return "border-zinc-600 bg-gradient-to-b from-zinc-700 to-zinc-800 opacity-75";
}

function stepBlockSheenClass(state: PlannerVisualState): string {
  if (state === "running") return "bg-white/35";
  if (state === "completed") return "bg-white/18";
  if (state === "failed") return "bg-white/20";
  if (state === "cancelled") return "bg-white/22";
  return "bg-white/10";
}

function supportsWebGl(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export function AnalysisPlannerRuntimeBridge({
  runtimeStatus,
  planTotalSegments,
  planCompletedSegments,
  parsedSegmentCount = 0,
  language,
  className,
  compact = false,
}: AnalysisPlannerRuntimeBridgeProps) {
  const [forceFallback2D, setForceFallback2D] = React.useState(false);
  const webGlAvailable = React.useMemo(() => supportsWebGl(), []);
  const handleThreeUnavailable = React.useCallback(() => {
    setForceFallback2D(true);
  }, []);

  const totalSegments = React.useMemo(() => {
    const fromRuntime = runtimeStatus?.totalSegments || 0;
    return Math.max(
      0,
      Math.floor(planTotalSegments || 0),
      Math.floor(fromRuntime),
      Math.floor(parsedSegmentCount || 0),
    );
  }, [planTotalSegments, parsedSegmentCount, runtimeStatus?.totalSegments]);

  const normalizedRuntime = React.useMemo(() => {
    if (runtimeStatus) {
      return buildPlannerRuntimeState({
        ...runtimeStatus,
        runId:
          typeof runtimeStatus.runId === "string" && runtimeStatus.runId.trim().length > 0
            ? runtimeStatus.runId
            : createPlannerRunId("analysis_bridge"),
        segmentIndex:
          typeof runtimeStatus.segmentIndex === "number"
            ? runtimeStatus.segmentIndex
            : planCompletedSegments,
        totalSegments: totalSegments > 0 ? totalSegments : runtimeStatus.totalSegments,
      });
    }

    const inferredStage = totalSegments > 0 ? "segment_running" : "planning";
    return buildPlannerRuntimeState({
      stage: inferredStage,
      runId: createPlannerRunId("analysis_bridge"),
      segmentIndex: planCompletedSegments,
      totalSegments,
      stageLabel: inferredStage === "planning" ? "Planning" : undefined,
    });
  }, [runtimeStatus, totalSegments, planCompletedSegments, language]);

  const graph = React.useMemo(() => {
    return buildDefaultPlannerGraph(totalSegments, language);
  }, [totalSegments, language]);
  const progressPercent = React.useMemo(
    () => Math.max(0, Math.min(100, Math.round(normalizedRuntime.progressPercent))),
    [normalizedRuntime.progressPercent],
  );
  const segmentDetailTitle = React.useMemo(
    () =>
      typeof normalizedRuntime.activeSegmentTitle === "string"
        ? normalizedRuntime.activeSegmentTitle.trim()
        : "",
    [normalizedRuntime.activeSegmentTitle],
  );
  const canUseSegmentDetail = React.useMemo(
    () =>
      segmentDetailTitle.length > 0 &&
      (normalizedRuntime.stage === "segment_running" ||
        normalizedRuntime.stage === "animation_generating" ||
        normalizedRuntime.stage === "tag_generating"),
    [segmentDetailTitle, normalizedRuntime.stage],
  );
  const currentStepLabel = React.useMemo(() => {
    if (canUseSegmentDetail) {
      return segmentDetailTitle;
    }
    if (typeof normalizedRuntime.stageLabel === "string" && normalizedRuntime.stageLabel.trim().length > 0) {
      return normalizedRuntime.stageLabel.trim();
    }
    return getMacroStageLabel(normalizedRuntime.stage, language);
  }, [
    canUseSegmentDetail,
    language,
    segmentDetailTitle,
    normalizedRuntime.stage,
    normalizedRuntime.stageLabel,
  ]);
  const progressWord = language === "zh" ? "当前进度：" : "Progress:";
  const progressBarClass = React.useMemo(() => {
    if (normalizedRuntime.stage === "failed") {
      return "bg-gradient-to-r from-red-500 to-orange-400";
    }
    if (normalizedRuntime.stage === "cancelled") {
      return "bg-gradient-to-r from-amber-500 to-yellow-400";
    }
    return "bg-gradient-to-r from-emerald-500 to-cyan-400";
  }, [normalizedRuntime.stage]);
  const progressPercentTextClass = React.useMemo(() => {
    if (normalizedRuntime.stage === "failed") {
      return "text-red-300";
    }
    if (normalizedRuntime.stage === "cancelled") {
      return "text-amber-300";
    }
    return "text-zinc-200";
  }, [normalizedRuntime.stage]);

  const stageFlow = React.useMemo(() => {
    return MACRO_STAGE_SEQUENCE.map((stage) => ({
      stage,
      label:
        stage === "segment_running" && canUseSegmentDetail
          ? segmentDetailTitle
          : getMacroStageLabel(stage, language),
      state: getMacroStageVisualState(stage, normalizedRuntime),
    }));
  }, [language, normalizedRuntime, canUseSegmentDetail, segmentDetailTitle]);

  const shouldUseThree = webGlAvailable && !forceFallback2D;

  const plannerBody = shouldUseThree ? (
    <ThreeAnalysisPlanner
      className="h-full w-full"
      graph={graph}
      mode="square"
      runtimeState={normalizedRuntime}
      language={language}
      onUnavailable={handleThreeUnavailable}
    />
  ) : (
    <AnalysisPlannerFallback2D
      className="h-full w-full"
      graph={graph}
      mode="square"
      runtimeState={normalizedRuntime}
      language={language}
    />
  );

  return (
    <div className={className || ""}>
      <div
        className={`rounded-xl border border-white/10 bg-zinc-950/80 backdrop-blur-sm transition-all duration-200 ${
          compact ? "px-2.5 py-2" : "px-3 py-3"
        }`}
      >
        {compact ? (
          <div className="min-w-0 rounded-lg border border-white/5 bg-zinc-900/45 px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] sm:text-[14px] font-semibold text-zinc-100" title={currentStepLabel}>
                {currentStepLabel}
              </span>
              <span className={`shrink-0 text-[13px] sm:text-[14px] font-mono font-semibold ${progressPercentTextClass}`}>
                {progressPercent}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-[width] duration-300 ${progressBarClass}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
            <div className="min-w-0 rounded-lg border border-white/5 bg-zinc-900/40 px-2 py-1.5">
              <div className="-mt-1 mb-1.5 flex items-center gap-2">
                <span className="shrink-0 text-[12px] sm:text-[13px] font-mono font-semibold tracking-wide text-zinc-200">{progressWord}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] sm:text-[14px] font-semibold text-zinc-100" title={currentStepLabel}>
                  {currentStepLabel}
                </span>
                <span className={`shrink-0 text-[13px] sm:text-[14px] font-mono font-semibold ${progressPercentTextClass}`}>
                  {progressPercent}%
                </span>
              </div>
              <div className="mb-1.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-300 ${progressBarClass}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-1 flex items-center gap-2 overflow-x-auto hide-scrollbar py-0.5">
                {stageFlow.map((item) => {
                  const isRunning = item.state === "running";
                  return (
                    <div key={item.stage} className="shrink-0 inline-flex items-center gap-1.5">
                      <div
                        className={`relative overflow-hidden rounded-[5px] border transition-[border-color,background-color,box-shadow,transform] duration-300 ${stepBlockClass(item.state)} ${isRunning ? "planner-step-active" : ""}`}
                        style={{
                          width: "14px",
                          height: "14px",
                          transformStyle: "preserve-3d",
                        }}
                      >
                        <span className={`pointer-events-none absolute inset-x-0 top-0 h-[35%] rounded-t-[5px] ${stepBlockSheenClass(item.state)}`} />
                      </div>
                      <div
                        className={`text-[10px] leading-tight whitespace-nowrap ${
                          isRunning ? "text-cyan-200 font-semibold" : "text-zinc-500"
                        }`}
                        title={item.label}
                      >
                        {item.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 shrink-0 rounded-lg border border-white/10 bg-zinc-900/40 overflow-hidden">
              {plannerBody}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes plannerStepJumpFlip {
          0% { transform: translateY(0) rotateY(0deg) scale(1); }
          20% { transform: translateY(-4px) rotateY(0deg) scale(1.04); }
          45% { transform: translateY(-1px) rotateY(125deg) scale(1.07); }
          70% { transform: translateY(-4px) rotateY(260deg) scale(1.03); }
          100% { transform: translateY(0) rotateY(360deg) scale(1); }
        }
        @keyframes plannerActiveShimmer {
          0% { left: -45%; opacity: 0; }
          20% { opacity: 0.65; }
          80% { opacity: 0.65; }
          100% { left: 115%; opacity: 0; }
        }
        .planner-step-active {
          animation: plannerStepJumpFlip 1s cubic-bezier(.25,.8,.25,1) infinite;
          box-shadow: 0 0 16px rgba(52, 211, 153, 0.75);
        }
        .planner-step-active::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          width: 38%;
          background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.42), rgba(255,255,255,0));
          transform: skewX(-15deg);
          animation: plannerActiveShimmer 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
