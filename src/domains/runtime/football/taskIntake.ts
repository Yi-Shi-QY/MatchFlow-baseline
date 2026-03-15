import type { RuntimeTaskIntakeCapability, RuntimeTaskIntakeValue } from '@/src/domains/runtime/types';
import {
  applyAnalysisProfileToDrafts,
  buildFactorsFollowUp,
  buildSequenceFollowUp,
  describeAvailableFactors,
  describeDefaultSequence,
  formatManagerSequencePreference,
  formatManagerSourcePreferences,
  parseSequencePreference,
  parseSourcePreferenceIds,
} from '@/src/services/manager-legacy/analysisProfile';
import type {
  ManagerSequenceStepId,
  ManagerSourcePreferenceId,
} from '@/src/services/manager/types';
import { FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE } from './workflowType';

const DEFAULT_FOOTBALL_SOURCE_IDS: ManagerSourcePreferenceId[] = [
  'fundamental',
  'market',
  'custom',
];

function getSourceIds(value: RuntimeTaskIntakeValue | undefined): ManagerSourcePreferenceId[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is ManagerSourcePreferenceId =>
          entry === 'fundamental' || entry === 'market' || entry === 'custom',
      )
    : [];
}

function getSequence(value: RuntimeTaskIntakeValue | undefined): ManagerSequenceStepId[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is ManagerSequenceStepId =>
          entry === 'fundamental' ||
          entry === 'market' ||
          entry === 'custom' ||
          entry === 'prediction',
      )
    : [];
}

function hasSequenceCue(answer: string): boolean {
  return /(first|then|before|after|order|sequence|last|finally|先|后|後|再|然后|最后|順序|顺序|排序|默认顺序|default order)/i.test(
    answer,
  );
}

function hasFactorCue(answer: string): boolean {
  return /(factor|priorit|focus on|consider|all|因素|重点|优先|关注|都要|都看)/i.test(answer);
}

function extractSequenceSegment(answer: string): string {
  const match = answer.match(/(then|before|after|order|sequence|finally|然后|最后|順序|顺序|排序)/i);
  if (!match || typeof match.index !== 'number') {
    return answer;
  }

  return answer.slice(match.index);
}

function buildRecognizedLines(input: {
  language: 'zh' | 'en';
  selectedSourceIds: ManagerSourcePreferenceId[];
  sequencePreference: ManagerSequenceStepId[];
}): string[] {
  const lines: string[] = [];
  if (input.selectedSourceIds.length > 0) {
    lines.push(
      input.language === 'zh'
        ? `已识别重点因素：${formatManagerSourcePreferences(input.language, input.selectedSourceIds)}。`
        : `Recognized factors: ${formatManagerSourcePreferences(input.language, input.selectedSourceIds)}.`,
    );
  }

  if (input.sequencePreference.length > 0) {
    lines.push(
      input.language === 'zh'
        ? `已识别分析顺序：${formatManagerSequencePreference(input.language, input.sequencePreference)}。`
        : `Recognized analysis order: ${formatManagerSequencePreference(input.language, input.sequencePreference)}.`,
    );
  }

  return lines;
}

