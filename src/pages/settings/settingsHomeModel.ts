import { translateText } from '@/src/i18n/translate';
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

function tr(
  language: 'zh' | 'en',
  key: string,
  zh: string,
  en: string,
  options: Record<string, unknown> = {},
): string {
  return translateText(language, key, language === 'zh' ? zh : en, options);
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
  return value
    ? tr(language, 'settings_home.boolean.on', '开启', 'On')
    : tr(language, 'settings_home.boolean.off', '关闭', 'Off');
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
      title: tr(language, 'settings_home.overview.title', '设置总览', 'Settings Overview'),
      description: tr(
        language,
        'settings_home.overview.description',
        '设置项会立即生效；连接配置、记忆策略和系统状态都从这里进入正式设置流。',
        'Changes apply immediately. Use this home to reach the formal settings flow for connections, memory strategy, and system status.',
      ),
      systemStatusLabel:
        warningCount > 0
          ? tr(language, 'settings_home.overview.needs_attention', '需要关注', 'Needs attention')
          : tr(language, 'settings_home.overview.healthy', '运行正常', 'Healthy'),
      issueCountLabel: tr(
        language,
        'settings_home.overview.issues',
        '{{count}} 项待处理',
        '{{count}} items need attention',
        { count: warningCount },
      ),
      statusTags: [
        {
          id: 'ai',
          label: tr(language, 'settings_home.tags.ai', 'AI', 'AI'),
          tone: aiStatus,
          route: '/settings/connections',
        },
        {
          id: 'data',
          label: tr(language, 'settings_home.tags.data', '数据', 'Data'),
          tone: dataStatus,
          route: '/settings/connections',
        },
        {
          id: 'memory',
          label: tr(language, 'settings_home.tags.memory', '记忆', 'Memory'),
          tone: memoryStatus,
          route: '/memory',
        },
      ],
    },
    sections: [
      {
        id: 'general',
        title: tr(language, 'settings_home.sections.general', '通用', 'General'),
      },
      {
        id: 'execution',
        title: tr(language, 'settings_home.sections.execution', '执行与提醒', 'Execution & Reminders'),
      },
      {
        id: 'memory',
        title: tr(language, 'settings_home.sections.memory', '记忆与推荐', 'Memory & Recommendations'),
      },
      {
        id: 'connections',
        title: tr(language, 'settings_home.sections.connections', '连接与数据', 'Connections & Data'),
      },
      {
        id: 'diagnostics_entry',
        title: tr(language, 'settings_home.sections.diagnostics', '高级与诊断', 'Diagnostics'),
      },
    ],
    sectionItems: {
      general: [
        {
          id: 'language',
          label: tr(language, 'settings_home.general.language_label', '语言', 'Language'),
          description: tr(
            language,
            'settings_home.general.language_description',
            '立即切换界面语言。',
            'Change the interface language immediately.',
          ),
          control: 'select',
          settingKey: 'language',
          value: settings.language,
          options: [
            { value: 'zh', label: tr(language, 'settings_home.general.language_zh', '中文', 'Chinese') },
            { value: 'en', label: tr(language, 'settings_home.general.language_en', 'English', 'English') },
          ],
        },
        {
          id: 'theme',
          label: tr(language, 'settings_home.general.theme_label', '外观', 'Appearance'),
          description: tr(
            language,
            'settings_home.general.theme_description',
            '切换浅色或深色主题。',
            'Switch between light and dark theme.',
          ),
          control: 'select',
          settingKey: 'theme',
          value: settings.theme,
          options: [
            {
              value: 'dark',
              label: tr(language, 'settings_home.general.theme_dark', '深色', 'Dark'),
            },
            {
              value: 'light',
              label: tr(language, 'settings_home.general.theme_light', '浅色', 'Light'),
            },
          ],
        },
        {
          id: 'active_domain',
          label: tr(language, 'settings_home.general.domain_label', '默认分析领域', 'Default Analysis Domain'),
          description: tr(
            language,
            'settings_home.general.domain_description',
            '决定新一轮分析默认进入的领域。',
            'Choose the default domain for new analysis flows.',
          ),
          control: 'select',
          settingKey: 'activeDomainId',
          value: settings.activeDomainId,
          options: domainOptions,
        },
      ],
      execution: [
        {
          id: 'enable_automation',
          label: tr(language, 'settings_home.execution.automation_label', '自动执行', 'Automation'),
          description: tr(
            language,
            'settings_home.execution.automation_description',
            '允许系统在满足条件时自动推进任务。',
            'Allow the system to advance eligible tasks automatically.',
          ),
          control: 'toggle',
          settingKey: 'enableAutomation',
          value: settings.enableAutomation,
          valueLabel: getBooleanLabel(settings.enableAutomation, language),
        },
        {
          id: 'background_mode',
          label: tr(language, 'settings_home.execution.background_label', '后台运行', 'Background Mode'),
          description: tr(
            language,
            'settings_home.execution.background_description',
            '在后台保持提醒与执行能力。',
            'Keep reminders and automation active in the background.',
          ),
          control: 'toggle',
          settingKey: 'enableBackgroundMode',
          value: settings.enableBackgroundMode,
          valueLabel: getBooleanLabel(settings.enableBackgroundMode, language),
        },
        {
          id: 'autonomous_planning',
          label: tr(language, 'settings_home.execution.planning_label', '智能规划', 'Autonomous Planning'),
          description: tr(
            language,
            'settings_home.execution.planning_description',
            '允许系统在需要时自动补全计划细节。',
            'Allow the system to fill in planning details when needed.',
          ),
          control: 'toggle',
          settingKey: 'enableAutonomousPlanning',
          value: settings.enableAutonomousPlanning,
          valueLabel: getBooleanLabel(settings.enableAutonomousPlanning, language),
        },
      ],
      memory: [
        {
          id: 'remember_preferences',
          label: tr(language, 'settings_home.memory.remember_label', '记录长期偏好', 'Remember Preferences'),
          description: tr(
            language,
            'settings_home.memory.remember_description',
            '记录会长期影响推荐和默认行为的偏好。',
            'Keep long-term preferences that affect future defaults and recommendations.',
          ),
          control: 'toggle',
          settingKey: 'rememberUserPreferences',
          value: settings.rememberUserPreferences,
          valueLabel: getBooleanLabel(settings.rememberUserPreferences, language),
        },
        {
          id: 'memory_confirmation',
          label: tr(
            language,
            'settings_home.memory.confirmation_label',
            '候选记忆先确认再使用',
            'Confirm Inferred Memories First',
          ),
          description: tr(
            language,
            'settings_home.memory.confirmation_description',
            '系统推断出的习惯先进入待确认，再影响后续行为。',
            'Review inferred habits before they affect future behavior.',
          ),
          control: 'toggle',
          settingKey: 'requireMemoryConfirmation',
          value: settings.requireMemoryConfirmation,
          valueLabel: getBooleanLabel(settings.requireMemoryConfirmation, language),
        },
        {
          id: 'daily_memory_summary',
          label: tr(
            language,
            'settings_home.memory.daily_summary_label',
            '生成每日摘要',
            'Daily Memory Summary',
          ),
          description: tr(
            language,
            'settings_home.memory.daily_summary_description',
            '将每日摘要加入记忆页浏览，不自动变成长效偏好。',
            'Show daily summaries in Memory without turning them into long-term rules automatically.',
          ),
          control: 'toggle',
          settingKey: 'enableDailyMemorySummary',
          value: settings.enableDailyMemorySummary,
          valueLabel: getBooleanLabel(settings.enableDailyMemorySummary, language),
        },
        {
          id: 'suggestion_replies',
          label: tr(
            language,
            'settings_home.memory.suggestions_label',
            '显示建议回复与快捷建议',
            'Suggestion Replies',
          ),
          description: tr(
            language,
            'settings_home.memory.suggestions_description',
            '在对话中心展示建议回复和快捷建议。',
            'Show suggested replies and quick suggestions in the conversation workspace.',
          ),
          control: 'toggle',
          settingKey: 'showSuggestionReplies',
          value: settings.showSuggestionReplies,
          valueLabel: getBooleanLabel(settings.showSuggestionReplies, language),
        },
        {
          id: 'open_memory',
          label: tr(language, 'settings_home.memory.open_label', '进入记忆页', 'Open Memory Workspace'),
          description: tr(
            language,
            'settings_home.memory.open_description',
            '查看和管理正式记忆内容。',
            'Review and manage formal memory content.',
          ),
          control: 'link',
          route: '/memory',
          valueLabel: tr(language, 'settings_home.memory.open_action', '打开', 'Open'),
        },
      ],
      connections: [
        {
          id: 'ai_connection',
          label: tr(language, 'settings_home.connections.ai_label', 'AI 服务', 'AI Service'),
          description: tr(
            language,
            'settings_home.connections.ai_description',
            '进入连接与数据页配置 provider、model 和 API 细节。',
            'Open Connections & Data to configure provider, model, and API details.',
          ),
          control: 'link',
          route: '/settings/connections',
          valueLabel: `${settings.provider} · ${settings.model}`,
        },
        {
          id: 'data_connection',
          label: tr(language, 'settings_home.connections.data_label', '数据源', 'Data Source'),
          description: tr(
            language,
            'settings_home.connections.data_description',
            '查看数据服务状态与配置入口。',
            'Review the data service status and configuration entry.',
          ),
          control: 'link',
          route: '/settings/connections',
          valueLabel:
            settings.matchDataServerUrl.trim().length > 0
              ? settings.matchDataServerUrl
              : tr(
                  language,
                  'settings_home.connections.not_configured',
                  '未配置',
                  'Not configured',
                ),
        },
      ],
      diagnostics_entry: [
        {
          id: 'open_diagnostics',
          label: tr(language, 'settings_home.diagnostics.label', '高级与诊断', 'Advanced Diagnostics'),
          description: tr(
            language,
            'settings_home.diagnostics.description',
            '进入连接检查、同步、扩展与维护入口。',
            'Open checks, sync, extensions, and maintenance tools.',
          ),
          control: 'link',
          route: '/settings/diagnostics',
          valueLabel: tr(language, 'settings_home.diagnostics.open_action', '进入', 'Open'),
        },
      ],
    },
    primaryAction: {
      label: tr(language, 'settings_home.primary_action', '完成', 'Done'),
    },
  };
}
