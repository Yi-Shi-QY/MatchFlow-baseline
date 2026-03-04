import React from "react";
import { useTranslation } from "react-i18next";
import {
  buildPlannerRuntimeState,
  createPlannerRunId,
  type PlannerRuntimeState,
} from "@/src/services/planner/runtime";
import { getPlannerStageI18nKey } from "@/src/services/planner/stageI18n";
import {
  buildPlannerGraphForDomain,
  mapPlannerRuntimeForDomain,
} from "@/src/services/planner/adapters/registry";
import { AnalysisPlannerFallback2D } from "./AnalysisPlannerFallback2D";
import { ThreeAnalysisPlanner, type PlannerUnavailableReason } from "./ThreeAnalysisPlanner";
import {
  getMacroStageVisualState,
  MACRO_STAGE_SEQUENCE,
  type PlannerLanguage,
} from "./model";

interface AnalysisPlannerRuntimeBridgeProps {
  domainId?: string | null;
  planSegments?: unknown[];
  runtimeStatus: PlannerRuntimeState | null;
  planTotalSegments: number;
  planCompletedSegments: number;
  parsedSegmentCount?: number;
  language: PlannerLanguage;
  className?: string;
  compact?: boolean;
}

interface PlannerRenderBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  resetKey?: string;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface PlannerRenderBoundaryState {
  hasError: boolean;
}

type PlannerVisualState = "pending" | "running" | "completed" | "failed" | "cancelled";

class PlannerRenderBoundary extends React.Component<
  PlannerRenderBoundaryProps,
  PlannerRenderBoundaryState
