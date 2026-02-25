/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import MatchDetail from './pages/MatchDetail';
import Share from './pages/Share';
import Scan from './pages/Scan';
import Settings from './pages/Settings';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { App as CapacitorApp } from '@capacitor/app';

function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
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
        <AppRoutes />
      </Router>
    </AnalysisProvider>
  );
}
