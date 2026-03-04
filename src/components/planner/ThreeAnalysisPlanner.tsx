import React from "react";
import { useTranslation } from "react-i18next";
import type { PlannerGraph, PlannerRuntimeState, PlannerStage } from "@/src/services/planner/runtime";
import {
  type PlannerLanguage,
  MACRO_STAGE_SEQUENCE,
  getMacroStageVisualState,
  getSegmentVisualState,
} from "./model";

const FPS_SAMPLE_WINDOW_MS = 2000;
const FPS_MIN_THRESHOLD = 22;
const FPS_LOW_WINDOW_LIMIT = 3;

export type PlannerUnavailableReason = "init" | "runtime" | "performance";

interface ThreeAnalysisPlannerProps {
  graph: PlannerGraph;
  runtimeState: PlannerRuntimeState;
  language: PlannerLanguage;
  className?: string;
  onUnavailable?: (reason?: PlannerUnavailableReason) => void;
  mode?: "default" | "square";
}

interface StageNodeRef {
  stage: PlannerStage;
  mesh: any;
  material: any;
}

interface SegmentNodeRef {
  segmentIndex: number;
  mesh: any;
  material: any;
}

function parseStageId(nodeId: string): PlannerStage | null {
  if (!nodeId.startsWith("stage:")) return null;
  return nodeId.slice("stage:".length) as PlannerStage;
}

function parseSegmentId(nodeId: string): number {
  if (!nodeId.startsWith("segment:")) return -1;
  return Number(nodeId.slice("segment:".length));
}

function colorByVisualState(state: "pending" | "running" | "completed" | "failed" | "cancelled"): number {
  if (state === "running") return 0x22d3ee;
  if (state === "completed") return 0x10b981;
  if (state === "failed") return 0xfb7185;
  if (state === "cancelled") return 0xfbbf24;
  return 0x52525b;
}