> {
  state: PlannerRenderBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PlannerRenderBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: PlannerRenderBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

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

function buildFallbackSegments(totalSegments: number): unknown[] {
  const safeTotal = Math.max(0, Math.floor(totalSegments));
  return Array.from({ length: safeTotal }, () => ({}));
}

export function AnalysisPlannerRuntimeBridge({
  domainId,
  planSegments = [],
  runtimeStatus,
  planTotalSegments,
  planCompletedSegments,
  parsedSegmentCount = 0,
  language,
  className,
  compact = false,
}: AnalysisPlannerRuntimeBridgeProps) {
  const { t } = useTranslation();
  const [forceFallback2D, setForceFallback2D] = React.useState(false);
  const [fallbackReason, setFallbackReason] = React.useState<PlannerUnavailableReason | "render" | null>(null);

  const webGlAvailable = React.useMemo(() => supportsWebGl(), []);
  const handleThreeUnavailable = React.useCallback((reason?: PlannerUnavailableReason) => {
    setForceFallback2D(true);
    setFallbackReason(reason || "runtime");
  }, []);

  const handleThreeRenderError = React.useCallback(
    (error: Error) => {
      console.error("Three planner render boundary fallback", error);
      setForceFallback2D(true);
      setFallbackReason("render");
    },
    [],
  );

  const handleFallbackRenderError = React.useCallback((error: Error) => {
    console.error("Planner 2D fallback render failed", error);
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
        source: runtimeStatus.source || "bridge",
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
      source: "bridge",
    });
  }, [runtimeStatus, totalSegments, planCompletedSegments]);

  const adaptedRuntime = React.useMemo(() => {
    return mapPlannerRuntimeForDomain(domainId, normalizedRuntime);
  }, [domainId, normalizedRuntime]);

  const effectivePlanSegments = React.useMemo(() => {
    if (Array.isArray(planSegments) && planSegments.length > 0) {
      return planSegments;
    }
    return buildFallbackSegments(totalSegments);
  }, [planSegments, totalSegments]);

  const graph = React.useMemo(() => {
    return buildPlannerGraphForDomain(domainId, effectivePlanSegments, language);
  }, [domainId, effectivePlanSegments, language]);

  const progressPercent = React.useMemo(
    () => Math.max(0, Math.min(100, Math.round(adaptedRuntime.progressPercent))),
    [adaptedRuntime.progressPercent],
  );
  const segmentDetailTitle = React.useMemo(
    () =>
      typeof adaptedRuntime.activeSegmentTitle === "string"
        ? adaptedRuntime.activeSegmentTitle.trim()
        : "",
    [adaptedRuntime.activeSegmentTitle],
  );
  const canUseSegmentDetail = React.useMemo(
    () =>
      segmentDetailTitle.length > 0 &&
      (adaptedRuntime.stage === "segment_running" ||
        adaptedRuntime.stage === "animation_generating" ||
        adaptedRuntime.stage === "tag_generating"),
    [segmentDetailTitle, adaptedRuntime.stage],
  );

  const currentStepLabel = React.useMemo(() => {
    if (canUseSegmentDetail) {
      return segmentDetailTitle;
    }
    if (typeof adaptedRuntime.stageLabel === "string" && adaptedRuntime.stageLabel.trim().length > 0) {
      return adaptedRuntime.stageLabel.trim();
    }
    return t(getPlannerStageI18nKey(adaptedRuntime.stage));
  }, [canUseSegmentDetail, segmentDetailTitle, adaptedRuntime.stage, adaptedRuntime.stageLabel, t]);

  const progressWord = t("match.planner_progress_label");
  const progressBarClass = React.useMemo(() => {
    if (adaptedRuntime.stage === "failed") {
      return "bg-gradient-to-r from-red-500 to-orange-400";
    }
    if (adaptedRuntime.stage === "cancelled") {
      return "bg-gradient-to-r from-amber-500 to-yellow-400";
    }
    return "bg-gradient-to-r from-emerald-500 to-cyan-400";
  }, [adaptedRuntime.stage]);
  const progressPercentTextClass = React.useMemo(() => {
    if (adaptedRuntime.stage === "failed") {
      return "text-red-300";
    }
    if (adaptedRuntime.stage === "cancelled") {
      return "text-amber-300";
    }
    return "text-zinc-200";
  }, [adaptedRuntime.stage]);

  const stageFlow = React.useMemo(() => {
    return MACRO_STAGE_SEQUENCE.map((stage) => ({
      stage,
      label:
        stage === "segment_running" && canUseSegmentDetail
          ? segmentDetailTitle
          : t(getPlannerStageI18nKey(stage)),
      state: getMacroStageVisualState(stage, adaptedRuntime),
    }));
  }, [adaptedRuntime, canUseSegmentDetail, segmentDetailTitle, t]);

  const fallbackHint = React.useMemo(() => {
    if (!forceFallback2D) return "";
    if (fallbackReason === "performance") return t("match.planner_fallback_performance");
    if (fallbackReason === "init") return t("match.planner_fallback_init");
    if (fallbackReason === "runtime" || fallbackReason === "render") {
      return t("match.planner_fallback_runtime");
    }
    return "";
  }, [forceFallback2D, fallbackReason, t]);

  const shouldUseThree = webGlAvailable && !forceFallback2D;
  const fallback2dNode = (
    <AnalysisPlannerFallback2D
      className="h-full w-full"
      graph={graph}
      mode="square"
      runtimeState={adaptedRuntime}
      language={language}
    />
  );

  const fallbackErrorNode = (
    <div className="h-full w-full flex items-center justify-center px-2 text-center text-[10px] text-red-300">
      {t("match.planner_render_failed")}
    </div>
  );

  const plannerBody = shouldUseThree ? (
    <PlannerRenderBoundary
      fallback={fallback2dNode}
      resetKey={`three:${adaptedRuntime.runId}:${adaptedRuntime.stage}:${language}:${graph.nodes.length}:${graph.edges.length}:${Number(forceFallback2D)}`}
      onError={(error) => handleThreeRenderError(error)}
    >
      <ThreeAnalysisPlanner
        className="h-full w-full"
        graph={graph}
        mode="square"
        runtimeState={adaptedRuntime}
        language={language}
        onUnavailable={handleThreeUnavailable}
      />
    </PlannerRenderBoundary>
  ) : (
    <PlannerRenderBoundary
      fallback={fallbackErrorNode}
      resetKey={`fallback2d:${adaptedRuntime.runId}:${adaptedRuntime.stage}:${language}:${graph.nodes.length}:${graph.edges.length}`}
      onError={(error) => handleFallbackRenderError(error)}
    >
      {fallback2dNode}
    </PlannerRenderBoundary>
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
        {fallbackHint && (
          <div className="mt-2 text-[10px] leading-tight text-amber-200/90">
            {fallbackHint}
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
