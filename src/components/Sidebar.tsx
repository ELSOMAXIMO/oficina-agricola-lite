import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  FileText, 
  Calculator, 
  Calendar, 
  BarChart3, 
  Settings, 
  LogOut,
  Tractor,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Package,
  MessageSquare
} from 'lucide-react';
import { View, Usuario } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  isCollapsed, 
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen
}) => {
  const { role, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'veiculos', label: 'Veículos', icon: Truck },
    { id: 'pecas', label: 'Peças', icon: Package },
    { id: 'ordens', label: 'Ordens Serviço', icon: FileText },
    { id: 'orcamentos', label: 'Orçamentos', icon: Calculator },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'configuracoes', label: 'Configurações', icon: Settings, hidden: role === 'tecnico' },
  ].filter(item => !item.hidden);

  const SidebarContent = () => (
    <div className={cn(
      "flex flex-col h-full transition-all duration-300",
      isCollapsed ? "w-20" : "w-72"
    )}>
      <div className="p-4 flex flex-col h-full">
        <div className={cn(
          "bg-emerald-600 rounded-2xl p-3 text-white flex items-center gap-3 shadow-lg shadow-emerald-100 mb-8 transition-all duration-300 overflow-hidden",
          isCollapsed ? "justify-center" : ""
        )}>
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <Tractor className="w-6 h-6" />
          </div>
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="whitespace-nowrap"
            >
              <h1 className="font-bold text-base leading-tight uppercase tracking-wider">Oficina Agrícola</h1>
              <p className="text-[10px] text-emerald-100 font-medium">Máquinas e Equipamentos</p>
            </motion.div>
          )}
        </div>

        <nav className="space-y-2 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id as View);
                  setIsMobileOpen(false);
                }}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 font-medium text-sm relative group",
                  isActive 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  isCollapsed ? "justify-center" : ""
                )}
              >
                <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-emerald-600" : "text-slate-400")} />
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-100">
          <button 
            onClick={logout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all font-medium text-sm",
              isCollapsed ? "justify-center" : ""
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>Sair</span>}
          </button>
          
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex mt-4 w-full items-center justify-center p-2 rounded-lg bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <Tractor className="w-6 h-6 text-emerald-600" />
          <span className="font-bold text-slate-900 uppercase tracking-wider text-sm">Oficina Agrícola</span>
        </div>
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-lg bg-slate-50 text-slate-600"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block bg-white border-r border-slate-200 h-screen sticky top-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-50 md:hidden shadow-2xl"
            >
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => setIsMobileOpen(false)}
                  className="p-2 rounded-full bg-slate-50 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
