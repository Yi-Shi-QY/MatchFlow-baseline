import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Card, CardContent } from '@/src/components/ui/Card';

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
                  {section}
                </NavLink>
              ))}
            </div>
          )}
          <p className="text-xs text-zinc-500">
            This area is being migrated into dedicated design/manage/publish pages.
          </p>
          <div className="text-xs text-emerald-300">
            Continue with domain workspaces from <Link className="underline" to="/app/dashboard">Dashboard</Link>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