export function ThreeAnalysisPlanner({
  graph,
  runtimeState,
  language,
  className,
  onUnavailable,
  mode = "default",
}: ThreeAnalysisPlannerProps) {
  const { t } = useTranslation();
  const isSquare = mode === "square";
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = React.useRef(runtimeState);
  const onUnavailableRef = React.useRef(onUnavailable);
  const unavailableNotifiedRef = React.useRef(false);
  const [isReady, setIsReady] = React.useState(false);

  runtimeRef.current = runtimeState;
  onUnavailableRef.current = onUnavailable;

  const graphSignature = React.useMemo(() => {
    const nodeSig = graph.nodes.map((n) => `${n.id}:${n.kind}`).join("|");
    const edgeSig = graph.edges.map((e) => `${e.from}->${e.to}`).join("|");
    return `${nodeSig}__${edgeSig}`;
  }, [graph]);

  React.useEffect(() => {
    let disposed = false;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let visibilityHandler: (() => void) | null = null;
    let isPageVisible = document.visibilityState === "visible";
    let fpsWindowStartedAt = 0;
    let fpsWindowFrameCount = 0;
    let lowFpsWindowCount = 0;

    const notifyUnavailable = (reason: PlannerUnavailableReason) => {
      if (disposed || unavailableNotifiedRef.current) return;
      unavailableNotifiedRef.current = true;
      onUnavailableRef.current?.(reason);
    };

    const initialize = async () => {
      try {
        const THREE: any = await import("three");
        if (disposed || !canvasRef.current || !containerRef.current) return;

        const container = containerRef.current;
        const canvas = canvasRef.current;
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
        camera.position.set(0, 0, isSquare ? 5.8 : 7.6);

        const rootGroup = new THREE.Group();
        scene.add(rootGroup);

        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const point = new THREE.PointLight(0x22d3ee, 1.15, 24);
        point.position.set(0, 0, 7);
        scene.add(ambient);
        scene.add(point);

        const stageNodes: StageNodeRef[] = [];
        const segmentNodes: SegmentNodeRef[] = [];
        const nodePositionMap = new Map<string, any>();

        const macroNodes = graph.nodes
          .filter((node) => node.kind === "stage")
          .sort((a, b) => {
            const aStage = parseStageId(a.id);
            const bStage = parseStageId(b.id);
            const aRank = aStage ? MACRO_STAGE_SEQUENCE.indexOf(aStage) : 0;
            const bRank = bStage ? MACRO_STAGE_SEQUENCE.indexOf(bStage) : 0;
            return aRank - bRank;
          });

        const segmentGraphNodes = graph.nodes
          .filter((node) => node.kind === "segment")
          .sort((a, b) => parseSegmentId(a.id) - parseSegmentId(b.id));

        macroNodes.forEach((node, idx) => {
          const stage = parseStageId(node.id);
          if (!stage) return;
          const angle = (idx / Math.max(1, macroNodes.length)) * Math.PI * 2 - Math.PI / 2;
          const macroRadius = isSquare ? 1.55 : 2.15;
          const x = Math.cos(angle) * macroRadius;
          const y = Math.sin(angle) * macroRadius;
          const geometry = new THREE.SphereGeometry(0.12, 24, 24);
          const material = new THREE.MeshStandardMaterial({
            color: 0x52525b,
            emissive: 0x0,
            roughness: 0.38,
            metalness: 0.2,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x, y, 0);
          rootGroup.add(mesh);
          nodePositionMap.set(node.id, new THREE.Vector3(x, y, 0));
          stageNodes.push({ stage, mesh, material });
        });

        segmentGraphNodes.forEach((node, idx) => {
          const angle = (idx / Math.max(1, segmentGraphNodes.length)) * Math.PI * 2 - Math.PI / 2;
          const segmentRadius = isSquare ? 0.95 : 1.25;
          const x = Math.cos(angle) * segmentRadius;
          const y = Math.sin(angle) * segmentRadius;
          const geometry = new THREE.SphereGeometry(0.09, 20, 20);
          const material = new THREE.MeshStandardMaterial({
            color: 0x52525b,
            emissive: 0x0,
            roughness: 0.44,
            metalness: 0.16,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x, y, 0);
          rootGroup.add(mesh);
          nodePositionMap.set(node.id, new THREE.Vector3(x, y, 0));
          segmentNodes.push({ segmentIndex: idx, mesh, material });
        });

        graph.edges.forEach((edge) => {
          const from = nodePositionMap.get(edge.from);
          const to = nodePositionMap.get(edge.to);
          if (!from || !to) return;
          const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
          const material = new THREE.LineBasicMaterial({
            color: 0x334155,
            transparent: true,
            opacity: 0.5,
          });
          const line = new THREE.Line(geometry, material);
          rootGroup.add(line);
        });

        const activeBeamMaterial = new THREE.LineBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0.85,
        });
        const activeBeamGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0),
        ]);
        const activeBeam = new THREE.Line(activeBeamGeometry, activeBeamMaterial);
        rootGroup.add(activeBeam);

        const updateBeam = (state: PlannerRuntimeState) => {
          const totalSegments = Math.max(state.totalSegments, segmentNodes.length);
          if (
            totalSegments <= 0 ||
            !(
              state.stage === "segment_running" ||
              state.stage === "animation_generating" ||
              state.stage === "tag_generating"
            )
          ) {
            activeBeam.visible = false;
            return;
          }

          const activeIndex = Math.max(0, Math.min(totalSegments - 1, Math.floor(state.segmentIndex)));
          const angle = (activeIndex / Math.max(1, totalSegments)) * Math.PI * 2 - Math.PI / 2;
          const beamRadius = isSquare ? 0.95 : 1.25;
          const target = new THREE.Vector3(Math.cos(angle) * beamRadius, Math.sin(angle) * beamRadius, 0);
          activeBeamGeometry.setFromPoints([new THREE.Vector3(0, 0, 0), target]);
          activeBeamGeometry.attributes.position.needsUpdate = true;
          activeBeam.visible = true;
        };

        const updateScene = (now: number) => {
          const state = runtimeRef.current;
          const pulse = 1 + Math.sin(now * 0.004) * 0.18;
          const totalSegments = Math.max(state.totalSegments, segmentNodes.length);

          stageNodes.forEach((node) => {
            const visualState = getMacroStageVisualState(node.stage, state);
            node.material.color.setHex(colorByVisualState(visualState));
            node.material.emissive.setHex(
              visualState === "running"
                ? 0x0e7490
                : visualState === "failed"
                  ? 0x9f1239
                  : visualState === "cancelled"
                    ? 0x78350f
                    : 0x0,
            );
            const targetScale = visualState === "running" ? pulse : 1;
            node.mesh.scale.setScalar(targetScale);
          });

          segmentNodes.forEach((node) => {
            const visualState = getSegmentVisualState(node.segmentIndex, state, totalSegments);
            node.material.color.setHex(colorByVisualState(visualState));
            node.material.emissive.setHex(
              visualState === "running"
                ? 0x0e7490
                : visualState === "failed"
                  ? 0x9f1239
                  : visualState === "cancelled"
                    ? 0x78350f
                    : 0x0,
            );
            const targetScale = visualState === "running" ? pulse : 1;
            node.mesh.scale.setScalar(targetScale);
          });

          updateBeam(state);

          if (state.stage === "failed") {
            rootGroup.rotation.z = 0;
          } else {
            rootGroup.rotation.z += 0.0022;
          }
        };

        const tick = (now: number) => {
          if (disposed) return;
          animationFrame = window.requestAnimationFrame(tick);
          if (!isPageVisible) return;

          try {
            updateScene(now);
            renderer.render(scene, camera);
          } catch (error) {
            console.error("Three planner runtime render failed", error);
            notifyUnavailable("runtime");
            return;
          }

          if (fpsWindowStartedAt <= 0) {
            fpsWindowStartedAt = now;
            fpsWindowFrameCount = 0;
          }
          fpsWindowFrameCount += 1;

          const elapsedMs = now - fpsWindowStartedAt;
          if (elapsedMs < FPS_SAMPLE_WINDOW_MS) {
            return;
          }

          const sampledFps = elapsedMs > 0 ? (fpsWindowFrameCount * 1000) / elapsedMs : 0;
          if (sampledFps < FPS_MIN_THRESHOLD) {
            lowFpsWindowCount += 1;
          } else {
            lowFpsWindowCount = 0;
          }

          fpsWindowStartedAt = now;
          fpsWindowFrameCount = 0;
          if (lowFpsWindowCount >= FPS_LOW_WINDOW_LIMIT) {
            notifyUnavailable("performance");
          }
        };

        const resize = () => {
          if (disposed || !containerRef.current) return;
          const w = Math.max(1, containerRef.current.clientWidth);
          const h = Math.max(1, containerRef.current.clientHeight);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(container);
        } else {
          window.addEventListener("resize", resize);
        }

        visibilityHandler = () => {
          isPageVisible = document.visibilityState === "visible";
          if (isPageVisible) {
            fpsWindowStartedAt = 0;
            fpsWindowFrameCount = 0;
            lowFpsWindowCount = 0;
          }
        };
        document.addEventListener("visibilitychange", visibilityHandler);

        setIsReady(true);
        animationFrame = window.requestAnimationFrame(tick);

        const cleanup = () => {
          window.cancelAnimationFrame(animationFrame);
          if (resizeObserver) {
            resizeObserver.disconnect();
          } else {
            window.removeEventListener("resize", resize);
          }
          if (visibilityHandler) {
            document.removeEventListener("visibilitychange", visibilityHandler);
          }
          scene.traverse((obj: any) => {
            if (obj.geometry && typeof obj.geometry.dispose === "function") {
              obj.geometry.dispose();
            }
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach((m: any) => m?.dispose?.());
              } else {
                obj.material.dispose?.();
              }
            }
          });
          renderer.dispose();
        };

        if (disposed) {
          cleanup();
          return;
        }

        return cleanup;
      } catch (error) {
        console.error("Three planner init failed", error);
        notifyUnavailable("init");
        return undefined;
      }
    };

    let cleanupFn: (() => void) | undefined;
    initialize().then((cleanup) => {
      cleanupFn = cleanup;
    });

    return () => {
      disposed = true;
      if (cleanupFn) cleanupFn();
    };
  }, [graphSignature, isSquare, language]);

  return (
    <div className={className || ""}>
      <div
        ref={containerRef}
        className={`relative rounded-xl border border-white/10 bg-zinc-950/80 overflow-hidden ${isSquare ? "h-full w-full" : "h-44"}`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-zinc-400 animate-pulse">
            {t("match.planner_3d_loading", { lng: language })}
          </div>
        )}
      </div>
    </div>
  );
}
