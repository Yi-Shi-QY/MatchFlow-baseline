/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import MatchDetail from './pages/MatchDetail';
import Share from './pages/Share';
import Scan from './pages/Scan';
import Settings from './pages/Settings';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getSettings } from './services/settings';

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

    return () => {
      backButtonListener.then(listener => listener.remove());
    };
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/match/:id" element={<MatchDetail />} />
      <Route path="/share" element={<Share />} />
      <Route path="/scan" element={<Scan />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
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
