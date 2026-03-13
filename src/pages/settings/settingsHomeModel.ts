import type { AppSettings } from '@/src/services/settings';

export type SettingsSectionId =
  | 'general'
  | 'execution'
  | 'memory'
  | 'connections'
  | 'diagnostics_entry';

export type SettingsItemControl = 'toggle' | 'select' | 'link';

export interface SettingsSelectOption {
  value: string;
  label: string;
}

export interface SettingsStatusTag {
  id: string;
  label: string;
  tone: 'success' | 'warning' | 'neutral';
  route: string;
}

export interface SettingsOverviewCardModel {
  title: string;
  description: string;
  systemStatusLabel: string;
  issueCountLabel: string;
  statusTags: SettingsStatusTag[];
}

export interface SettingsSectionModel {
  id: SettingsSectionId;
  title: string;
}

export interface SettingsItemRowModel {
  id: string;
  label: string;
  description: string;
  control: SettingsItemControl;
  settingKey?: keyof AppSettings;
  value?: string | boolean;
  valueLabel?: string;
  options?: SettingsSelectOption[];
  route?: string;
}

export interface SettingsHomeModel {
  overviewCard: SettingsOverviewCardModel;
  sections: SettingsSectionModel[];
  sectionItems: Record<SettingsSectionId, SettingsItemRowModel[]>;
  primaryAction: {
    label: string;
  };
}

function getAiStatus(settings: AppSettings): SettingsStatusTag['tone'] {
  if (settings.provider === 'gemini') {
    return settings.geminiApiKey.trim().length > 0 ? 'success' : 'warning';
  }
  if (settings.provider === 'deepseek') {
    return settings.deepseekApiKey.trim().length > 0 ? 'success' : 'warning';
  }
  return settings.openaiCompatibleApiKey.trim().length > 0 ? 'success' : 'warning';
}

function getDataStatus(settings: AppSettings): SettingsStatusTag['tone'] {
  return settings.matchDataServerUrl.trim().length > 0 ? 'success' : 'warning';
}

function getMemoryStatus(settings: AppSettings): SettingsStatusTag['tone'] {
  if (!settings.rememberUserPreferences) {
    return 'warning';
  }
  return settings.requireMemoryConfirmation ? 'neutral' : 'success';
}

function getBooleanLabel(value: boolean, language: 'zh' | 'en'): string {
  if (language === 'zh') {
    return value ? '开启' : '关闭';
  }
  return value ? 'On' : 'Off';
}

