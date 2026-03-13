import React from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function AdvancedDiagnostics() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const state = useSettingsState();
  const model = React.useMemo(
    () =>
      deriveDiagnosticsModel({
        settings: state.settings,
        language,
      }),
    [language, state.settings],
  );
  const [notificationStatus, setNotificationStatus] = React.useState(
    language === 'zh' ? '未检查' : 'Unknown',
  );
  const [syncStatus, setSyncStatus] = React.useState('');

  React.useEffect(() => {
    const checkNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        const permission = await LocalNotifications.checkPermissions();
        setNotificationStatus(permission.display);
        return;
      }
      setNotificationStatus(language === 'zh' ? '浏览器环境' : 'Browser environment');
    };
    void checkNotifications();
  }, [language]);

  const copy =
    language === 'zh'
      ? {
          title: '高级与诊断',
          subtitle: '这里保留正式产品可理解的检查、同步、扩展与维护入口。',
          syncNow: '立即同步',
          openConnections: '进入连接与数据',
          openExtensions: '进入扩展管理',
          clearDomainData: '清理当前领域数据',
          clearExtensions: '清理扩展缓存',
        }
      : {
          title: 'Advanced & Diagnostics',
          subtitle:
            'This page keeps the formal checks, sync actions, extension entry, and maintenance tools.',
          syncNow: 'Sync now',
          openConnections: 'Open Connections & Data',
          openExtensions: 'Open Extensions',
          clearDomainData: 'Clear current domain data',
          clearExtensions: 'Clear extension cache',
        };

  const handleSyncRecommended = React.useCallback(async () => {
    setSyncStatus(language === 'zh' ? '同步中…' : 'Syncing...');
    try {
      await syncRecommendedExtensions();
      setSyncStatus(language === 'zh' ? '推荐扩展同步完成' : 'Recommended extensions synced.');
    } catch (error) {
      setSyncStatus(
        language === 'zh'
          ? `同步失败：${error instanceof Error ? error.message : String(error)}`
          : `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [language]);

  const handleClearDomainData = React.useCallback(async () => {
    await Promise.all([
      clearHistoryByDomain(state.settings.activeDomainId),
      clearResumeStateByDomain(state.settings.activeDomainId),
      clearSavedSubjectsByDomain(state.settings.activeDomainId),
    ]);
    setSyncStatus(language === 'zh' ? '当前领域数据已清理' : 'Current domain data cleared.');
  }, [language, state.settings.activeDomainId]);

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
      {model.sections.map((section) => (
        <DiagnosticsSection
          key={section.id}
          title={section.title}
          description={section.description}
        >
          {section.id === 'connection_checks' ? (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <Button className="rounded-2xl" onClick={() => navigate('/settings/connections')}>
                  {copy.openConnections}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {section.id === 'sync_status' ? (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="text-sm text-[var(--mf-text-muted)]">
                  {syncStatus || (language === 'zh' ? '尚未执行同步。' : 'No sync has been run yet.')}
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
                <Button variant="outline" className="rounded-2xl" onClick={() => navigate('/extensions')}>
                  {copy.openExtensions}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {section.id === 'notification_checks' ? (
            <Card>
              <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
                {notificationStatus}
              </CardContent>
            </Card>
          ) : null}

          {section.id === 'automation_checks' ? (
            <Card>
              <CardContent className="space-y-2 p-4 text-sm text-[var(--mf-text-muted)]">
                <div>
                  {language === 'zh' ? '自动执行' : 'Automation'}: {String(state.settings.enableAutomation)}
                </div>
                <div>
                  {language === 'zh' ? '后台运行' : 'Background'}: {String(state.settings.enableBackgroundMode)}
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
                    setSyncStatus(
                      language === 'zh'
                        ? '扩展缓存已清理'
                        : 'Extension cache cleared.',
                    );
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
