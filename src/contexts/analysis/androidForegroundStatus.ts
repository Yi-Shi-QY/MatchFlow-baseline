import type { ActiveAnalysis } from './types';

export interface AndroidForegroundServicePayload {
  title: string;
  text: string;
  useWakeLock: boolean;
  dedupeKey: string;
}

function toSafeString(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback;
  const normalized = input.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function deriveProgress(activeAnalysis: ActiveAnalysis): {
  completed: number;
  total: number;
  progressPercent: number;
} {
  const runtimeTotal =
    typeof activeAnalysis.runtimeStatus?.totalSegments === 'number'
      ? Math.max(0, Math.floor(activeAnalysis.runtimeStatus.totalSegments))
      : 0;
  const runtimeCompleted =
    typeof activeAnalysis.runtimeStatus?.segmentIndex === 'number'
      ? Math.max(0, Math.floor(activeAnalysis.runtimeStatus.segmentIndex))
      : 0;
  const completedFromParsed = Array.isArray(activeAnalysis.parsedStream?.segments)
    ? activeAnalysis.parsedStream.segments.filter((segment) => segment.isThoughtComplete).length
    : 0;

  const total = Math.max(
    1,
    activeAnalysis.planTotalSegments,
    runtimeTotal,
    activeAnalysis.planCompletedSegments,
    runtimeCompleted,
    completedFromParsed,
  );
  const completed = Math.min(
    total,
    Math.max(activeAnalysis.planCompletedSegments, runtimeCompleted, completedFromParsed),
  );
  const progressPercent = Math.min(99, Math.floor((completed / total) * 100));
  return {
    completed,
    total,
    progressPercent,
  };
}

export function buildAndroidForegroundServicePayload(
  activeAnalyses: Record<string, ActiveAnalysis>,
): AndroidForegroundServicePayload | null {
  const analyzing = Object.values(activeAnalyses).filter((analysis) => analysis.isAnalyzing);
  if (analyzing.length === 0) return null;

  const primary = analyzing[0];
  const progress = deriveProgress(primary);
  const currentStage = toSafeString(primary.runtimeStatus?.stageLabel, 'Processing');
  const primaryMatchLabel = `${toSafeString(primary.match.homeTeam?.name, 'Home')} vs ${toSafeString(
    primary.match.awayTeam?.name,
    'Away',
  )}`;
  const additionalCount = Math.max(0, analyzing.length - 1);
  const lines = [
    primaryMatchLabel,
    `Progress ${progress.completed}/${progress.total} (${progress.progressPercent}%)`,
    `Stage: ${currentStage}`,
    additionalCount > 0 ? `+${additionalCount} more tasks in progress` : '',
  ].filter((line) => line.length > 0);
  const text = lines.join('\n');
  const title = `MatchFlow analysis running (${analyzing.length})`;
  const dedupeKey = [
    primary.matchId,
    progress.completed,
    progress.total,
    currentStage,
    additionalCount,
  ].join('|');

  return {
    title,
    text,
    useWakeLock: true,
    dedupeKey,
  };
}
