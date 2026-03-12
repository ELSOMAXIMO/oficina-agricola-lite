import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

const bootWindow = window as Window & { __APP_BOOTSTRAPPED__?: boolean };
bootWindow.__APP_BOOTSTRAPPED__ = true;
document.body.dataset.appMounted = 'true';
sessionStorage.removeItem('oficina-app-bootstrap-recovery');

console.log("[CLIENT] Starting React application...");
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
