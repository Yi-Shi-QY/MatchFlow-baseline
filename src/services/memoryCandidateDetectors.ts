import type {
  AutomationJob,
  AutomationRun,
} from '@/src/services/automation/types';
import {
  getAutomationTargetSelectorCollectionKey,
  getAutomationTargetSelectorLabel,
} from '@/src/services/automation/targetSelector';
import {
  parseSequencePreference,
  parseSourcePreferenceIds,
} from '@/src/services/manager-legacy/analysisProfile';
import type {
  MemoryCandidateDetectionMode,
  MemoryCandidateInput,
} from './memoryCandidateTypes';

interface DetectMemoryCandidatesFromManagerInput {
  text: string;
  domainId: string;
  detectionMode?: MemoryCandidateDetectionMode;
  recentUserMessages?: string[];
}

interface DetectMemoryCandidatesFromAutomationResultInput {
  job: AutomationJob;
  run: AutomationRun;
  historicalJobs?: AutomationJob[];
}

const DEFAULT_ANALYSIS_FACTORS: Array<'fundamental' | 'market' | 'custom'> = [
  'fundamental',
  'market',
  'custom',
];
const DEFAULT_ANALYSIS_SEQUENCE: Array<
  'fundamental' | 'market' | 'custom' | 'prediction'
> = ['fundamental', 'market', 'custom', 'prediction'];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hasExplicitPreferenceSignal(input: string): boolean {
  return /(prefer|priority|priorit(?:ize|ise)|focus on|default to|use .* by default|我更喜欢|我喜欢|优先|重点看|默认)/i.test(
    input,
  );
}

function hasSequenceSignal(input: string): boolean {
  return /(first|second|third|then|before|after|last|followed by|order|先|后|然后|最后|顺序)/i.test(
    input,
  );
}

