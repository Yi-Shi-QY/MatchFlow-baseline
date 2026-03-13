import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { Button } from '@/src/components/ui/Button';
import { SettingsItemRow } from '@/src/pages/settings/SettingsItemRow';
import { SettingsOverviewCard } from '@/src/pages/settings/SettingsOverviewCard';
import { SettingsSection } from '@/src/pages/settings/SettingsSection';
import { deriveSettingsHomeModel } from '@/src/pages/settings/settingsHomeModel';
import { useSettingsState } from '@/src/pages/settings/useSettingsState';

export default function Settings() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
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

  const copy =
    language === 'zh'
      ? {
          title: '设置',
          subtitle: '设置项即时生效；这里负责通用偏好、执行策略、记忆策略与正式入口。',
        }
      : {
          title: 'Settings',
          subtitle:
            'Settings apply immediately. Use this home for preferences, execution behavior, memory strategy, and formal product entry points.',
        };

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

  return (
    <WorkspaceShell
      language={language}
      section="settings"
      title={copy.title}
      subtitle={copy.subtitle}
      headerActions={
        <Button variant="secondary" size="sm" className="rounded-2xl" onClick={() => navigate(-1)}>
          {model.primaryAction.label}
        </Button>
      }
    >
      <SettingsOverviewCard model={model.overviewCard} onNavigate={navigate} />

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
                onNavigate={navigate}
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
            onNavigate={navigate}
          />
        ))}
      </SettingsSection>
    </WorkspaceShell>
  );
}
