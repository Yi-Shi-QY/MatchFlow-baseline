import React from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { Button } from '@/src/components/ui/Button';
import { SettingsItemRow } from '@/src/pages/settings/SettingsItemRow';
import { SettingsOverviewCard } from '@/src/pages/settings/SettingsOverviewCard';
import { SettingsSection } from '@/src/pages/settings/SettingsSection';
import { deriveSettingsHomeModel } from '@/src/pages/settings/settingsHomeModel';
import { useSettingsState } from '@/src/pages/settings/useSettingsState';
import { useWorkspaceNavigation } from '@/src/services/navigation/useWorkspaceNavigation';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const { goBack, openRoute } = useWorkspaceNavigation();
  const state = useSettingsState();
  const model = React.useMemo(
    () =>
      deriveSettingsHomeModel({
        settings: state.settings,
        language,
        domainOptions: state.domainOptions,
      }),
    [language, state.domainOptions, state.settings],
  );

  const handleToggle = React.useCallback(
    (item: (typeof model.sectionItems)[keyof typeof model.sectionItems][number]) => {
      if (!item.settingKey || typeof item.value !== 'boolean') {
        return;
      }
      state.updateSetting(item.settingKey, (!item.value) as never);
    },
    [model.sectionItems, state],
  );

  const handleSelect = React.useCallback(
    (item: (typeof model.sectionItems)[keyof typeof model.sectionItems][number], value: string) => {
      if (!item.settingKey) {
        return;
      }
      state.updateSetting(item.settingKey, value as never);
    },
    [state],
  );

  const handleNavigate = React.useCallback(
    (route: string) => {
      openRoute(route);
    },
    [openRoute],
  );

  return (
    <WorkspaceShell
      language={language}
      section="settings"
      title={t('settings.workspace_title')}
      subtitle={t('settings.workspace_subtitle')}
      headerActions={
        <Button variant="secondary" size="sm" className="rounded-2xl" onClick={() => void goBack('/')}>
          {model.primaryAction.label}
        </Button>
      }
    >
      <SettingsOverviewCard model={model.overviewCard} onNavigate={handleNavigate} />

      {model.sections
        .filter((section) => section.id !== 'diagnostics_entry')
        .map((section) => (
          <SettingsSection key={section.id} title={section.title}>
            {model.sectionItems[section.id].map((item) => (
              <SettingsItemRow
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onNavigate={handleNavigate}
              />
            ))}
          </SettingsSection>
        ))}

      <SettingsSection title={model.sections.find((section) => section.id === 'diagnostics_entry')!.title}>
        {model.sectionItems.diagnostics_entry.map((item) => (
          <SettingsItemRow
            key={item.id}
            item={item}
            onToggle={handleToggle}
            onSelect={handleSelect}
            onNavigate={handleNavigate}
          />
        ))}
      </SettingsSection>
    </WorkspaceShell>
  );
}
