import React from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getSettings } from '@/src/services/settings';
import { buildSubjectRoute } from '@/src/services/navigation/subjectRoute';
import type { ActiveAnalysis } from './types';

export function useAnalysisBackgroundNotification(
  activeAnalyses: Record<string, ActiveAnalysis>,
) {
  const lastNotificationKeyRef = React.useRef<string>('');
  const lastNotificationAtRef = React.useRef<number>(0);

  React.useEffect(() => {
    const updateNotification = async () => {
      if (!Capacitor.isNativePlatform()) return;

      const settings = getSettings();
      if (!settings.enableBackgroundMode) return;

      const analyzingMatches = Object.values(activeAnalyses).filter((a) => a.isAnalyzing);

      if (analyzingMatches.length > 0) {
        const additionalCount = Math.max(0, analyzingMatches.length - 1);
        const firstMatch = analyzingMatches[0];
        const segments = firstMatch.parsedStream?.segments || [];
        const lastSegment = segments[segments.length - 1];
        const language = settings.language === 'zh' ? 'zh' : 'en';
        const completedFromSegments = segments.filter((seg) => seg.isThoughtComplete).length;
        const totalSegments =
          firstMatch.planTotalSegments > 0
            ? firstMatch.planTotalSegments
            : Math.max(segments.length, completedFromSegments, 1);
        const completedSegments = Math.min(
          totalSegments,
          Math.max(firstMatch.planCompletedSegments, completedFromSegments),
        );
        const progressPercent =
          totalSegments > 0
            ? Math.min(99, Math.floor((completedSegments / totalSegments) * 100))
            : 0;
        const status = lastSegment
          ? lastSegment.title || (language === 'zh' ? '处理中...' : 'Processing...')
          : language === 'zh'
            ? '启动中...'
            : 'Starting...';

        const title =
          language === 'zh'
            ? `MatchFlow 后台分析中 (${analyzingMatches.length} 场)`
            : `MatchFlow Analysis Running (${analyzingMatches.length})`;
        const bodyLines = [
          `${firstMatch.match.homeTeam.name} vs ${firstMatch.match.awayTeam.name}`,
          language === 'zh'
            ? `进度：${completedSegments}/${totalSegments} (${progressPercent}%)`
            : `Progress: ${completedSegments}/${totalSegments} (${progressPercent}%)`,
          language === 'zh' ? `当前：${status}` : `Current: ${status}`,
          additionalCount > 0
            ? language === 'zh'
              ? `另有 ${additionalCount} 场分析进行中`
              : `+${additionalCount} more matches in progress`
            : '',
        ].filter(Boolean);
        const body = bodyLines.join('\n');

        const notificationKey = `${firstMatch.domainId}::${firstMatch.subjectId}|${completedSegments}|${totalSegments}|${status}|${additionalCount}|${language}`;
        const now = Date.now();
        if (
          notificationKey === lastNotificationKeyRef.current &&
          now - lastNotificationAtRef.current < 1200
        ) {
          return;
        }
        lastNotificationKeyRef.current = notificationKey;
        lastNotificationAtRef.current = now;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: 1001,
              title,
              body,
              ongoing: true,
              autoCancel: false,
              schedule: { at: new Date(Date.now() + 100) },
              extra: {
                subjectId: firstMatch.subjectId,
                domainId: firstMatch.domainId,
                route: buildSubjectRoute(firstMatch.domainId, firstMatch.subjectId),
              } as any,
            },
          ],
        });
      } else {
        try {
          await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
          lastNotificationKeyRef.current = '';
          lastNotificationAtRef.current = 0;
        } catch (e) {
          // Ignore error if notification doesn't exist.
        }
      }
    };

    void updateNotification();
  }, [activeAnalyses]);
}
