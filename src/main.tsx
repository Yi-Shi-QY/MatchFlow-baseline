import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n/config';
import { bootstrapExtensionRegistryValidation } from './services/extensions/bootstrap';

bootstrapExtensionRegistryValidation();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
