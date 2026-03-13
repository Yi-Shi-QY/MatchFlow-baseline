/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, Component, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { getSettings } from './services/settings';
import { buildSubjectRoute } from './services/navigation/subjectRoute';
import {
  kickAutomationRuntime,
  setAutomationRuntimeAppActive,
  startAutomationRuntime,
  stopAutomationRuntime,
} from './services/automation/runtimeCoordinator';
import {
  addNativeAutomationWakeListener,
  consumePendingNativeAutomationWakeEvents,
  scheduleNativeAutomationSync,
} from './services/automation/nativeScheduler';
import { startAndroidAutomationForegroundHost } from './services/automation/androidAutomationHost';

const MatchDetail = lazy(() => import('./pages/MatchDetail'));
const Share = lazy(() => import('./pages/Share'));
const Scan = lazy(() => import('./pages/Scan'));
const Settings = lazy(() => import('./pages/Settings'));
const ExtensionsHub = lazy(() => import('./pages/ExtensionsHub'));
const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const Automation = lazy(() => import('./pages/Automation'));
const DataSources = lazy(() => import('./pages/DataSources'));
const History = lazy(() => import('./pages/History'));
const Memory = lazy(() => import('./pages/Memory'));
const MemoryDetail = lazy(() => import('./pages/MemoryDetail'));
const ConnectionDataSettings = lazy(() => import('./pages/settings/ConnectionDataSettings'));
const AdvancedDiagnostics = lazy(() => import('./pages/settings/AdvancedDiagnostics'));

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-xl font-bold text-red-500 mb-4">Something went wrong</h1>
          <pre className="text-xs text-zinc-500 bg-zinc-900 p-4 rounded overflow-auto max-w-full">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 bg-emerald-600 px-6 py-2 rounded-full text-sm font-bold"
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppRoutes() {
  const navigate = useNavigate();
  const routeFallback = (
    <div className="min-h-screen bg-black text-zinc-400 flex items-center justify-center text-sm">
      Loading page...
    </div>
  );

  useEffect(() => {
    startAutomationRuntime();
    scheduleNativeAutomationSync('app_startup');
    setAutomationRuntimeAppActive(
      typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
    );

    const stopAutomationForegroundHost = startAndroidAutomationForegroundHost();

    let nativeWakeListener: PluginListenerHandle | null = null;
    void consumePendingNativeAutomationWakeEvents().then((events) => {
      events.forEach((event) => {
        kickAutomationRuntime(`native_wake:${event.kind}`);
      });
    });
    void addNativeAutomationWakeListener((event) => {
      kickAutomationRuntime(`native_wake:${event.kind}`);
    }).then((listener) => {
      nativeWakeListener = listener;
    });

    const checkAndRequestPermissions = async () => {
      if (Capacitor.isNativePlatform()) {
        const settings = getSettings();
        if (settings.enableBackgroundMode) {
          const permission = await LocalNotifications.checkPermissions();
          if (permission.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }
        }
      }
    };
    checkAndRequestPermissions();

    // Handle hardware back button on Android
    const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        navigate(-1);
      } else {
        CapacitorApp.exitApp();
      }
    });

    const notificationTapListener = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (event: any) => {
        const subjectId = event?.notification?.extra?.subjectId;
        const domainId = event?.notification?.extra?.domainId;
        const route = event?.notification?.extra?.route;

        if (typeof route === 'string' && route.startsWith('/')) {
          navigate(route);
          return;
        }
        if (
          typeof subjectId === 'string' &&
          subjectId.trim().length > 0 &&
          typeof domainId === 'string' &&
          domainId.trim().length > 0
        ) {
          navigate(buildSubjectRoute(domainId, subjectId));
          return;
        }
        navigate('/');
      }
    );

    const handleVisibilityChange = () => {
      setAutomationRuntimeAppActive(document.visibilityState !== 'hidden');
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    const appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      setAutomationRuntimeAppActive(Boolean(isActive));
    });

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      backButtonListener.then(listener => listener.remove());
      notificationTapListener.then(listener => listener.remove());
      appStateListener.then(listener => listener.remove());
      void nativeWakeListener?.remove();
      stopAutomationForegroundHost();
      stopAutomationRuntime();
    };
  }, [navigate]);

  return (
    <Suspense fallback={routeFallback}>
      <Routes>
        <Route path="/" element={<CommandCenter />} />
        <Route path="/sources" element={<DataSources />} />
        <Route path="/tasks" element={<Automation />} />
        <Route path="/history" element={<History />} />
        <Route path="/memory" element={<Memory />} />
        <Route path="/memory/:memoryId" element={<MemoryDetail />} />
        <Route path="/subject/:domainId/:subjectId" element={<MatchDetail />} />
        <Route path="/share" element={<Share />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/connections" element={<ConnectionDataSettings />} />
        <Route path="/settings/diagnostics" element={<AdvancedDiagnostics />} />
        <Route path="/extensions" element={<ExtensionsHub />} />
        <Route path="/automation" element={<Automation />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AnalysisProvider>
      <Router>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </Router>
    </AnalysisProvider>
  );
}
