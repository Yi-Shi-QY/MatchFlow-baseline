import type { ContextFragment } from '@/src/domains/runtime/types';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';

export interface CommandCenterDebugMetric {
  id: string;
  label: string;
  value: string;
}

export interface CommandCenterDebugFragment {
  id: string;
  category: ContextFragment['category'];
  categoryLabel: string;
  priority: number;
  text: string;
  metadataLines: string[];
}

export interface CommandCenterDebugModel {
  assembledAt: number;
  assembledAtLabel: string;
  title: string;
  subtitle: string;
  metrics: CommandCenterDebugMetric[];
  fragments: CommandCenterDebugFragment[];
}

function formatTimestamp(timestamp: number, language: 'zh' | 'en'): string {
  try {
    return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return String(timestamp);
  }
}

function getCategoryLabel(
  category: ContextFragment['category'],
  language: 'zh' | 'en',
): string {
  const labels =
    language === 'zh'
      ? {
          summary: '摘要',
          memory: '记忆',
          recent_turns: '近期对话',
          domain_state: '领域上下文',
          runtime_state: '运行时状态',
          tool_affordance: '工具能力',
        }
      : {
          summary: 'Summary',
          memory: 'Memory',
          recent_turns: 'Recent Turns',
          domain_state: 'Domain Context',
          runtime_state: 'Runtime State',
          tool_affordance: 'Tool Affordances',
        };

  return labels[category];
}

function stringifyMetadataValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function projectMetadataLines(metadata: Record<string, unknown> | undefined): string[] {
  if (!metadata) {
    return [];
  }

  return Object.entries(metadata)
    .filter(([, value]) => typeof value !== 'undefined')
    .map(([key, value]) => `${key}: ${stringifyMetadataValue(value)}`);
}

export function projectManagerSessionProjectionToDebugModel(
  projection: ManagerSessionProjection | null | undefined,
  language: 'zh' | 'en',
): CommandCenterDebugModel | null {
  if (!projection?.contextSnapshot) {
    return null;
  }

  const usage = projection.contextUsage;
  const snapshot = projection.contextSnapshot;
  const assembledAtLabel = formatTimestamp(snapshot.assembledAt, language);

  return {
    assembledAt: snapshot.assembledAt,
    assembledAtLabel,
    title: language === 'zh' ? '上下文调试' : 'Context Debug',
    subtitle:
      language === 'zh'
        ? '检查本轮 manager 使用了哪些摘要、记忆和运行时片段。'
        : 'Inspect which summaries, memories, and runtime fragments informed the manager.',
    metrics: [
      {
        id: 'fragments',
        label: language === 'zh' ? '片段数' : 'Fragments',
        value: String(usage?.fragmentCount ?? snapshot.fragments.length),
      },
      {
        id: 'tokens',
        label: language === 'zh' ? '估算 Token' : 'Token Est.',
        value: typeof usage?.tokenEstimate === 'number' ? String(usage.tokenEstimate) : '-',
      },
      {
        id: 'memory',
        label: language === 'zh' ? '记忆条数' : 'Memories',
        value: String(usage?.memoryCount ?? snapshot.memoryCount),
      },
      {
        id: 'summary',
        label: language === 'zh' ? '摘要 ID' : 'Summary ID',
        value: usage?.summaryId || snapshot.summaryId || '-',
      },
      {
        id: 'recent',
        label: language === 'zh' ? '近期消息' : 'Recent Msgs',
        value: String(snapshot.recentMessageCount),
      },
      {
        id: 'assembled',
        label: language === 'zh' ? '组装时间' : 'Assembled',
        value: assembledAtLabel,
      },
    ],
    fragments: snapshot.fragments.map((fragment) => ({
      id: fragment.id,
      category: fragment.category,
      categoryLabel: getCategoryLabel(fragment.category, language),
      priority: fragment.priority,
      text: fragment.text,
      metadataLines: projectMetadataLines(fragment.metadata),
    })),
  };
}