export function deriveSettingsHomeModel(input: {
  settings: AppSettings;
  language: 'zh' | 'en';
  domainOptions?: SettingsSelectOption[];
}): SettingsHomeModel {
  const { settings, language } = input;
  const aiStatus = getAiStatus(settings);
  const dataStatus = getDataStatus(settings);
  const memoryStatus = getMemoryStatus(settings);
  const warningCount = [aiStatus, dataStatus, memoryStatus].filter((tone) => tone === 'warning').length;
  const domainOptions = input.domainOptions || [
    {
      value: settings.activeDomainId,
      label: settings.activeDomainId,
    },
  ];

  return {
    overviewCard: {
      title: language === 'zh' ? '设置总览' : 'Settings Overview',
      description:
        language === 'zh'
          ? '设置项即时生效；连接配置、记忆策略和系统状态从这里进入正式产品设置流。'
          : 'Changes apply immediately. Use this home to reach the formal settings flow for connections, memory strategy, and system status.',
      systemStatusLabel:
        warningCount > 0
          ? language === 'zh'
            ? '需要关注'
            : 'Needs attention'
          : language === 'zh'
            ? '运行正常'
            : 'Healthy',
      issueCountLabel:
        language === 'zh'
          ? `${warningCount} 项待处理`
          : `${warningCount} items need attention`,
      statusTags: [
        {
          id: 'ai',
          label: language === 'zh' ? 'AI' : 'AI',
          tone: aiStatus,
          route: '/settings/connections',
        },
        {
          id: 'data',
          label: language === 'zh' ? '数据' : 'Data',
          tone: dataStatus,
          route: '/settings/connections',
        },
        {
          id: 'memory',
          label: language === 'zh' ? '记忆' : 'Memory',
          tone: memoryStatus,
          route: '/memory',
        },
      ],
    },
    sections: [
      {
        id: 'general',
        title: language === 'zh' ? '通用' : 'General',
      },
      {
        id: 'execution',
        title: language === 'zh' ? '执行与提醒' : 'Execution & Reminders',
      },
      {
        id: 'memory',
        title: language === 'zh' ? '记忆与推荐' : 'Memory & Recommendations',
      },
      {
        id: 'connections',
        title: language === 'zh' ? '连接与数据' : 'Connections & Data',
      },
      {
        id: 'diagnostics_entry',
        title: language === 'zh' ? '高级与诊断' : 'Diagnostics',
      },
    ],
    sectionItems: {
      general: [
        {
          id: 'language',
          label: language === 'zh' ? '语言' : 'Language',
          description: language === 'zh' ? '立即切换界面语言。' : 'Change the interface language immediately.',
          control: 'select',
          settingKey: 'language',
          value: settings.language,
          options: [
            { value: 'zh', label: '中文' },
            { value: 'en', label: 'English' },
          ],
        },
        {
          id: 'theme',
          label: language === 'zh' ? '外观' : 'Appearance',
          description: language === 'zh' ? '切换浅色或深色主题。' : 'Switch between light and dark theme.',
          control: 'select',
          settingKey: 'theme',
          value: settings.theme,
          options: [
            {
              value: 'dark',
              label: language === 'zh' ? '深色' : 'Dark',
            },
            {
              value: 'light',
              label: language === 'zh' ? '浅色' : 'Light',
            },
          ],
        },
        {
          id: 'active_domain',
          label: language === 'zh' ? '默认分析领域' : 'Default Analysis Domain',
          description:
            language === 'zh'
              ? '决定新一轮分析默认进入的领域。'
              : 'Choose the default domain for new analysis flows.',
          control: 'select',
          settingKey: 'activeDomainId',
          value: settings.activeDomainId,
          options: domainOptions,
        },
      ],
      execution: [
        {
          id: 'enable_automation',
          label: language === 'zh' ? '自动执行' : 'Automation',
          description:
            language === 'zh'
              ? '允许系统在满足条件时自动推进任务。'
              : 'Allow the system to advance eligible tasks automatically.',
          control: 'toggle',
          settingKey: 'enableAutomation',
          value: settings.enableAutomation,
          valueLabel: getBooleanLabel(settings.enableAutomation, language),
        },
        {
          id: 'background_mode',
          label: language === 'zh' ? '后台运行' : 'Background Mode',
          description:
            language === 'zh'
              ? '在后台保持提醒与执行能力。'
              : 'Keep reminders and automation active in the background.',
          control: 'toggle',
          settingKey: 'enableBackgroundMode',
          value: settings.enableBackgroundMode,
          valueLabel: getBooleanLabel(settings.enableBackgroundMode, language),
        },
        {
          id: 'autonomous_planning',
          label: language === 'zh' ? '智能规划' : 'Autonomous Planning',
          description:
            language === 'zh'
              ? '允许系统在需要时自动补全计划细节。'
              : 'Allow the system to fill in planning details when needed.',
          control: 'toggle',
          settingKey: 'enableAutonomousPlanning',
          value: settings.enableAutonomousPlanning,
          valueLabel: getBooleanLabel(settings.enableAutonomousPlanning, language),
        },
      ],
      memory: [
        {
          id: 'remember_preferences',
          label: language === 'zh' ? '记录长期偏好' : 'Remember Preferences',
          description:
            language === 'zh'
              ? '记录会长期影响推荐和默认行为的偏好。'
              : 'Keep long-term preferences that affect future defaults and recommendations.',
          control: 'toggle',
          settingKey: 'rememberUserPreferences',
          value: settings.rememberUserPreferences,
          valueLabel: getBooleanLabel(settings.rememberUserPreferences, language),
        },
        {
          id: 'memory_confirmation',
          label: language === 'zh' ? '候选记忆先确认再使用' : 'Confirm Inferred Memories First',
          description:
            language === 'zh'
              ? '系统推断出的习惯先进入待确认，再影响后续行为。'
              : 'Review inferred habits before they affect future behavior.',
          control: 'toggle',
          settingKey: 'requireMemoryConfirmation',
          value: settings.requireMemoryConfirmation,
          valueLabel: getBooleanLabel(settings.requireMemoryConfirmation, language),
        },
        {
          id: 'daily_memory_summary',
          label: language === 'zh' ? '生成每日摘要' : 'Daily Memory Summary',
          description:
            language === 'zh'
              ? '将每日摘要加入记忆页浏览，不自动变成长效偏好。'
              : 'Show daily summaries in Memory without turning them into long-term rules automatically.',
          control: 'toggle',
          settingKey: 'enableDailyMemorySummary',
          value: settings.enableDailyMemorySummary,
          valueLabel: getBooleanLabel(settings.enableDailyMemorySummary, language),
        },
        {
          id: 'suggestion_replies',
          label: language === 'zh' ? '显示建议回复与快捷建议' : 'Suggestion Replies',
          description:
            language === 'zh'
              ? '在对话中心展示建议回复和快捷建议。'
              : 'Show suggested replies and quick suggestions in the conversation workspace.',
          control: 'toggle',
          settingKey: 'showSuggestionReplies',
          value: settings.showSuggestionReplies,
          valueLabel: getBooleanLabel(settings.showSuggestionReplies, language),
        },
        {
          id: 'open_memory',
          label: language === 'zh' ? '进入记忆页' : 'Open Memory Workspace',
          description:
            language === 'zh'
              ? '查看和管理正式记忆内容。'
              : 'Review and manage formal memory content.',
          control: 'link',
          route: '/memory',
          valueLabel: language === 'zh' ? '打开' : 'Open',
        },
      ],
      connections: [
        {
          id: 'ai_connection',
          label: language === 'zh' ? 'AI 服务' : 'AI Service',
          description:
            language === 'zh'
              ? '进入连接与数据页配置 provider、model 和 API。'
              : 'Open Connections & Data to configure provider, model, and API details.',
          control: 'link',
          route: '/settings/connections',
          valueLabel: `${settings.provider} · ${settings.model}`,
        },
        {
          id: 'data_connection',
          label: language === 'zh' ? '数据源' : 'Data Source',
          description:
            language === 'zh'
              ? '查看数据服务连接状态与入口。'
              : 'Review the data service status and configuration entry.',
          control: 'link',
          route: '/settings/connections',
          valueLabel:
            settings.matchDataServerUrl.trim().length > 0
              ? settings.matchDataServerUrl
              : language === 'zh'
                ? '未配置'
                : 'Not configured',
        },
      ],
      diagnostics_entry: [
        {
          id: 'open_diagnostics',
          label: language === 'zh' ? '高级与诊断' : 'Advanced Diagnostics',
          description:
            language === 'zh'
              ? '进入连接检查、同步、扩展与维护入口。'
              : 'Open checks, sync, extensions, and maintenance tools.',
          control: 'link',
          route: '/settings/diagnostics',
          valueLabel: language === 'zh' ? '进入' : 'Open',
        },
      ],
    },
    primaryAction: {
      label: language === 'zh' ? '完成' : 'Done',
    },
  };
}
