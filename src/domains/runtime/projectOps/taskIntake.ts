import type { RuntimeTaskIntakeCapability, RuntimeTaskIntakeValue } from '@/src/domains/runtime/types';
import { searchProjectOpsLocalCases } from '@/src/services/domains/modules/projectOps/localCases';
import { PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE } from './workflowType';

type ProjectOpsFocusDimension =
  | 'delivery_status'
  | 'risk_blockers'
  | 'resource_owner'
  | 'coordination';

type ProjectOpsTimeHorizon = 'immediate' | 'this_week' | 'this_month' | 'next_milestone';

interface ProjectOpsTargetSubjectValue {
  subjectId: string;
  label: string;
  subjectType: string;
}

const PROJECT_OPS_DIMENSIONS: Array<{
  id: ProjectOpsFocusDimension;
  zh: string;
  en: string;
  aliases: string[];
}> = [
  {
    id: 'delivery_status',
    zh: '进度与里程碑',
    en: 'Delivery and milestones',
    aliases: ['delivery', 'timeline', 'milestone', 'launch', 'rollout', 'progress', '进度', '里程碑', '上线', '发布'],
  },
  {
    id: 'risk_blockers',
    zh: '风险与阻塞',
    en: 'Risk and blockers',
    aliases: ['risk', 'blocker', 'issue', 'dependency', '风险', '阻塞', '问题', '依赖'],
  },
  {
    id: 'resource_owner',
    zh: '资源与负责人',
    en: 'Resources and owners',
    aliases: ['owner', 'resource', 'capacity', 'staffing', '负责人', '资源', '人手'],
  },
  {
    id: 'coordination',
    zh: '协同与交接',
    en: 'Coordination and handoff',
    aliases: ['coordination', 'handoff', 'review', 'sync', 'cross team', '协同', '交接', '评审', '对齐'],
  },
];

const PROJECT_OPS_HORIZONS: Array<{
  id: ProjectOpsTimeHorizon;
  zh: string;
  en: string;
  aliases: string[];
}> = [
  {
    id: 'immediate',
    zh: '当前窗口',
    en: 'Immediate window',
    aliases: ['today', 'now', 'immediate', '当前', '现在', '马上'],
  },
  {
    id: 'this_week',
    zh: '本周',
    en: 'This week',
    aliases: ['this week', 'week', '本周', '这周'],
  },
  {
    id: 'this_month',
    zh: '本月',
    en: 'This month',
    aliases: ['this month', 'month', '本月', '这个月'],
  },
  {
    id: 'next_milestone',
    zh: '下个里程碑',
    en: 'Next milestone',
    aliases: ['next milestone', '下个里程碑', '下一节点'],
  },
];

function getFocusDimensions(value: RuntimeTaskIntakeValue | undefined): ProjectOpsFocusDimension[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is ProjectOpsFocusDimension =>
          entry === 'delivery_status' ||
          entry === 'risk_blockers' ||
          entry === 'resource_owner' ||
          entry === 'coordination',
      )
    : [];
}

function getTargetSubject(value: RuntimeTaskIntakeValue | undefined): ProjectOpsTargetSubjectValue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.subjectId === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.subjectType === 'string'
    ? {
        subjectId: candidate.subjectId,
        label: candidate.label,
        subjectType: candidate.subjectType,
      }
    : null;
}

function getTimeHorizon(value: RuntimeTaskIntakeValue | undefined): ProjectOpsTimeHorizon | null {
  return value === 'immediate' ||
    value === 'this_week' ||
    value === 'this_month' ||
    value === 'next_milestone'
    ? value
    : null;
}

function formatDimensionLabels(
  language: 'zh' | 'en',
  value: ProjectOpsFocusDimension[],
): string {
  const labels = PROJECT_OPS_DIMENSIONS.filter((item) => value.includes(item.id)).map((item) =>
    language === 'zh' ? item.zh : item.en,
  );
  return labels.join(language === 'zh' ? '、' : ', ');
}

function formatTimeHorizon(language: 'zh' | 'en', value: ProjectOpsTimeHorizon | null): string {
  if (!value) {
    return '';
  }

  const match = PROJECT_OPS_HORIZONS.find((item) => item.id === value);
  return match ? (language === 'zh' ? match.zh : match.en) : '';
}

function parseFocusDimensions(input: string): ProjectOpsFocusDimension[] | null {
  const normalized = input.toLowerCase();
  if (/(default|默认|全部|都看|都要)/i.test(normalized)) {
    return PROJECT_OPS_DIMENSIONS.map((item) => item.id);
  }

  const matched = PROJECT_OPS_DIMENSIONS.filter((item) =>
    item.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
  ).map((item) => item.id);

  return matched.length > 0 ? Array.from(new Set(matched)) : null;
}

