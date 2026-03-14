import React from 'react';
import type { AnalysisDomain } from '@/src/services/domains/types';
import type {
  DataSourceDefinition,
  FormFieldSchema,
  SourceSelection,
} from '@/src/services/dataSources';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';
import type { EditableSubjectDataFormModel } from './contracts';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;
type MatchStep = 'selection' | 'analyzing' | 'result';

interface UseEditableSourceFormArgs {
  editableData: string;
  setEditableData: React.Dispatch<React.SetStateAction<string>>;
  step: MatchStep;
  subjectDisplay: SubjectDisplay | undefined;
  importedData: EditableSubjectDataFormModel | null;
  activeDomain: AnalysisDomain;
  domainSourceCatalog: DataSourceDefinition[];
  resolvedSelectedSources: SourceSelection;
  availableSources: DataSourceDefinition[];
  t: TranslateFn;
}

export function useEditableSourceForm({
  editableData,
  setEditableData,
  step,
  subjectDisplay,
  importedData,
  activeDomain,
  domainSourceCatalog,
  resolvedSelectedSources,
  availableSources,
  t,
}: UseEditableSourceFormArgs): {
  showJson: boolean;
  setShowJson: React.Dispatch<React.SetStateAction<boolean>>;
  renderHumanReadableForm: () => React.ReactNode;
} {
  const [showJson, setShowJson] = React.useState(false);
  const editableDataRef = React.useRef(editableData);

  React.useEffect(() => {
    editableDataRef.current = editableData;
  }, [editableData]);

  React.useEffect(() => {
    if (!subjectDisplay || step !== 'selection') return;

    let currentData: EditableSubjectDataFormModel = {};
    try {
      if (editableDataRef.current) {
        currentData = JSON.parse(editableDataRef.current) as EditableSubjectDataFormModel;
      }
    } catch (e) {
      // If JSON is invalid and not empty, avoid overwriting user's work
      if (editableDataRef.current && editableDataRef.current.trim() !== '') return;
    }

    const nextData: EditableSubjectDataFormModel = { ...currentData };
    const sourceContext = { subjectDisplay, importedData };

    domainSourceCatalog.forEach((source) => {
      if (resolvedSelectedSources[source.id]) {
        source.applyToData(nextData, sourceContext);
      } else {
        source.removeFromData(nextData);
      }
    });

    const capabilities = activeDomain.buildSourceCapabilities(
      nextData,
      resolvedSelectedSources,
    );

    // Explicit source context helps deterministic planning routing in ai.ts.
    nextData.sourceContext = {
      origin: subjectDisplay.source || (importedData ? 'imported' : 'local'),
      domainId: activeDomain.id,
      selectedSources: { ...resolvedSelectedSources },
      selectedSourceIds: domainSourceCatalog
        .filter((source) => resolvedSelectedSources[source.id])
        .map((source) => source.id),
      capabilities,
      matchStatus: nextData.status || subjectDisplay.status || 'unknown',
    };

    const nextJson = JSON.stringify(nextData, null, 2);
    if (nextJson !== editableDataRef.current) {
      setEditableData(nextJson);
    }
  }, [
    subjectDisplay,
    step,
    importedData,
    resolvedSelectedSources,
    activeDomain,
    domainSourceCatalog,
    setEditableData,
  ]);

  const handleDataChange = React.useCallback(
    (path: string[], value: any) => {
      try {
        const data = JSON.parse(editableData);
        let current = data;
        for (let i = 0; i < path.length - 1; i++) {
          if (!current[path[i]]) current[path[i]] = {};
          current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
        setEditableData(JSON.stringify(data, null, 2));
      } catch (e) {
        // Ignore when user-provided JSON is currently invalid.
      }
    },
    [editableData, setEditableData],
  );

  const getValueByPath = React.useCallback(
    (data: any, path: string[]) =>
      path.reduce((acc, key) => (acc == null ? undefined : acc[key]), data),
    [],
  );

  const renderFormField = React.useCallback(
    (data: any, field: FormFieldSchema) => {
      const inputClass =
        'w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none';
      const centeredInputClass =
        'w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white text-center focus:border-emerald-500 focus:outline-none';
      const placeholder =
        'placeholderKey' in field && field.placeholderKey ? t(field.placeholderKey) : undefined;

      if (field.type === 'text') {
        const value = getValueByPath(data, field.path);
        return (
          <div key={field.id}>
            {field.labelKey && (
              <label className="text-[10px] text-zinc-500 block mb-1">{t(field.labelKey)}</label>
            )}
            <input
              type="text"
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => handleDataChange(field.path, e.target.value)}
              placeholder={placeholder}
              className={inputClass}
            />
          </div>
        );
      }

      if (field.type === 'number') {
        const value = getValueByPath(data, field.path);
        return (
          <div key={field.id}>
            {field.labelKey && (
              <label className="text-[10px] text-zinc-500 block mb-1">{t(field.labelKey)}</label>
            )}
            <input
              type="number"
              value={typeof value === 'number' ? value : Number(value ?? 0)}
              onChange={(e) => handleDataChange(field.path, Number(e.target.value))}
              placeholder={placeholder}
              className={inputClass}
            />
          </div>
        );
      }

      if (field.type === 'textarea') {
        const value = getValueByPath(data, field.path);
        return (
          <div key={field.id} className="space-y-2">
            {field.labelKey && (
              <label className="text-[10px] text-zinc-500 block mb-1">{t(field.labelKey)}</label>
            )}
            <textarea
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => handleDataChange(field.path, e.target.value)}
              placeholder={placeholder}
              rows={field.rows || 4}
              className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-xs text-white focus:border-emerald-500 focus:outline-none min-h-[80px] resize-none"
            />
          </div>
        );
      }

      if (field.type === 'csv_array') {
        const value = getValueByPath(data, field.path);
        const text = Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '';
        return (
          <div key={field.id}>
            {field.labelKey && (
              <label className="text-[10px] text-zinc-500 block mb-1">{t(field.labelKey)}</label>
            )}
            <input
              type="text"
              value={text}
              onChange={(e) =>
                handleDataChange(
                  field.path,
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              placeholder={placeholder ?? field.placeholder}
              className={inputClass}
            />
          </div>
        );
      }

      if (field.type === 'versus_number') {
        const homeValue = getValueByPath(data, field.homePath);
        const awayValue = getValueByPath(data, field.awayPath);
        return (
          <div key={field.id} className="space-y-2">
            {field.labelKey && <label className="text-[10px] text-zinc-500 block">{t(field.labelKey)}</label>}
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={typeof homeValue === 'number' ? homeValue : Number(homeValue ?? 0)}
                onChange={(e) => handleDataChange(field.homePath, Number(e.target.value))}
                className={centeredInputClass}
              />
              <span className="text-xs text-zinc-600">vs</span>
              <input
                type="number"
                value={typeof awayValue === 'number' ? awayValue : Number(awayValue ?? 0)}
                onChange={(e) => handleDataChange(field.awayPath, Number(e.target.value))}
                className={centeredInputClass}
              />
            </div>
          </div>
        );
      }

      const homeValue = getValueByPath(data, field.homePath);
      const drawValue = getValueByPath(data, field.drawPath);
      const awayValue = getValueByPath(data, field.awayPath);
      return (
        <div key={field.id} className="space-y-2">
          {field.labelKey && <label className="text-[10px] text-zinc-500 block">{t(field.labelKey)}</label>}
          <div className="flex gap-2">
            <input
              type="number"
              value={typeof homeValue === 'number' ? homeValue : Number(homeValue ?? 0)}
              onChange={(e) => handleDataChange(field.homePath, Number(e.target.value))}
              className={centeredInputClass}
              placeholder={t(field.homePlaceholderKey)}
            />
            <input
              type="number"
              value={typeof drawValue === 'number' ? drawValue : Number(drawValue ?? 0)}
              onChange={(e) => handleDataChange(field.drawPath, Number(e.target.value))}
              className={centeredInputClass}
              placeholder={t(field.drawPlaceholderKey)}
            />
            <input
              type="number"
              value={typeof awayValue === 'number' ? awayValue : Number(awayValue ?? 0)}
              onChange={(e) => handleDataChange(field.awayPath, Number(e.target.value))}
              className={centeredInputClass}
              placeholder={t(field.awayPlaceholderKey)}
            />
          </div>
        </div>
      );
    },
    [getValueByPath, handleDataChange, t],
  );

  const renderHumanReadableForm = React.useCallback(() => {
    let data;
    try {
      data = JSON.parse(editableData);
    } catch (e) {
      return <div className="text-red-400 text-xs p-4">{t('match.invalid_json')}</div>;
    }

    const enabledSources = availableSources.filter((source) => resolvedSelectedSources[source.id]);
    const isSimpleField = (field: FormFieldSchema) =>
      field.type === 'text' || field.type === 'number' || field.type === 'csv_array';

    return (
      <div className="space-y-4 text-sm">
        {enabledSources.map((source) => (
          <React.Fragment key={source.id}>
            {source.formSections.map((section) => {
              if (section.visibleWhen && !section.visibleWhen(data)) return null;
              const useGrid = section.columns === 2 && section.fields.every(isSimpleField);

              return (
                <div key={`${source.id}-${section.id}`} className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase border-b border-white/10 pb-1">
                    {t(section.titleKey)}
                  </h3>
                  <div className={useGrid ? 'grid grid-cols-2 gap-2' : 'space-y-3'}>
                    {section.fields.map((field) => renderFormField(data, field))}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  }, [availableSources, editableData, renderFormField, resolvedSelectedSources, t]);

  return {
    showJson,
    setShowJson,
    renderHumanReadableForm,
  };
}