function hasConstraintSignal(input: string): boolean {
  return /(do not|don't|never|avoid|must not|without|不要|别|不能|避免)/i.test(input);
}

function formatSourceLabel(id: 'fundamental' | 'market' | 'custom'): string {
  if (id === 'fundamental') {
    return 'fundamentals';
  }
  if (id === 'market') {
    return 'market signals';
  }
  return 'custom notes';
}

function formatSequenceLabel(id: 'fundamental' | 'market' | 'custom' | 'prediction'): string {
  if (id === 'prediction') {
    return 'final prediction';
  }
  return formatSourceLabel(id);
}

function buildFactorCandidate(args: {
  text: string;
  domainId: string;
}): MemoryCandidateInput | null {
  const selected = parseSourcePreferenceIds(args.text);
  if (!selected || selected.length === 0) {
    return null;
  }

  return {
    sourceKind: 'explicit_preference',
    origin: 'manager_turn',
    scopeType: 'domain',
    scopeId: args.domainId,
    memoryType: 'preference',
    keyText: 'analysis-factors',
    title: 'Analysis factor preference',
    contentText: `Prioritize ${selected.map(formatSourceLabel).join(', ')}.`,
    reasoning: 'User explicitly stated which analysis factors to prioritize.',
    evidence: [args.text],
  };
}

function buildSequenceCandidate(args: {
  text: string;
  domainId: string;
}): MemoryCandidateInput | null {
  const sequence = parseSequencePreference(args.text);
  if (!sequence || sequence.length === 0) {
    return null;
  }

  return {
    sourceKind: 'explicit_preference',
    origin: 'manager_turn',
    scopeType: 'domain',
    scopeId: args.domainId,
    memoryType: 'preference',
    keyText: 'analysis-sequence',
    title: 'Analysis sequence preference',
    contentText: `Use the order ${sequence.map(formatSequenceLabel).join(' -> ')}.`,
    reasoning: 'User explicitly stated a preferred analysis order.',
    evidence: [args.text],
  };
}

function buildConstraintCandidate(args: {
  text: string;
  domainId: string;
}): MemoryCandidateInput | null {
  if (!hasConstraintSignal(args.text)) {
    return null;
  }

  const analysisScoped =
    Boolean(parseSourcePreferenceIds(args.text)) ||
    /(analysis|market|fundamental|custom|prediction|factor|sequence|赔率|盘口|基础面|顺序|分析)/i.test(
      args.text,
    );

  return {
    sourceKind: 'explicit_constraint',
    origin: 'manager_turn',
    scopeType: analysisScoped ? 'domain' : 'global',
    scopeId: analysisScoped ? args.domainId : 'global',
    memoryType: 'constraint',
    keyText: analysisScoped ? 'analysis-constraint' : 'response-constraint',
    title: analysisScoped ? 'Analysis constraint' : 'Response constraint',
    contentText: args.text.trim(),
    reasoning: 'User explicitly stated what to avoid or forbid.',
    evidence: [args.text],
  };
}

function buildStableHabitCandidate(args: {
  text: string;
  domainId: string;
  recentUserMessages: string[];
}): MemoryCandidateInput | null {
  const currentSequence = parseSequencePreference(args.text);
  if (!currentSequence || currentSequence.length === 0) {
    return null;
  }

  const normalizedSequence = currentSequence.join('>');
  const repeatedCount = [args.text, ...args.recentUserMessages].filter((message) => {
    const sequence = parseSequencePreference(message);
    return Array.isArray(sequence) && sequence.join('>') === normalizedSequence;
  }).length;

  if (repeatedCount < 2) {
    return null;
  }

  return {
    sourceKind: 'stable_habit',
    origin: 'manager_turn',
    scopeType: 'domain',
    scopeId: args.domainId,
    memoryType: 'habit',
    keyText: 'analysis-sequence-habit',
    title: 'Stable analysis sequence habit',
    contentText: `Usually use the order ${currentSequence
      .map(formatSequenceLabel)
      .join(' -> ')}.`,
    reasoning: 'The same analysis sequence preference appeared repeatedly across user turns.',
    evidence: [args.text, ...args.recentUserMessages].slice(0, 3),
  };
}

function dedupeCandidates(candidates: MemoryCandidateInput[]): MemoryCandidateInput[] {
  const seen = new Set<string>();
  const deduped: MemoryCandidateInput[] = [];

  for (const candidate of candidates) {
    const key = [
      candidate.scopeType,
      normalizeText(candidate.scopeId),
      normalizeText(candidate.memoryType),
      normalizeText(candidate.keyText),
      normalizeText(candidate.contentText),
    ].join('::');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

export function detectMemoryCandidatesFromManagerInput(
  input: DetectMemoryCandidatesFromManagerInput,
): MemoryCandidateInput[] {
  const normalized = input.text.trim();
  if (!normalized) {
    return [];
  }

  const detectionMode = input.detectionMode || 'freeform';
  const candidates: MemoryCandidateInput[] = [];
  const shouldDetectFactors =
    detectionMode === 'analysis_factors' ||
    detectionMode === 'analysis_profile' ||
    hasExplicitPreferenceSignal(normalized);
  const shouldDetectSequence =
    detectionMode === 'analysis_sequence' ||
    (detectionMode === 'analysis_profile' && hasSequenceSignal(normalized)) ||
    (detectionMode === 'freeform' &&
      hasExplicitPreferenceSignal(normalized) &&
      hasSequenceSignal(normalized));

  if (shouldDetectFactors) {
    const factorCandidate = buildFactorCandidate({
      text: normalized,
      domainId: input.domainId,
    });
    if (factorCandidate) {
      candidates.push(factorCandidate);
    }
  }

  if (shouldDetectSequence) {
    const sequenceCandidate = buildSequenceCandidate({
      text: normalized,
      domainId: input.domainId,
    });
    if (sequenceCandidate) {
      candidates.push(sequenceCandidate);
    }
  }

  const constraintCandidate = buildConstraintCandidate({
    text: normalized,
    domainId: input.domainId,
  });
  if (constraintCandidate) {
    candidates.push(constraintCandidate);
  }

  const stableHabitCandidate = buildStableHabitCandidate({
    text: normalized,
    domainId: input.domainId,
    recentUserMessages: input.recentUserMessages || [],
  });
  if (stableHabitCandidate) {
    candidates.push(stableHabitCandidate);
  }

  return dedupeCandidates(candidates);
}

function isRecurringAutomationJob(job: AutomationJob): boolean {
  return job.triggerType === 'schedule' || Boolean(job.sourceRuleId);
}

function isDefaultFactorPreference(
  selectedSourceIds: AutomationJob['analysisProfile'] extends infer T
    ? T extends { selectedSourceIds: infer U }
      ? U
      : never
    : never,
): boolean {
  if (!Array.isArray(selectedSourceIds) || selectedSourceIds.length !== DEFAULT_ANALYSIS_FACTORS.length) {
    return false;
  }

  return DEFAULT_ANALYSIS_FACTORS.every((id) => selectedSourceIds.includes(id));
}

function isDefaultSequencePreference(
  sequencePreference: AutomationJob['analysisProfile'] extends infer T
    ? T extends { sequencePreference: infer U }
      ? U
      : never
    : never,
): boolean {
  if (!Array.isArray(sequencePreference) || sequencePreference.length !== DEFAULT_ANALYSIS_SEQUENCE.length) {
    return false;
  }

  return DEFAULT_ANALYSIS_SEQUENCE.every((id, index) => sequencePreference[index] === id);
}

function buildAutomationFactorCandidate(job: AutomationJob): MemoryCandidateInput | null {
  const selectedSourceIds = job.analysisProfile?.selectedSourceIds;
  if (
    !isRecurringAutomationJob(job) ||
    !Array.isArray(selectedSourceIds) ||
    selectedSourceIds.length === 0 ||
    isDefaultFactorPreference(selectedSourceIds)
  ) {
    return null;
  }

  return {
    sourceKind: 'explicit_preference',
    origin: 'automation_result',
    scopeType: 'domain',
    scopeId: job.domainId,
    memoryType: 'preference',
    keyText: 'analysis-factors',
    title: 'Recurring automation factor preference',
    contentText: `Recurring automation usually prioritizes ${selectedSourceIds
      .map(formatSourceLabel)
      .join(', ')}.`,
    reasoning: 'A recurring automation was explicitly configured to emphasize specific analysis factors.',
    evidence: [job.title],
  };
}

function buildAutomationSequenceCandidate(job: AutomationJob): MemoryCandidateInput | null {
  const sequencePreference = job.analysisProfile?.sequencePreference;
  if (
    !isRecurringAutomationJob(job) ||
    !Array.isArray(sequencePreference) ||
    sequencePreference.length === 0 ||
    isDefaultSequencePreference(sequencePreference)
  ) {
    return null;
  }

  return {
    sourceKind: 'explicit_preference',
    origin: 'automation_result',
    scopeType: 'domain',
    scopeId: job.domainId,
    memoryType: 'preference',
    keyText: 'analysis-sequence',
    title: 'Recurring automation sequence preference',
    contentText: `Recurring automation usually uses the order ${sequencePreference
      .map(formatSequenceLabel)
      .join(' -> ')}.`,
    reasoning: 'A recurring automation was explicitly configured with a non-default analysis order.',
    evidence: [job.title],
  };
}

function buildAutomationTargetFocusHabitCandidate(
  input: DetectMemoryCandidatesFromAutomationResultInput,
): MemoryCandidateInput | null {
  const { job } = input;
  const collectionKey = getAutomationTargetSelectorCollectionKey(job.targetSelector);
  const targetLabel = getAutomationTargetSelectorLabel(job.targetSelector);
  if (!isRecurringAutomationJob(job) || !collectionKey || !targetLabel) {
    return null;
  }

  const matchingJobs = [job, ...(input.historicalJobs || [])].filter(
    (candidate) =>
      candidate.domainId === job.domainId &&
      isRecurringAutomationJob(candidate) &&
      getAutomationTargetSelectorCollectionKey(candidate.targetSelector) === collectionKey,
  );
  const uniqueMatches = Array.from(new Map(matchingJobs.map((entry) => [entry.id, entry])).values());
  if (uniqueMatches.length < 2) {
    return null;
  }

  return {
    sourceKind: 'stable_habit',
    origin: 'automation_result',
    scopeType: 'domain',
    scopeId: job.domainId,
    memoryType: 'habit',
    keyText: 'automation-league-focus-habit',
    title: 'Stable automation league focus',
    contentText: `Recurring automation often focuses on ${targetLabel}.`,
    reasoning: 'The same recurring automation setup for this target appeared multiple times.',
    evidence: uniqueMatches.map((entry) => entry.title).slice(0, 3),
  };
}

export function detectMemoryCandidatesFromAutomationResult(
  input: DetectMemoryCandidatesFromAutomationResultInput,
): MemoryCandidateInput[] {
  if (input.run.state !== 'completed') {
    return [];
  }

  const candidates: MemoryCandidateInput[] = [];
  const factorCandidate = buildAutomationFactorCandidate(input.job);
  if (factorCandidate) {
    candidates.push(factorCandidate);
  }

  const sequenceCandidate = buildAutomationSequenceCandidate(input.job);
  if (sequenceCandidate) {
    candidates.push(sequenceCandidate);
  }

  const leagueHabitCandidate = buildAutomationTargetFocusHabitCandidate(input);
  if (leagueHabitCandidate) {
    candidates.push(leagueHabitCandidate);
  }

  return dedupeCandidates(candidates);
}
