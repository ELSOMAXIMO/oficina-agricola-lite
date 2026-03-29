import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Truck, 
  FileText, 
  DollarSign, 
  Calendar,
  Plus,
  UserPlus,
  Tractor,
  Clock,
  Loader2,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { Cliente, Veiculo, OrdemServico, Agendamento } from '../types';
import { formatCurrency } from '../utils/formatters';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-4xl font-bold text-slate-900">{value}</span>
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <span className="text-sm text-slate-500 font-medium">{label}</span>
  </div>
);

interface DashboardProps {
  onViewChange: (view: any) => void;
  onCreateRequest: (view: 'ordens' | 'clientes' | 'veiculos' | 'agenda' | 'orcamentos') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onViewChange, onCreateRequest }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    clientes: 0,
    veiculos: 0,
    ordensAbertas: 0,
    faturamentoMensal: 0,
    agendamentosHoje: 0
  });
  const [statusData, setStatusData] = useState<any[]>([]);
  const [typeData, setTypeData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    if (!user) return;

    let unsubscribers: (() => void)[] = [];

    const loadData = async () => {
      // Clientes
      const unsubClientes = await dbService.list('clientes', user.uid, (docs) => {
        setStats(prev => ({ ...prev, clientes: docs.length }));
      });
      unsubscribers.push(unsubClientes);

      // Veiculos
      const unsubVeiculos = await dbService.list('veiculos', user.uid, (docs) => {
        setStats(prev => ({ ...prev, veiculos: docs.length }));
        
        const types: Record<string, number> = {};
        docs.forEach(doc => {
          const type = doc.tipo || 'Outro';
          types[type] = (types[type] || 0) + 1;
        });
        setTypeData(Object.entries(types).map(([name, value]) => ({ name, value })));
      });
      unsubscribers.push(unsubVeiculos);

      // OS
      const unsubOS = await dbService.list('ordens_servico', user.uid, (docs) => {
        const open = docs.filter(doc => doc.status !== 'Finalizada' && doc.status !== 'Cancelada').length;
        setStats(prev => ({ ...prev, ordensAbertas: open }));

        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyTotal = docs
          .filter(doc => {
            const createdAt = doc.createdAt?.seconds ? doc.createdAt.seconds * 1000 : doc.createdAt;
            const date = new Date(createdAt);
            return doc.status === 'Finalizada' && date >= firstDay;
          })
          .reduce((sum, doc) => sum + (doc.valorTotal || 0), 0);
        setStats(prev => ({ ...prev, faturamentoMensal: monthlyTotal }));

        const statuses: Record<string, number> = {};
        docs.forEach(doc => {
          const status = doc.status;
          statuses[status] = (statuses[status] || 0) + 1;
        });
        setStatusData(Object.entries(statuses).map(([name, value]) => ({ name, value })));

        const recent = [...docs]
          .sort((a, b) => {
            const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
            const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
            return dateB - dateA;
          })
          .slice(0, 5);
        setRecentOrders(recent);
      });
      unsubscribers.push(unsubOS);

      // Agendamentos
      const unsubAgenda = await dbService.list('agendamentos', user.uid, (docs) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const count = docs.filter(doc => doc.data === todayStr).length;
        setStats(prev => ({ ...prev, agendamentosHoje: count }));
        setLoading(false);
      });
      unsubscribers.push(unsubAgenda);
    };

    loadData();

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard - Visão Geral</h1>
        {showInstallBtn && (
          <button 
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all animate-bounce"
          >
            <Download className="w-4 h-4" />
            Instalar Aplicativo
          </button>
        )}
      </header>

      {/* Quick Actions */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <button 
            onClick={() => onCreateRequest('ordens')}
            className="flex items-center justify-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 transition-all group shadow-sm"
          >
            <Plus className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-slate-700 group-hover:text-emerald-700">Nova Ordem de Serviço</span>
          </button>
          <button 
            onClick={() => onCreateRequest('clientes')}
            className="flex items-center justify-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all group shadow-sm"
          >
            <UserPlus className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-slate-700 group-hover:text-blue-700">Novo Cliente</span>
          </button>
          <button 
            onClick={() => onCreateRequest('veiculos')}
            className="flex items-center justify-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:bg-amber-50 hover:border-amber-200 transition-all group shadow-sm"
          >
            <Tractor className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-slate-700 group-hover:text-amber-700">Novo Equipamento</span>
          </button>
          <button 
            onClick={() => onCreateRequest('agenda')}
            className="flex items-center justify-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-all group shadow-sm"
          >
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-slate-700 group-hover:text-indigo-700">Agendar Serviço</span>
          </button>
          <button 
            onClick={() => onCreateRequest('orcamentos')}
            className="flex items-center justify-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:bg-cyan-50 hover:border-cyan-200 transition-all group shadow-sm"
          >
            <FileText className="w-5 h-5 text-cyan-600" />
            <span className="font-semibold text-slate-700 group-hover:text-cyan-700">Adicionar Novo Orçamento</span>
          </button>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Clientes" value={stats.clientes} icon={Users} color="bg-emerald-500" />
        <StatCard label="Equipamentos" value={stats.veiculos} icon={Truck} color="bg-blue-500" />
        <StatCard label="Ordens Abertas" value={stats.ordensAbertas} icon={FileText} color="bg-amber-500" />
        <StatCard 
          label="Faturamento do Mês" 
          value={formatCurrency(stats.faturamentoMensal)} 
          icon={DollarSign} 
          color="bg-emerald-600" 
        />
        <StatCard label="Agendamentos Hoje" value={stats.agendamentosHoje} icon={Calendar} color="bg-indigo-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Ordens por Status</h2>
          <div className="h-[300px]">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm font-medium">Sem dados de ordens</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Equipamentos por Tipo</h2>
          <div className="h-[300px]">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm font-medium">Sem dados de equipamentos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Últimas Ordens de Serviço</h2>
        {recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="pb-4">Número</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentOrders.map((os) => (
                  <tr key={os.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-bold text-slate-700">{os.numero}</td>
                    <td className="py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        {os.status}
                      </span>
                    </td>
                    <td className="py-4 font-bold text-emerald-600">
                      {os.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <p className="text-slate-400 text-sm font-medium">Não há ordens de serviço recentes</p>
          </div>
        )}
      </div>
    </div>
  );
};
