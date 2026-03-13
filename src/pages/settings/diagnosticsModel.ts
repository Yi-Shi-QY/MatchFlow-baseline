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

export function deriveDiagnosticsModel(input: {
  settings: AppSettings;
  language: 'zh' | 'en';
}): DiagnosticsModel {
  const { language } = input;

  return {
    sections: [
      {
        id: 'connection_checks',
        title: language === 'zh' ? '连接检查' : 'Connection Checks',
        description:
          language === 'zh'
            ? '重新进入连接与数据页执行 AI 与数据源检查。'
            : 'Return to Connections & Data to run AI and data checks.',
      },
      {
        id: 'sync_status',
        title: language === 'zh' ? '同步状态' : 'Sync Status',
        description:
          language === 'zh'
            ? '查看并触发当前版本允许的正式同步动作。'
            : 'Review and trigger the formal sync actions exposed in this version.',
      },
      {
        id: 'extensions_sync',
        title: language === 'zh' ? '扩展与同步' : 'Extensions & Sync',
        description:
          language === 'zh'
            ? '同步推荐扩展，并进入扩展管理。'
            : 'Sync recommended extensions and open Extension Management.',
      },
      {
        id: 'notification_checks',
        title: language === 'zh' ? '通知检查' : 'Notification Checks',
        description:
          language === 'zh'
            ? '查看当前通知权限和提醒能力状态。'
            : 'Review notification permissions and reminder readiness.',
      },
      {
        id: 'automation_checks',
        title: language === 'zh' ? '自动执行检查' : 'Automation Checks',
        description:
          language === 'zh'
            ? '确认自动执行、后台运行和调度同步的当前状态。'
            : 'Confirm automation, background behavior, and scheduler sync state.',
      },
      {
        id: 'maintenance',
        title: language === 'zh' ? '维护与清理' : 'Maintenance',
        description:
          language === 'zh'
            ? '把危险操作集中放在底部，避免混入普通设置。'
            : 'Keep destructive maintenance actions isolated at the bottom.',
      },
    ],
  };
}
