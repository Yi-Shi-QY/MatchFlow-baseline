import type {
  ConclusionCardEntry,
  MatchAnalysis,
  OutcomeDistributionEntry,
} from "./ai";

export interface SummaryDistributionItem {
  id: string;
  label: string;
  value: number; // normalized 0-100
  color?: string;
}

export interface SummaryDistributionLabels {
  homeLabel?: string;
  drawLabel?: string;
  awayLabel?: string;
}

function toFiniteNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeLabel(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim();
}

function normalizeDistributionEntries(
  entries: OutcomeDistributionEntry[],
): SummaryDistributionItem[] {
  const cleaned = entries
    .map<SummaryDistributionItem | null>((entry, index) => {
      const label = normalizeLabel(entry?.label);
      const rawValue = toFiniteNumber(entry?.value);
      if (!label || rawValue == null || rawValue < 0) return null;
      return {
        id: `${label}_${index}`,
        label,
        value: rawValue,
        color: typeof entry?.color === "string" && entry.color.trim() ? entry.color.trim() : undefined,
      };
    })
    .filter((item): item is SummaryDistributionItem => !!item)
    .slice(0, 5);

  if (cleaned.length === 0) return [];
  const total = cleaned.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];

  // Keep relative weights and normalize to 100 for predictable UI bars.
  return cleaned.map((item) => ({
    ...item,
    value: Number(((item.value / total) * 100).toFixed(1)),
  }));
}

export function getAnalysisOutcomeDistribution(
  analysis: MatchAnalysis | null | undefined,
  labels?: SummaryDistributionLabels,
): SummaryDistributionItem[] {
  if (!analysis) return [];

  if (Array.isArray(analysis.outcomeDistribution) && analysis.outcomeDistribution.length > 0) {
    const normalized = normalizeDistributionEntries(analysis.outcomeDistribution);
    if (normalized.length > 0) return normalized;
  }

  const winProbability = analysis.winProbability;
  if (!winProbability) return [];

  const homeValue = toFiniteNumber(winProbability.home);
  const drawValue = toFiniteNumber(winProbability.draw);
  const awayValue = toFiniteNumber(winProbability.away);
  if (homeValue == null || drawValue == null || awayValue == null) return [];

  return normalizeDistributionEntries([
    { label: labels?.homeLabel || "Home", value: homeValue },
    { label: labels?.drawLabel || "Draw", value: drawValue },
    { label: labels?.awayLabel || "Away", value: awayValue },
  ]);
}

export function getAnalysisConclusionCards(
  analysis: MatchAnalysis | null | undefined,
): ConclusionCardEntry[] {
  if (!analysis || !Array.isArray(analysis.conclusionCards)) return [];

  return analysis.conclusionCards
    .map((card) => {
      const label = normalizeLabel(card?.label);
      const value = card?.value;
      if (!label || (typeof value !== "string" && typeof value !== "number")) return null;

      const confidence = toFiniteNumber(card?.confidence);
      const trend =
        card?.trend === "up" || card?.trend === "down" || card?.trend === "neutral"
          ? card.trend
          : undefined;

      return {
        label,
        value: typeof value === "string" ? value.trim() : value,
        unit: typeof card?.unit === "string" ? card.unit.trim() : undefined,
        note: typeof card?.note === "string" ? card.note.trim() : undefined,
        confidence:
          confidence == null ? undefined : Math.max(0, Math.min(100, Number(confidence.toFixed(1)))),
        trend,
      } as ConclusionCardEntry;
    })
    .filter((card): card is ConclusionCardEntry => !!card)
    .slice(0, 4);
}

export function formatConclusionCardValue(card: ConclusionCardEntry): string {
  const baseValue =
    typeof card.value === "number"
      ? Number.isInteger(card.value)
        ? String(card.value)
        : Number(card.value.toFixed(2)).toString()
      : card.value;
  return card.unit ? `${baseValue}${card.unit}` : baseValue;
}
