import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Card, CardContent } from '@/src/components/ui/Card';
import { useI18n } from '@/src/i18n';

interface WorkspacePlaceholderProps {
  title: string;
  description: string;
  domainSectionBasePath?: string;
  activeDomainSection?: 'design' | 'manage' | 'publish';
}

export default function WorkspacePlaceholder({
  title,
  description,
  domainSectionBasePath,
  activeDomainSection = 'design',
}: WorkspacePlaceholderProps) {
  const { t } = useI18n();
  const sectionLabel = (section: 'design' | 'manage' | 'publish') => {
    if (section === 'design') return t('design', '设计');
    if (section === 'manage') return t('manage', '管理');
    return t('publish', '发布');
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <h1 className="text-base font-bold text-white">{title}</h1>
          <p className="text-sm text-zinc-400">{description}</p>
          {domainSectionBasePath && (
            <div className="flex flex-wrap gap-2">
              {(['design', 'manage', 'publish'] as const).map((section) => (
                <NavLink
                  key={`placeholder-domain-stage-${section}`}
                  to={`${domainSectionBasePath}/${section}`}
                  className={({ isActive }) => `rounded-full border px-3 py-1 text-[11px] transition ${
                    isActive || activeDomainSection === section
                      ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                      : 'border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                  }`}
                >
                  {sectionLabel(section)}
                </NavLink>
              ))}
            </div>
          )}
          <p className="text-xs text-zinc-500">
            {t(
              'This area is being migrated into dedicated design/manage/publish pages.',
              '该区域正在迁移为独立的设计/管理/发布页面。',
            )}
          </p>
          <div className="text-xs text-emerald-300">
            {t('Continue with domain workspaces from ', '可从')}
            <Link className="underline" to="/app/dashboard">
              {t('Dashboard', '总览面板')}
            </Link>
            {t('.', '继续进入各领域工作区。')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