function parseDecisionGoal(input: string): string | null {
  const normalized = input.trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(
    /(建议|决策|判断|下一步|优先级|recommendation|decision|next action|priority)(.+)$/i,
  );
  return match?.[0]?.trim() || null;
}

function parseTimeHorizon(input: string): ProjectOpsTimeHorizon | null {
  const normalized = input.toLowerCase();
  const match = PROJECT_OPS_HORIZONS.find((item) =>
    item.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
  );
  return match?.id || null;
}

function buildRecognizedLines(input: {
  language: 'zh' | 'en';
  target: ProjectOpsTargetSubjectValue | null;
  dimensions: ProjectOpsFocusDimension[];
  decisionGoal: string;
  timeHorizon: ProjectOpsTimeHorizon | null;
}): string[] {
  const lines: string[] = [];

  if (input.target) {
    lines.push(
      input.language === 'zh'
        ? `已识别分析对象：${input.target.label}。`
        : `Recognized subject: ${input.target.label}.`,
    );
  }
  if (input.dimensions.length > 0) {
    lines.push(
      input.language === 'zh'
        ? `已识别重点方向：${formatDimensionLabels(input.language, input.dimensions)}。`
        : `Recognized focus areas: ${formatDimensionLabels(input.language, input.dimensions)}.`,
    );
  }
  if (input.decisionGoal.trim().length > 0) {
    lines.push(
      input.language === 'zh'
        ? `已识别输出目标：${input.decisionGoal}。`
        : `Recognized decision goal: ${input.decisionGoal}.`,
    );
  }
  if (input.timeHorizon) {
    lines.push(
      input.language === 'zh'
        ? `已识别时间窗口：${formatTimeHorizon(input.language, input.timeHorizon)}。`
        : `Recognized time horizon: ${formatTimeHorizon(input.language, input.timeHorizon)}.`,
    );
  }

  return lines;
}

function buildDefaultFocusPrompt(language: 'zh' | 'en'): string {
  return language === 'zh'
    ? '先告诉我这次优先看哪些方面。可直接回复：进度与里程碑、风险与阻塞、资源与负责人、协同与交接，或者说“默认”。'
    : 'Tell me which areas to prioritize. You can reply with delivery and milestones, risk and blockers, resources and owners, coordination and handoff, or simply say "default".';
}

