import React from 'react';
import { NavLink } from 'react-router-dom';

export type DomainStage = 'design' | 'manage' | 'publish';

interface DomainStageTabsProps {
  basePath: string;
  activeStage: DomainStage;
}

const STAGES: DomainStage[] = ['design', 'manage', 'publish'];

export default function DomainStageTabs({ basePath, activeStage }: DomainStageTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {STAGES.map((stage) => (
        <NavLink
          key={`domain-stage-tab-${stage}`}
          to={`${basePath}/${stage}`}
          className={({ isActive }) => `rounded-full border px-3 py-1 text-[11px] transition ${
            isActive || activeStage === stage
              ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
              : 'border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
          }`}
        >
          {stage}
        </NavLink>
      ))}
    </div>
  );
}
