import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Tractor, 
  FileText, 
  Calendar, 
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { logout, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'veiculos', label: 'Veículos', icon: Tractor },
    { id: 'os', label: 'OS', icon: FileText },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'config', label: 'Ajustes', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Tractor className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-slate-800 text-lg">Auto Mecânica</h1>
        </div>
        
        <div className="flex items-center gap-3">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-200" />
          ) : (
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
              <Users className="w-4 h-4 text-slate-500" />
            </div>
          )}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isMenuOpen ? <X className="w-6 h-6 text-slate-600" /> : <Menu className="w-6 h-6 text-slate-600" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-4"
        >
          {children}
        </motion.div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-1 flex justify-around items-center z-40 safe-area-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-all ${
                isActive ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -top-1 w-12 h-1 bg-blue-600 rounded-full"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Side Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="relative w-64 bg-white h-full shadow-2xl p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-bold text-slate-800">Menu</h2>
              <button onClick={() => setIsMenuOpen(false)} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl mb-6">
                <p className="text-xs text-slate-500 mb-1">Logado como</p>
                <p className="font-semibold text-slate-800 truncate">{user?.displayName || user?.email}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>

              <button 
                onClick={() => { setActiveTab('config'); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-slate-700 transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span>Configurações</span>
              </button>
            </div>

            <button 
              onClick={() => { logout(); setIsMenuOpen(false); }}
              className="w-full flex items-center gap-3 p-3 hover:bg-red-50 text-red-600 rounded-xl transition-colors mt-auto"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sair do Sistema</span>
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};