export const projectOpsTaskIntakeCapability: RuntimeTaskIntakeCapability = {
  definition: {
    workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
    title: {
      zh: 'Project Ops 分析任务采集',
      en: 'Project Ops analysis intake',
    },
    slots: [
      {
        slotId: 'target_subject',
        label: {
          zh: '分析对象',
          en: 'Subject',
        },
        required: true,
        valueType: 'entity',
        stepId: 'target_subject',
      },
      {
        slotId: 'focus_dimensions',
        label: {
          zh: '关注方向',
          en: 'Focus areas',
        },
        required: true,
        valueType: 'list',
        stepId: 'focus_dimensions',
      },
      {
        slotId: 'decision_goal',
        label: {
          zh: '输出目标',
          en: 'Decision goal',
        },
        required: false,
        valueType: 'string',
        stepId: 'decision_goal',
      },
      {
        slotId: 'time_horizon',
        label: {
          zh: '时间窗口',
          en: 'Time horizon',
        },
        required: false,
        valueType: 'enum',
        stepId: 'time_horizon',
      },
    ],
    steps: [
      {
        stepId: 'target_subject',
        title: {
          zh: '确认分析对象',
          en: 'Choose the subject',
        },
        slotIds: ['target_subject'],
      },
      {
        stepId: 'focus_dimensions',
        title: {
          zh: '确认关注方向',
          en: 'Choose focus areas',
        },
        slotIds: ['focus_dimensions'],
      },
      {
        stepId: 'decision_goal',
        title: {
          zh: '补充输出目标',
          en: 'Clarify the decision goal',
        },
        slotIds: ['decision_goal'],
      },
      {
        stepId: 'time_horizon',
        title: {
          zh: '补充时间窗口',
          en: 'Clarify the time horizon',
        },
        slotIds: ['time_horizon'],
      },
    ],
  },
  parseInput(input) {
    const matchedSubjects = searchProjectOpsLocalCases(input.input);
    const parsedFocusDimensions = parseFocusDimensions(input.input);
    const parsedDecisionGoal = parseDecisionGoal(input.input);
    const parsedTimeHorizon = parseTimeHorizon(input.input);
    const nextValues: Record<string, RuntimeTaskIntakeValue> = {};
    const recognizedSlotIds: string[] = [];

    if (matchedSubjects.length > 0) {
      nextValues.target_subject = {
        subjectId: matchedSubjects[0].id,
        label: matchedSubjects[0].title,
        subjectType: matchedSubjects[0].subjectType,
      };
      recognizedSlotIds.push('target_subject');
    }

    if (
      parsedFocusDimensions &&
      (input.activeStepId === 'focus_dimensions' ||
        /(focus|priority|dimension|area|重点|关注|维度|方面|默认)/i.test(input.input))
    ) {
      nextValues.focus_dimensions = parsedFocusDimensions;
      recognizedSlotIds.push('focus_dimensions');
    }

    if (
      parsedDecisionGoal &&
      (input.activeStepId === 'decision_goal' ||
        /(建议|决策|判断|下一步|recommendation|decision|next action|priority)/i.test(input.input))
    ) {
      nextValues.decision_goal = parsedDecisionGoal;
      recognizedSlotIds.push('decision_goal');
    }

    if (
      parsedTimeHorizon &&
      (input.activeStepId === 'time_horizon' ||
        /(today|week|month|milestone|当前|本周|本月|里程碑)/i.test(input.input))
    ) {
      nextValues.time_horizon = parsedTimeHorizon;
      recognizedSlotIds.push('time_horizon');
    }

    return {
      slotValues: nextValues,
      recognizedSlotIds,
    };
  },
  buildPrompt(input) {
    const target = getTargetSubject(input.slotValues.target_subject);
    const dimensions = getFocusDimensions(input.slotValues.focus_dimensions);
    const decisionGoal =
      typeof input.slotValues.decision_goal === 'string' ? input.slotValues.decision_goal : '';
    const timeHorizon = getTimeHorizon(input.slotValues.time_horizon);
    const recognizedLines = buildRecognizedLines({
      language: input.language,
      target,
      dimensions,
      decisionGoal,
      timeHorizon,
    });

    if (input.activeStepId === 'target_subject') {
      return {
        title: input.language === 'zh' ? '确认分析对象' : 'Choose the subject',
        body: [
          ...recognizedLines,
          input.language === 'zh'
            ? '先告诉我要分析哪个项目、任务或专项。'
            : 'Tell me which project, task, or initiative you want to analyze.',
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n'),
      };
    }

    if (input.activeStepId === 'focus_dimensions') {
      return {
        title: input.language === 'zh' ? '确认关注方向' : 'Choose focus areas',
        body: [
          ...recognizedLines,
          input.language === 'zh'
            ? '在我生成正式任务前，还需要确认这次重点看哪些运营维度。'
            : 'Before I create the real task, I still need to know which operating dimensions to prioritize.',
          buildDefaultFocusPrompt(input.language),
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n'),
      };
    }

    if (input.activeStepId === 'decision_goal') {
      return {
        title: input.language === 'zh' ? '补充输出目标' : 'Clarify the decision goal',
        body: [
          ...recognizedLines,
          input.language === 'zh'
            ? '如果你希望我更偏向某类输出，也可以补充这次想拿到的是风险判断、推进建议、资源取舍还是优先级建议。'
            : 'If you want a more specific output, tell me whether you need a risk readout, next-step recommendation, resource trade-off, or priority guidance.',
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n'),
      };
    }

    if (input.activeStepId === 'time_horizon') {
      return {
        title: input.language === 'zh' ? '补充时间窗口' : 'Clarify the time horizon',
        body: [
          ...recognizedLines,
          input.language === 'zh'
            ? '如果这次判断有明确时间窗口，也可以告诉我是当前窗口、本周、本月还是下个里程碑。'
            : 'If this analysis should target a specific time horizon, tell me whether it is for the immediate window, this week, this month, or the next milestone.',
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n'),
      };
    }

    return {
      title: input.language === 'zh' ? 'Project Ops 分析档案已确认' : 'Project Ops intake confirmed',
      body:
        input.language === 'zh'
          ? '分析对象和关注方向都已确认。'
          : 'The subject and focus areas are confirmed.',
    };
  },
  finalizeDrafts(input) {
    return input.drafts.map((draft) => ({ ...draft }));
  },
  describeTopic(input) {
    if (input.topic === 'help') {
      return input.language === 'zh'
        ? '直接描述你要分析的项目、任务或专项，以及希望什么时候执行。我会先确认分析对象和关注方向，再创建任务卡片。'
        : 'Describe the project, task, or initiative you want to analyze and when it should run. I will confirm the subject and focus areas before creating task cards.';
    }
    if (input.topic === 'factors') {
      return input.language === 'zh'
        ? 'Project Ops 当前支持的关注方向包括：进度与里程碑、风险与阻塞、资源与负责人、协同与交接。你也可以直接说“默认”，我会按通用运营复盘顺序推进。'
        : 'Project Ops currently supports these focus areas: delivery and milestones, risk and blockers, resources and owners, coordination and handoff. You can also say "default" and I will use the standard operating review flow.';
    }
    if (input.topic === 'sequence') {
      return input.language === 'zh'
        ? 'Project Ops 的默认分析顺序是：先看对象与上下文，再看风险和阻塞，最后给推进建议。'
        : 'The default Project Ops review order is context first, then risks and blockers, then the next-step recommendation.';
    }
    return null;
  },
};
