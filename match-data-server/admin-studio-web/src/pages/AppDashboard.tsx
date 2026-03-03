import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/src/components/ui/Card';

interface Entry {
  title: string;
  description: string;
  to: string;
}

const ENTRIES: Entry[] = [
  {
    title: 'Data Sources',
    description: 'Datasource design/edit/manage/publish workbench.',
    to: '/app/datasources',
  },
  {
    title: 'Planning Templates',
    description: 'Planning template workflow and release.',
    to: '/app/planning-templates',
  },
  {
    title: 'Animation Templates',
    description: 'Animation template workflow and release.',
    to: '/app/animation-templates',
  },
  {
    title: 'Agents',
    description: 'Agent prompt and dependency governance.',
    to: '/app/agents',
  },
  {
    title: 'Skills',
    description: 'Skill declaration and runtime alias governance.',
    to: '/app/skills',
  },
  {
    title: 'Domain Packs',
    description: 'Domain-level capability packs and rollout policy governance.',
    to: '/app/domain-packs',
  },
  {
    title: 'Validation Center',
    description: 'Cross-domain validation runs and runId inspection.',
    to: '/app/validation-center',
  },
  {
    title: 'Release Center',
    description: 'Publish and rollback timeline (currently migrating).',
    to: '/app/release-center',
  },
];

export default function AppDashboard() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-base font-bold text-white">Workspace Dashboard</h1>
        <p className="text-xs text-zinc-500">
          Domain workbenches are split and routed independently.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ENTRIES.map((entry) => (
          <Link key={entry.to} to={entry.to}>
            <Card className="h-full border-zinc-800 bg-zinc-950 transition hover:border-emerald-500/40">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">{entry.title}</h2>
                  <ArrowRight className="h-4 w-4 text-zinc-500" />
                </div>
                <p className="text-xs text-zinc-400">{entry.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
