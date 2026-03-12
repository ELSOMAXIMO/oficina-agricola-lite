/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileLayout } from './components/MobileLayout';
import { Dashboard } from './components/Dashboard';
import { ClientesView } from './components/ClientesView';
import { VeiculosView } from './components/VeiculosView';
import { OrdensServicoView } from './components/OrdensServicoView';
import { OrcamentosView } from './components/OrcamentosView';
import { AgendaView } from './components/AgendaView';
import { RelatoriosView } from './components/RelatoriosView';
import { ConfiguracoesView } from './components/ConfiguracoesView';
import { PecasView } from './components/PecasView';
import { Login } from './components/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { View } from './types';
import { Toaster } from 'react-hot-toast';

import { WifiOff } from 'lucide-react';

function AppContent() {
  const { user, role, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [createRequest, setCreateRequest] = useState<{ view: View; nonce: number } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Redirect if technician tries to access settings
  React.useEffect(() => {
    if (role === 'tecnico' && currentView === 'configuracoes') {
      setCurrentView('dashboard');
    }
  }, [role, currentView]);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleViewChange = (view: View) => {
    setCurrentView(view);
    setCreateRequest(null);
  };

  const handleCreateRequest = (view: 'ordens' | 'clientes' | 'veiculos' | 'agenda' | 'orcamentos') => {
    setCurrentView(view);
    setCreateRequest({ view, nonce: Date.now() });
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewChange={handleViewChange} onCreateRequest={handleCreateRequest} />;
      case 'clientes':
        return <ClientesView openCreateSignal={createRequest?.view === 'clientes' ? createRequest.nonce : 0} />;
      case 'veiculos':
        return <VeiculosView openCreateSignal={createRequest?.view === 'veiculos' ? createRequest.nonce : 0} />;
      case 'ordens':
        return <OrdensServicoView openCreateSignal={createRequest?.view === 'ordens' ? createRequest.nonce : 0} />;
      case 'orcamentos':
        return <OrcamentosView openCreateSignal={createRequest?.view === 'orcamentos' ? createRequest.nonce : 0} />;
      case 'agenda':
        return <AgendaView openCreateSignal={createRequest?.view === 'agenda' ? createRequest.nonce : 0} />;
      case 'relatorios':
        return <RelatoriosView />;
      case 'pecas':
        return <PecasView />;
      case 'configuracoes':
        return <ConfiguracoesView />;
      default:
        return <Dashboard onViewChange={handleViewChange} onCreateRequest={handleCreateRequest} />;
    }
  };

  if (isMobile) {
    return (
      <MobileLayout activeTab={currentView === 'ordens' ? 'os' : currentView === 'configuracoes' ? 'config' : currentView} setActiveTab={(tab) => {
        if (tab === 'os') handleViewChange('ordens');
        else if (tab === 'config') handleViewChange('configuracoes');
        else handleViewChange(tab as View);
      }}>
        {!isOnline && (
          <div className="bg-amber-500 text-white px-4 py-2 text-[10px] font-bold flex items-center justify-center gap-2 rounded-lg mb-4">
            <WifiOff className="w-3 h-3" />
            Modo Offline Ativo
          </div>
        )}
        {renderView()}
      </MobileLayout>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar 
        currentView={currentView} 
        onViewChange={handleViewChange} 
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />
      <main className="flex-1 overflow-auto pt-16 md:pt-0 relative">
        {!isOnline && (
          <div className="bg-amber-500 text-white px-4 py-1 text-xs font-bold flex items-center justify-center gap-2 sticky top-0 z-50">
            <WifiOff className="w-3 h-3" />
            Modo Offline: Os dados estão sendo salvos localmente e serão sincronizados quando a internet voltar.
          </div>
        )}
        {renderView()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-right" />
      </AuthProvider>
    </ErrorBoundary>
  );
}



