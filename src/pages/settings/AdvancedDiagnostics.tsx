import React from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';

export default function AdvancedDiagnostics() {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const copy =
    language === 'zh'
      ? {
          title: '高级与诊断',
          subtitle: '正式诊断分区、维护项与扩展入口会在后续任务中接入。',
          body: '当前只先锁定设置二级页路由，避免继续把诊断能力混入一级设置层。',
        }
      : {
          title: 'Advanced & Diagnostics',
          subtitle: 'Formal diagnostics sections, maintenance actions, and the extension entry arrive in later tasks.',
          body: 'This task only freezes the settings child route so diagnostics stop leaking into the primary settings surface.',
        };

  return (
    <WorkspaceShell language={language} section="settings" title={copy.title} subtitle={copy.subtitle}>
      <section className="rounded-[1.75rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/88 p-5 text-sm leading-6 text-[var(--mf-text-muted)] shadow-sm">
        {copy.body}
      </section>
    </WorkspaceShell>
  );
}
