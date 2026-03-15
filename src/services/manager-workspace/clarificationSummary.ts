import {
  buildFactorsFollowUp,
  buildSequenceFollowUp,
  formatManagerSequencePreference,
  formatManagerSourcePreferences,
  parseSequencePreference,
  parseSourcePreferenceIds,
} from '@/src/services/manager-legacy/analysisProfile';
import type {
  ManagerClarificationField,
  ManagerClarificationSnapshot,
  ManagerLanguage,
  ManagerPendingTask,
  ManagerSequenceStepId,
  ManagerSourcePreferenceId,
} from '@/src/services/manager/types';

export interface ManagerClarificationSummary {
  selectedSourceIds: ManagerSourcePreferenceId[];
  sequencePreference: ManagerSequenceStepId[] | null;
  recognized: {
    factors: ManagerSourcePreferenceId[];
    sequence: ManagerSequenceStepId[] | null;
  };
  missing: ManagerClarificationField[];
  nextStage: ManagerPendingTask['stage'] | null;
  isComplete: boolean;
}

function cloneSourceIds(
  value: readonly ManagerSourcePreferenceId[] | undefined,
): ManagerSourcePreferenceId[] {
  return Array.isArray(value) ? [...value] : [];
}

function cloneSequence(
  value: readonly ManagerSequenceStepId[] | undefined,
): ManagerSequenceStepId[] | null {
  return Array.isArray(value) && value.length > 0 ? [...value] : null;
}

function hasSequenceCue(answer: string): boolean {
  return /(first|then|before|after|order|sequence|last|finally|先|后|後|再|然后|最後|最后|顺序|排序|默认顺序|default order)/i.test(
    answer,
  );
}

function hasFactorCue(answer: string): boolean {
  return /(factor|priorit|focus on|consider|all|因素|重点|优先|关注|都要|都看)/i.test(
    answer,
  );
}

function extractSequenceSegment(answer: string): string {
  const match = answer.match(/(then|before|after|order|sequence|finally|再|然后|最後|最后|顺序|排序)/i);
  if (!match || typeof match.index !== 'number') {
    return answer;
  }
  return answer.slice(match.index);
}

export function summarizeManagerClarification(input: {
  pendingTask?: Pick<ManagerPendingTask, 'selectedSourceIds' | 'sequencePreference' | 'stage'> | null;
  answer: string;
}): ManagerClarificationSummary {
  const existingFactors = cloneSourceIds(input.pendingTask?.selectedSourceIds);
  const existingSequence = cloneSequence(input.pendingTask?.sequencePreference);
  const currentStage = input.pendingTask?.stage || 'await_factors';
  const factorCue = hasFactorCue(input.answer);
  const sequenceCue = hasSequenceCue(input.answer);
  const defaultCue = /(default|默认)/i.test(input.answer);
  const parsedFactors = parseSourcePreferenceIds(input.answer) as ManagerSourcePreferenceId[] | null;
  const parsedSequence = parseSequencePreference(
    factorCue && sequenceCue ? extractSequenceSegment(input.answer) : input.answer,
  ) as ManagerSequenceStepId[] | null;
  const shouldUseParsedFactors =
    Boolean(parsedFactors) &&
    (factorCue || (!sequenceCue && currentStage === 'await_factors') || (defaultCue && currentStage === 'await_factors'));
  const shouldUseParsedSequence =
    Boolean(parsedSequence) &&
    (
      sequenceCue ||
      (currentStage === 'await_sequence' && (!parsedFactors || defaultCue))
    );
  const selectedSourceIds =
    existingFactors.length > 0
      ? existingFactors
      : shouldUseParsedFactors
        ? parsedFactors || []
        : [];
  const sequencePreference = existingSequence || (shouldUseParsedSequence ? parsedSequence : null);
  const missing: ManagerClarificationField[] = [];

  if (selectedSourceIds.length === 0) {
    missing.push('factors');
  }
  if (!sequencePreference || sequencePreference.length === 0) {
    missing.push('sequence');
  }

  return {
    selectedSourceIds,
    sequencePreference,
    recognized: {
      factors: [...selectedSourceIds],
      sequence: sequencePreference ? [...sequencePreference] : null,
    },
    missing,
    nextStage:
      missing[0] === 'factors'
        ? 'await_factors'
        : missing[0] === 'sequence'
          ? 'await_sequence'
          : null,
    isComplete: missing.length === 0,
  };
}

export function toManagerClarificationSnapshot(
  summary: ManagerClarificationSummary,
): ManagerClarificationSnapshot {
  return {
    recognizedSourceIds: [...summary.recognized.factors],
    recognizedSequence: summary.recognized.sequence
      ? [...summary.recognized.sequence]
      : null,
    missingFields: [...summary.missing],
  };
}

function buildRecognizedLines(
  language: ManagerLanguage,
  summary: ManagerClarificationSummary,
): string[] {
  const lines: string[] = [];

  if (summary.recognized.factors.length > 0) {
    lines.push(
      language === 'zh'
        ? `已识别重点因素：${formatManagerSourcePreferences(language, summary.recognized.factors)}。`
        : `Recognized factors: ${formatManagerSourcePreferences(language, summary.recognized.factors)}.`,
    );
  }

  if (summary.recognized.sequence && summary.recognized.sequence.length > 0) {
    lines.push(
      language === 'zh'
        ? `已识别分析顺序：${formatManagerSequencePreference(language, summary.recognized.sequence)}。`
        : `Recognized analysis order: ${formatManagerSequencePreference(language, summary.recognized.sequence)}.`,
    );
  }

  return lines;
}

export function buildManagerClarificationFollowUp(input: {
  language: ManagerLanguage;
  summary: ManagerClarificationSummary;
}): string {
  const { language, summary } = input;
  const recognizedLines = buildRecognizedLines(language, summary);

  if (summary.nextStage === 'await_factors') {
    const missingLead =
      language === 'zh'
        ? '在我生成正式任务前，还需要知道这次优先看的分析因素。'
        : 'Before I create the real task, I still need to know which factors to prioritize.';
    return [...recognizedLines, missingLead, buildFactorsFollowUp(language)]
      .filter((line) => line.trim().length > 0)
      .join('\n\n');
  }

  if (summary.nextStage === 'await_sequence') {
    const missingLead =
      language === 'zh'
        ? '在我生成正式任务前，还需要确认分析顺序。'
        : 'Before I create the real task, I still need the analysis order.';
    const sourceIds =
      summary.selectedSourceIds.length > 0
        ? summary.selectedSourceIds
        : (['fundamental', 'market', 'custom'] as ManagerSourcePreferenceId[]);
    return [...recognizedLines, missingLead, buildSequenceFollowUp(language, sourceIds)]
      .filter((line) => line.trim().length > 0)
      .join('\n\n');
  }

  return recognizedLines.join('\n\n');
}
