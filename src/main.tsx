import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AnalysisProvider } from './context/AnalysisContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnalysisProvider>
      <App />
    </AnalysisProvider>
  </StrictMode>,
);
