import React from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';

export default function ConnectionDataSettings() {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const copy =
    language === 'zh'
      ? {
          title: '连接与数据',
          subtitle: 'AI 服务与数据源配置会在后续任务中切入正式产品结构。',
          body: '当前只先锁定设置二级页路由，详细表单与状态卡将在后续任务实现。',
        }
      : {
          title: 'Connections & Data',
          subtitle: 'AI service and data-source configuration will land in the formal product structure later.',
          body: 'This task only locks the settings child route. Detailed forms and status cards arrive in later tasks.',
        };

  return (
    <WorkspaceShell language={language} section="settings" title={copy.title} subtitle={copy.subtitle}>
      <section className="rounded-[1.75rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/88 p-5 text-sm leading-6 text-[var(--mf-text-muted)] shadow-sm">
        {copy.body}
      </section>
    </WorkspaceShell>
  );
}
