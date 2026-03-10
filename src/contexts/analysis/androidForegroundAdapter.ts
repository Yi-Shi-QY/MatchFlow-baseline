import React from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getSettings } from '@/src/services/settings';
import {
  startOrUpdateAndroidForegroundExecution,
  stopAndroidForegroundExecution,
} from '@/src/services/background/androidForegroundExecution';
import type { ActiveAnalysis } from './types';
import { buildAndroidForegroundServicePayload } from './androidForegroundStatus';

function isAndroidNativePlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function useAndroidForegroundExecution(
  activeAnalyses: Record<string, ActiveAnalysis>,
) {
  const [isAppActive, setIsAppActive] = React.useState(true);
  const lastDedupeKeyRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!isAndroidNativePlatform()) return;

    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      setIsAppActive(Boolean(isActive));
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, []);

  React.useEffect(() => {
    if (!isAndroidNativePlatform()) return;

    const syncForegroundExecution = async () => {
      const settings = getSettings();
      const shouldUseForegroundExecution = settings.enableBackgroundMode && !isAppActive;
      if (!shouldUseForegroundExecution) {
        lastDedupeKeyRef.current = '';
        await stopAndroidForegroundExecution();
        return;
      }

      const payload = buildAndroidForegroundServicePayload(activeAnalyses);
      if (!payload) {
        lastDedupeKeyRef.current = '';
        await stopAndroidForegroundExecution();
        return;
      }

      if (payload.dedupeKey === lastDedupeKeyRef.current) {
        return;
      }

      lastDedupeKeyRef.current = payload.dedupeKey;
      await startOrUpdateAndroidForegroundExecution({
        title: payload.title,
        text: payload.text,
        useWakeLock: payload.useWakeLock,
      });
    };

    void syncForegroundExecution();
  }, [activeAnalyses, isAppActive]);

  React.useEffect(() => {
    if (!isAndroidNativePlatform()) return;

    const intervalId = window.setInterval(() => {
      const settings = getSettings();
      const shouldUseForegroundExecution = settings.enableBackgroundMode && !isAppActive;
      if (!shouldUseForegroundExecution) {
        return;
      }

      const payload = buildAndroidForegroundServicePayload(activeAnalyses);
      if (!payload) {
        return;
      }

      void startOrUpdateAndroidForegroundExecution({
        title: payload.title,
        text: payload.text,
        useWakeLock: payload.useWakeLock,
      });
    }, 60_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeAnalyses, isAppActive]);

  React.useEffect(() => {
    if (!isAndroidNativePlatform()) return;
    return () => {
      void stopAndroidForegroundExecution();
    };
  }, []);
}