export const footballTaskIntakeCapability: RuntimeTaskIntakeCapability = {
  definition: {
    workflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
    title: {
      zh: '足球分析任务采集',
      en: 'Football analysis intake',
    },
    slots: [
      {
        slotId: 'analysis_dimensions',
        label: {
          zh: '分析因素',
          en: 'Analysis factors',
        },
        required: true,
        valueType: 'list',
        stepId: 'analysis_dimensions',
      },
      {
        slotId: 'analysis_sequence',
        label: {
          zh: '分析顺序',
          en: 'Analysis order',
        },
        required: true,
        valueType: 'list',
        stepId: 'analysis_sequence',
      },
    ],
    steps: [
      {
        stepId: 'analysis_dimensions',
        title: {
          zh: '确认分析因素',
          en: 'Choose analysis factors',
        },
        slotIds: ['analysis_dimensions'],
      },
      {
        stepId: 'analysis_sequence',
        title: {
          zh: '确认分析顺序',
          en: 'Choose analysis order',
        },
        slotIds: ['analysis_sequence'],
      },
    ],
  },
  parseInput(input) {
    const factorCue = hasFactorCue(input.input);
    const sequenceCue = hasSequenceCue(input.input);
    const defaultCue = /(default|默认)/i.test(input.input);
    const parsedFactors = parseSourcePreferenceIds(input.input);
    const parsedSequence = parseSequencePreference(
      factorCue && sequenceCue ? extractSequenceSegment(input.input) : input.input,
    );
    const nextValues: Record<string, RuntimeTaskIntakeValue> = {};
    const recognizedSlotIds: string[] = [];
    const currentSources = getSourceIds(input.slotValues.analysis_dimensions);

    const shouldUseParsedFactors =
      Boolean(parsedFactors) &&
      (
        factorCue ||
        (!sequenceCue && input.activeStepId === 'analysis_dimensions') ||
        (defaultCue && input.activeStepId === 'analysis_dimensions')
      );
    const shouldUseParsedSequence =
      Boolean(parsedSequence) &&
      (sequenceCue || (input.activeStepId === 'analysis_sequence' && (!parsedFactors || defaultCue)));

    if (shouldUseParsedFactors && parsedFactors) {
      nextValues.analysis_dimensions = [...parsedFactors];
      recognizedSlotIds.push('analysis_dimensions');
    }

    if (shouldUseParsedSequence && parsedSequence) {
      nextValues.analysis_sequence = [...parsedSequence];
      recognizedSlotIds.push('analysis_sequence');
    }

    return {
      slotValues: nextValues,
      recognizedSlotIds,
      metadata:
        currentSources.length > 0 || recognizedSlotIds.length > 0
          ? {
              selectedSourceIds:
                recognizedSlotIds.includes('analysis_dimensions') && parsedFactors
                  ? [...parsedFactors]
                  : currentSources,
            }
          : undefined,
    };
  },
  buildPrompt(input) {
    const selectedSourceIds = getSourceIds(input.slotValues.analysis_dimensions);
    const sequencePreference = getSequence(input.slotValues.analysis_sequence);
    const recognizedLines = buildRecognizedLines({
      language: input.language,
      selectedSourceIds,
      sequencePreference,
    });

    if (input.activeStepId === 'analysis_sequence') {
      const sourceIds =
        selectedSourceIds.length > 0 ? selectedSourceIds : DEFAULT_FOOTBALL_SOURCE_IDS;
      return {
        title: input.language === 'zh' ? '确认分析顺序' : 'Choose analysis order',
        body: [
          ...recognizedLines,
          input.language === 'zh'
            ? '在我生成正式任务前，还需要确认分析顺序。'
            : 'Before I create the real task, I still need the analysis order.',
          buildSequenceFollowUp(input.language, sourceIds),
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n'),
      };
    }

    if (input.activeStepId === 'analysis_dimensions') {
      return {
        title: input.language === 'zh' ? '确认分析因素' : 'Choose analysis factors',
        body: [
          ...recognizedLines,
          input.language === 'zh'
            ? '在我生成正式任务前，还需要知道这次优先看的分析因素。'
            : 'Before I create the real task, I still need to know which factors to prioritize.',
          buildFactorsFollowUp(input.language),
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n'),
      };
    }

    return {
      title: input.language === 'zh' ? '分析档案已确认' : 'Analysis profile confirmed',
      body:
        input.language === 'zh'
          ? '分析因素和分析顺序都已确认。'
          : 'The analysis factors and order are confirmed.',
    };
  },
  finalizeDrafts(input) {
    const selectedSourceIds = getSourceIds(input.slotValues.analysis_dimensions);
    const sequencePreference = getSequence(input.slotValues.analysis_sequence);
    if (selectedSourceIds.length === 0 || sequencePreference.length === 0) {
      return input.drafts.map((draft) => ({ ...draft }));
    }

    return applyAnalysisProfileToDrafts(input.drafts, {
      selectedSourceIds,
      sequencePreference,
    });
  },
  describeTopic(input) {
    if (input.topic === 'help') {
      return input.language === 'zh'
        ? '你可以直接告诉我要分析哪场比赛、哪个联赛，以及什么时候执行。我会先确认分析因素和顺序，再创建任务卡片。'
        : 'Tell me which match or league to analyze and when to run it. I will confirm the analysis factors and order before creating task cards.';
    }
    if (input.topic === 'factors') {
      return describeAvailableFactors(input.language);
    }
    if (input.topic === 'sequence') {
      return describeDefaultSequence(input.language);
    }
    return null;
  },
};
