import { translateText } from '@/src/i18n/translate';
import type { AppSettings } from '@/src/services/settings';

type DiagnosticsSectionId =
  | 'connection_checks'
  | 'sync_status'
  | 'extensions_sync'
  | 'notification_checks'
  | 'automation_checks'
  | 'maintenance';

export interface DiagnosticsSectionModel {
  id: DiagnosticsSectionId;
  title: string;
  description: string;
}

export interface DiagnosticsModel {
  sections: DiagnosticsSectionModel[];
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

export function deriveDiagnosticsModel(input: {
  settings: AppSettings;
  language: 'zh' | 'en';
}): DiagnosticsModel {
  const { language } = input;

  return {
    sections: [
      {
        id: 'connection_checks',
        title: tr(
          language,
          'settings_diagnostics.sections.connection_checks.title',
          '连接检查',
          'Connection Checks',
        ),
        description: tr(
          language,
          'settings_diagnostics.sections.connection_checks.description',
          '重新进入连接与数据页，执行 AI 与数据源检查。',
          'Return to Connections & Data to run AI and data checks.',
        ),
      },
      {
        id: 'sync_status',
        title: tr(
          language,
          'settings_diagnostics.sections.sync_status.title',
          '同步状态',
          'Sync Status',
        ),
        description: tr(
          language,
          'settings_diagnostics.sections.sync_status.description',
          '查看并触发当前版本允许的正式同步动作。',
          'Review and trigger the formal sync actions exposed in this version.',
        ),
      },
      {
        id: 'extensions_sync',
        title: tr(
          language,
          'settings_diagnostics.sections.extensions_sync.title',
          '扩展与同步',
          'Extensions & Sync',
        ),
        description: tr(
          language,
          'settings_diagnostics.sections.extensions_sync.description',
          '同步推荐扩展，并进入扩展管理。',
          'Sync recommended extensions and open Extension Management.',
        ),
      },
      {
        id: 'notification_checks',
        title: tr(
          language,
          'settings_diagnostics.sections.notification_checks.title',
          '通知检查',
          'Notification Checks',
        ),
        description: tr(
          language,
          'settings_diagnostics.sections.notification_checks.description',
          '查看当前通知权限和提醒能力状态。',
          'Review notification permissions and reminder readiness.',
        ),
      },
      {
        id: 'automation_checks',
        title: tr(
          language,
          'settings_diagnostics.sections.automation_checks.title',
          '自动执行检查',
          'Automation Checks',
        ),
        description: tr(
          language,
          'settings_diagnostics.sections.automation_checks.description',
          '确认自动执行、后台运行和调度同步的当前状态。',
          'Confirm automation, background behavior, and scheduler sync state.',
        ),
      },
      {
        id: 'maintenance',
        title: tr(
          language,
          'settings_diagnostics.sections.maintenance.title',
          '维护与清理',
          'Maintenance',
        ),
        description: tr(
          language,
          'settings_diagnostics.sections.maintenance.description',
          '把危险操作集中放在底部，避免混入普通设置。',
          'Keep destructive maintenance actions isolated at the bottom.',
        ),
      },
    ],
  };
}
