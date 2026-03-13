import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { Button } from '@/src/components/ui/Button';
import { Select } from '@/src/components/ui/Select';
import { testConnection } from '@/src/services/ai';
import { useSettingsState } from '@/src/pages/settings/useSettingsState';
import { ConnectionStatusCard } from '@/src/pages/settings/ConnectionStatusCard';
import { deriveConnectionDataModel } from '@/src/pages/settings/connectionDataModel';

function getCurrentProviderApiKey(settings: ReturnType<typeof useSettingsState>['settings']): string {
  if (settings.provider === 'gemini') {
    return settings.geminiApiKey;
  }
  if (settings.provider === 'deepseek') {
    return settings.deepseekApiKey;
  }
  return settings.openaiCompatibleApiKey;
}

async function testDataSourceConnection(input: {
  serverUrl: string;
  apiKey: string;
}): Promise<boolean> {
  const baseUrl = input.serverUrl.trim();
  if (!baseUrl) {
    return false;
  }

  const url = new URL('/matches', baseUrl).toString();
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  return response.ok;
}

export default function ConnectionDataSettings() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const state = useSettingsState();
  const [aiCheckState, setAiCheckState] = React.useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dataCheckState, setDataCheckState] = React.useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [lastCheckedLabel, setLastCheckedLabel] = React.useState(
    language === 'zh' ? '尚未检查' : 'Not checked yet',
  );
  const model = React.useMemo(
    () =>
      deriveConnectionDataModel({
        settings: state.settings,
        language,
        lastCheckedLabel,
      }),
    [language, lastCheckedLabel, state.settings],
  );

  const copy =
    language === 'zh'
      ? {
          title: '连接与数据',
          subtitle: '当前版本直接修改 AI 与数据源配置，并在这里执行正式连接检查。',
          aiApiKey: 'AI API Key',
          model: 'Model',
          baseUrl: 'Base URL',
          serverUrl: '服务地址',
          dataApiKey: '数据 API Key',
        }
      : {
          title: 'Connections & Data',
          subtitle: 'Edit AI and data-source settings directly in the current version and run formal connection checks here.',
          aiApiKey: 'AI API Key',
          model: 'Model',
          baseUrl: 'Base URL',
          serverUrl: 'Server URL',
          dataApiKey: 'Data API Key',
        };

  const updateApiKey = React.useCallback(
    (value: string) => {
      if (state.settings.provider === 'gemini') {
        state.updateSetting('geminiApiKey', value);
        return;
      }
      if (state.settings.provider === 'deepseek') {
        state.updateSetting('deepseekApiKey', value);
        return;
      }
      state.updateSetting('openaiCompatibleApiKey', value);
    },
    [state],
  );

  const handleTestAi = React.useCallback(async () => {
    setAiCheckState('testing');
    try {
      await testConnection(state.settings);
      setAiCheckState('success');
    } catch {
      setAiCheckState('error');
    }
    setLastCheckedLabel(new Date().toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }));
  }, [language, state.settings]);

  const handleTestData = React.useCallback(async () => {
    setDataCheckState('testing');
    try {
      const ok = await testDataSourceConnection({
        serverUrl: state.settings.matchDataServerUrl,
        apiKey: state.settings.matchDataApiKey,
      });
      setDataCheckState(ok ? 'success' : 'error');
    } catch {
      setDataCheckState('error');
    }
    setLastCheckedLabel(new Date().toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }));
  }, [language, state.settings.matchDataApiKey, state.settings.matchDataServerUrl]);

  return (
    <WorkspaceShell
      language={language}
      section="settings"
      title={copy.title}
      subtitle={copy.subtitle}
      headerActions={
        <Button variant="secondary" size="sm" className="rounded-2xl" onClick={() => navigate(-1)}>
          {language === 'zh' ? '完成' : 'Done'}
        </Button>
      }
    >
      <ConnectionStatusCard
        model={model.statusCard}
        onTestAi={() => void handleTestAi()}
        onTestData={() => void handleTestData()}
        isTestingAi={aiCheckState === 'testing'}
        isTestingData={dataCheckState === 'testing'}
      />

      <section className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
          {model.aiServiceSection.title}
        </div>
        <div className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
          <div className="grid gap-4">
            <div>
              <div className="mb-2 text-xs text-[var(--mf-text-muted)]">{model.aiServiceSection.fields[0].label}</div>
              <Select
                value={state.settings.provider}
                onChange={(value) => state.updateSetting('provider', value as never)}
                options={[
                  { value: 'gemini', label: 'Gemini' },
                  { value: 'deepseek', label: 'DeepSeek' },
                  { value: 'openai_compatible', label: 'OpenAI Compatible' },
                ]}
              />
            </div>

            <label className="space-y-2">
              <div className="text-xs text-[var(--mf-text-muted)]">{copy.model}</div>
              <input
                type="text"
                value={state.settings.model}
                onChange={(event) => state.updateSetting('model', event.target.value)}
                className="w-full rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3 text-sm text-[var(--mf-text)] focus:outline-none"
              />
            </label>

            <label className="space-y-2">
              <div className="text-xs text-[var(--mf-text-muted)]">{copy.baseUrl}</div>
              <input
                type="text"
                value={state.settings.openaiCompatibleBaseUrl}
                onChange={(event) => state.updateSetting('openaiCompatibleBaseUrl', event.target.value)}
                className="w-full rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3 text-sm text-[var(--mf-text)] focus:outline-none"
              />
            </label>

            <label className="space-y-2">
              <div className="text-xs text-[var(--mf-text-muted)]">{copy.aiApiKey}</div>
              <input
                type="password"
                value={getCurrentProviderApiKey(state.settings)}
                onChange={(event) => updateApiKey(event.target.value)}
                className="w-full rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3 text-sm text-[var(--mf-text)] focus:outline-none"
              />
            </label>

            <div className="text-sm text-[var(--mf-text-muted)]">
              {aiCheckState === 'success'
                ? language === 'zh'
                  ? 'AI 连接通过'
                  : 'AI connection passed'
                : aiCheckState === 'error'
                  ? language === 'zh'
                    ? 'AI 连接失败'
                    : 'AI connection failed'
                  : language === 'zh'
                    ? '尚未执行 AI 检查'
                    : 'AI connection has not been checked yet'}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
          {model.dataSourceSection.title}
        </div>
        <div className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
          <div className="grid gap-4">
            <label className="space-y-2">
              <div className="text-xs text-[var(--mf-text-muted)]">{copy.serverUrl}</div>
              <input
                type="text"
                value={state.settings.matchDataServerUrl}
                onChange={(event) => state.updateSetting('matchDataServerUrl', event.target.value)}
                className="w-full rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3 text-sm text-[var(--mf-text)] focus:outline-none"
              />
            </label>

            <label className="space-y-2">
              <div className="text-xs text-[var(--mf-text-muted)]">{copy.dataApiKey}</div>
              <input
                type="password"
                value={state.settings.matchDataApiKey}
                onChange={(event) => state.updateSetting('matchDataApiKey', event.target.value)}
                className="w-full rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3 text-sm text-[var(--mf-text)] focus:outline-none"
              />
            </label>

            <div className="text-sm text-[var(--mf-text-muted)]">
              {dataCheckState === 'success'
                ? language === 'zh'
                  ? '数据连接通过'
                  : 'Data connection passed'
                : dataCheckState === 'error'
                  ? language === 'zh'
                    ? '数据连接失败'
                    : 'Data connection failed'
                  : language === 'zh'
                    ? '尚未执行数据检查'
                    : 'Data connection has not been checked yet'}
            </div>
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}
