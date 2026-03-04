import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/src/components/ui/Card';
import { useI18n } from '@/src/i18n';

interface Entry {
  titleEn: string;
  titleZh: string;
  descriptionEn: string;
  descriptionZh: string;
  to: string;
}

const ENTRIES: Entry[] = [
  {
    titleEn: 'Data Sources',
    titleZh: '数据源',
    descriptionEn: 'Datasource design/edit/manage/publish workbench.',
    descriptionZh: '数据源设计/编辑/管理/发布工作台。',
    to: '/app/datasources',
  },
  {
    titleEn: 'Planning Templates',
    titleZh: '规划模板',
    descriptionEn: 'Planning template workflow and release.',
    descriptionZh: '规划模板工作流与发布。',
    to: '/app/planning-templates',
  },
  {
    titleEn: 'Animation Templates',
    titleZh: '动画模板',
    descriptionEn: 'Animation template workflow and release.',
    descriptionZh: '动画模板工作流与发布。',
    to: '/app/animation-templates',
  },
  {
    titleEn: 'Agents',
    titleZh: '智能体',
    descriptionEn: 'Agent prompt and dependency governance.',
    descriptionZh: '智能体提示词与依赖治理。',
    to: '/app/agents',
  },
  {
    titleEn: 'Skills',
    titleZh: '技能',
    descriptionEn: 'Skill declaration and runtime alias governance.',
    descriptionZh: '技能声明与运行时别名治理。',
    to: '/app/skills',
  },
  {
    titleEn: 'Domain Packs',
    titleZh: '领域包',
    descriptionEn: 'Domain-level capability packs and rollout policy governance.',
    descriptionZh: '领域能力包与发布策略治理。',
    to: '/app/domain-packs',
  },
  {
    titleEn: 'Validation Center',
    titleZh: '验证中心',
    descriptionEn: 'Cross-domain validation runs and runId inspection.',
    descriptionZh: '跨领域验证运行与 runId 查询。',
    to: '/app/validation-center',
  },
  {
    titleEn: 'Release Center',
    titleZh: '发布中心',
    descriptionEn: 'Publish and rollback timeline (currently migrating).',
    descriptionZh: '发布与回滚时间线（迁移中）。',
    to: '/app/release-center',
  },
];

export default function AppDashboard() {
  const { language, t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-base font-bold text-white">{t('Workspace Dashboard', '工作区总览')}</h1>
        <p className="text-xs text-zinc-500">
          {t(
            'Domain workbenches are split and routed independently.',
            '各领域工作台已拆分并独立路由。',
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ENTRIES.map((entry) => (
          <Link key={entry.to} to={entry.to}>
            <Card className="h-full border-zinc-800 bg-zinc-950 transition hover:border-emerald-500/40">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    {language === 'zh' ? entry.titleZh : entry.titleEn}
                  </h2>
                  <ArrowRight className="h-4 w-4 text-zinc-500" />
                </div>
                <p className="text-xs text-zinc-400">
                  {language === 'zh' ? entry.descriptionZh : entry.descriptionEn}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
