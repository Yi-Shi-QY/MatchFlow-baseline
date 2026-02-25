/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import MatchDetail from './pages/MatchDetail';
import Share from './pages/Share';
import Scan from './pages/Scan';
import Settings from './pages/Settings';
import { AnalysisProvider } from './contexts/AnalysisContext';

export default function App() {
  return (
    <AnalysisProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/match/:id" element={<MatchDetail />} />
          <Route path="/share" element={<Share />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Router>
    </AnalysisProvider>
  );
}
