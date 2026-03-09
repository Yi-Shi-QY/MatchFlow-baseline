import React from 'react';
import type {
  DataSourceDefinition,
  SourceIconKey,
  SourceSelection,
} from '@/src/services/dataSources';
import { Card, CardContent } from '@/src/components/ui/Card';
import { CheckCircle2 } from 'lucide-react';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface SourceSelectionCardsProps {
  availableSources: DataSourceDefinition[];
  resolvedSelectedSources: SourceSelection;
  onToggleSource: (sourceId: string) => void;
  renderSourceIcon: (icon: SourceIconKey) => React.ReactNode;
  t: TranslateFn;
}

export function SourceSelectionCards({
  availableSources,
  resolvedSelectedSources,
  onToggleSource,
  renderSourceIcon,
  t,
}: SourceSelectionCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {availableSources.map((source) => {
        const isSelected = !!resolvedSelectedSources[source.id];
        return (
          <Card
            key={source.id}
            className={`cursor-pointer transition-colors ${source.cardSpan === 2 ? 'col-span-2' : ''} ${
              isSelected ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900'
            }`}
            onClick={() => onToggleSource(source.id)}
          >
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                {renderSourceIcon(source.icon)}
                {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
              <span className="text-sm font-medium">{t(source.labelKey)}</span>
              <span className="text-[10px] text-zinc-500">{t(source.descriptionKey)}</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
