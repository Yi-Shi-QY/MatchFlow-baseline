import React from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { clearHistoryByDomain, clearResumeStateByDomain } from '@/src/services/history';
import { clearSavedSubjectsByDomain } from '@/src/services/savedSubjects';
import { syncRecommendedExtensions } from '@/src/services/extensions/recommendedSync';
import { clearExtensionStore } from '@/src/services/extensions/store';
import { clearInstalledDomainPacks } from '@/src/services/domains/packStore';
import { scheduleNativeAutomationSync } from '@/src/services/automation/nativeScheduler';
import { deriveDiagnosticsModel } from '@/src/pages/settings/diagnosticsModel';
import { DiagnosticsSection } from '@/src/pages/settings/DiagnosticsSection';
import { useSettingsState } from '@/src/pages/settings/useSettingsState';
import { useWorkspaceNavigation } from '@/src/services/navigation/useWorkspaceNavigation';

export default function AdvancedDiagnostics() {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const { goBack, openRoute } = useWorkspaceNavigation();
  const state = useSettingsState();
  const model = React.useMemo(
    () =>
      deriveDiagnosticsModel({
        settings: state.settings,
        language,
      }),
    [language, state.settings],
  );
  const [notificationStatus, setNotificationStatus] = React.useState<string | null>(null);
  const [syncStatus, setSyncStatus] = React.useState('');

  const copy = {
    title: t('settings_diagnostics.page.title', {
      defaultValue: language === 'zh' ? '高级与诊断' : 'Advanced & Diagnostics',
    }),
    subtitle: t('settings_diagnostics.page.subtitle', {
      defaultValue:
        language === 'zh'
          ? '这里保留正式产品可理解的检查、同步、扩展与维护入口。'
          : 'This page keeps the formal checks, sync actions, extension entry, and maintenance tools.',
    }),
    syncNow: t('settings_diagnostics.page.sync_now', {
      defaultValue: language === 'zh' ? '立即同步' : 'Sync now',
    }),
    openConnections: t('settings_diagnostics.page.open_connections', {
      defaultValue: language === 'zh' ? '进入连接与数据' : 'Open Connections & Data',
    }),
    openExtensions: t('settings_diagnostics.page.open_extensions', {
      defaultValue: language === 'zh' ? '进入扩展管理' : 'Open Extensions',
    }),
    clearDomainData: t('settings_diagnostics.page.clear_domain_data', {
      defaultValue: language === 'zh' ? '清理当前领域数据' : 'Clear current domain data',
    }),
    clearExtensions: t('settings_diagnostics.page.clear_extensions', {
      defaultValue: language === 'zh' ? '清理扩展缓存' : 'Clear extension cache',
    }),
    done: t('settings_home.primary_action', {
      defaultValue: language === 'zh' ? '完成' : 'Done',
    }),
    notificationUnknown: t('settings_diagnostics.notification_status.unknown', {
      defaultValue: language === 'zh' ? '未检查' : 'Unknown',
    }),
    notificationBrowser: t('settings_diagnostics.notification_status.browser', {
      defaultValue: language === 'zh' ? '浏览器环境' : 'Browser environment',
    }),
    syncing: t('settings_diagnostics.sync.syncing', {
      defaultValue: language === 'zh' ? '同步中...' : 'Syncing...',
    }),
    syncSuccess: t('settings_diagnostics.sync.sync_success', {
      defaultValue: language === 'zh' ? '推荐扩展同步完成' : 'Recommended extensions synced.',
    }),
    domainCleared: t('settings_diagnostics.sync.domain_cleared', {
      defaultValue: language === 'zh' ? '当前领域数据已清理' : 'Current domain data cleared.',
    }),
    syncNotRun: t('settings_diagnostics.sync.not_run', {
      defaultValue: language === 'zh' ? '尚未执行同步。' : 'No sync has been run yet.',
    }),
    extensionCacheCleared: t('settings_diagnostics.sync.extension_cache_cleared', {
      defaultValue: language === 'zh' ? '扩展缓存已清理。' : 'Extension cache cleared.',
    }),
    automation: t('settings_diagnostics.automation.automation', {
      defaultValue: language === 'zh' ? '自动执行' : 'Automation',
    }),
    background: t('settings_diagnostics.automation.background', {
      defaultValue: language === 'zh' ? '后台运行' : 'Background',
    }),
    permissionPrompt: t('settings_diagnostics.notification_status.prompt', {
      defaultValue: language === 'zh' ? '待授权' : 'Prompt',
    }),
    permissionGranted: t('settings_diagnostics.notification_status.granted', {
      defaultValue: language === 'zh' ? '已授权' : 'Granted',
    }),
    permissionDenied: t('settings_diagnostics.notification_status.denied', {
      defaultValue: language === 'zh' ? '已拒绝' : 'Denied',
    }),
  };

  const formatNotificationStatus = React.useCallback(
    (status: string) => {
      if (status === 'granted') {
        return copy.permissionGranted;
      }
      if (status === 'denied') {
        return copy.permissionDenied;
      }
      if (status === 'prompt') {
        return copy.permissionPrompt;
      }
      return status;
    },
    [copy.permissionDenied, copy.permissionGranted, copy.permissionPrompt],
  );

  React.useEffect(() => {
    const checkNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        const permission = await LocalNotifications.checkPermissions();
        setNotificationStatus(formatNotificationStatus(permission.display));
        return;
      }
      setNotificationStatus(copy.notificationBrowser);
    };
    void checkNotifications();
  }, [copy.notificationBrowser, formatNotificationStatus]);

  const handleSyncRecommended = React.useCallback(async () => {
    setSyncStatus(copy.syncing);
    try {
      await syncRecommendedExtensions();
      setSyncStatus(copy.syncSuccess);
    } catch (error) {
      setSyncStatus(
        t('settings_diagnostics.sync.sync_failed', {
          defaultValue:
            language === 'zh' ? '同步失败：{{message}}' : 'Sync failed: {{message}}',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }, [copy.syncSuccess, copy.syncing, language, t]);

  const handleClearDomainData = React.useCallback(async () => {
    await Promise.all([
      clearHistoryByDomain(state.settings.activeDomainId),
      clearResumeStateByDomain(state.settings.activeDomainId),
      clearSavedSubjectsByDomain(state.settings.activeDomainId),
    ]);
    setSyncStatus(copy.domainCleared);
  }, [copy.domainCleared, state.settings.activeDomainId]);

  return (
    <WorkspaceShell
      language={language}
      section="settings"
      title={copy.title}
      subtitle={copy.subtitle}
      headerActions={
        <Button
          variant="secondary"
          size="sm"
          className="rounded-2xl"
          onClick={() => void goBack('/settings')}
        >
          {copy.done}
        </Button>
      }
    >
      {model.sections.map((section) => (
        <DiagnosticsSection
          key={section.id}
          title={section.title}
          description={section.description}
        >
          {section.id === 'connection_checks' ? (
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <Button className="rounded-2xl" onClick={() => openRoute('/settings/connections')}>
                  {copy.openConnections}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {section.id === 'sync_status' ? (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="text-sm text-[var(--mf-text-muted)]">
                  {syncStatus || copy.syncNotRun}
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => scheduleNativeAutomationSync('diagnostics_manual_sync')}
                >
                  {copy.syncNow}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {section.id === 'extensions_sync' ? (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <Button className="rounded-2xl" onClick={() => void handleSyncRecommended()}>
                  {copy.syncNow}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => openRoute('/extensions')}
                >
                  {copy.openExtensions}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {section.id === 'notification_checks' ? (
            <Card>
              <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
                {notificationStatus || copy.notificationUnknown}
              </CardContent>
            </Card>
          ) : null}

          {section.id === 'automation_checks' ? (
            <Card>
              <CardContent className="space-y-2 p-4 text-sm text-[var(--mf-text-muted)]">
                <div>
                  {copy.automation}: {String(state.settings.enableAutomation)}
                </div>
                <div>
                  {copy.background}: {String(state.settings.enableBackgroundMode)}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {section.id === 'maintenance' ? (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void handleClearDomainData()}
                >
                  {copy.clearDomainData}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    clearExtensionStore();
                    clearInstalledDomainPacks();
                    setSyncStatus(copy.extensionCacheCleared);
                  }}
                >
                  {copy.clearExtensions}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </DiagnosticsSection>
      ))}
    </WorkspaceShell>
  );
}
