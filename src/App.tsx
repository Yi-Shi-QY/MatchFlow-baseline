/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, Component, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getSettings } from './services/settings';
import { buildLegacyMatchRoute, buildSubjectRoute } from './services/navigation/subjectRoute';

const MatchDetail = lazy(() => import('./pages/MatchDetail'));
const Share = lazy(() => import('./pages/Share'));
const Scan = lazy(() => import('./pages/Scan'));
const Settings = lazy(() => import('./pages/Settings'));
const ExtensionsHub = lazy(() => import('./pages/ExtensionsHub'));

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
        const matchId = event?.notification?.extra?.matchId;
        const domainId = event?.notification?.extra?.domainId;
        const route = event?.notification?.extra?.route;

        if (typeof matchId === 'string' && matchId.trim().length > 0) {
          if (typeof domainId === 'string' && domainId.trim().length > 0) {
            navigate(buildSubjectRoute(domainId, matchId));
            return;
          }
          navigate(buildLegacyMatchRoute(matchId));
          return;
        }
        if (typeof route === 'string' && route.startsWith('/')) {
          navigate(route);
          return;
        }
        navigate('/');
      }
    );

    return () => {
      backButtonListener.then(listener => listener.remove());
      notificationTapListener.then(listener => listener.remove());
    };
  }, [navigate]);

  return (
    <Suspense fallback={routeFallback}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/match/:id" element={<MatchDetail />} />
        <Route path="/subject/:domainId/:subjectId" element={<MatchDetail />} />
        <Route path="/share" element={<Share />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/extensions" element={<ExtensionsHub />} />
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
