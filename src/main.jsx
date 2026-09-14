import { createRoot } from 'react-dom/client';
import { StoreProvider } from './state/store.jsx';
import AppShell from './AppShell.jsx';
import './state/legacyBridges.js';

createRoot(document.getElementById('root')).render(
  <StoreProvider>
    <AppShell />
  </StoreProvider>
);
