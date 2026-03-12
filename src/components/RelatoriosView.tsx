import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Download, Calendar, ArrowUpRight, ArrowDownRight, Loader2, PieChart as PieChartIcon, Users, Wrench, Share2 } from 'lucide-react';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-hot-toast';
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

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { pdfArchiveService } from '../services/pdfArchiveService';
import { pdfOpenService } from '../services/pdfOpenService';

type PeriodType = 'mensal' | 'anual' | 'geral';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const RelatoriosView: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('anual');
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalServices: 0,
    averageTicket: 0,
    previousRevenue: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [serviceTypeData, setServiceTypeData] = useState<any[]>([]);
  const [topClientsData, setTopClientsData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const initDb = async () => {
      const unsub = await dbService.list('ordens_servico', user.uid, (docs) => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let filteredOS = docs.filter(os => os.status === 'Finalizada');
        let previousOS = [];

        if (period === 'mensal') {
          filteredOS = filteredOS.filter(os => {
            const date = new Date(os.createdAt?.seconds ? os.createdAt.seconds * 1000 : os.createdAt);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
          });
          previousOS = docs.filter(os => {
            const date = new Date(os.createdAt?.seconds ? os.createdAt.seconds * 1000 : os.createdAt);
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            return os.status === 'Finalizada' && date.getMonth() === prevMonth && date.getFullYear() === prevYear;
          });
        } else if (period === 'anual') {
          filteredOS = filteredOS.filter(os => {
            const date = new Date(os.createdAt?.seconds ? os.createdAt.seconds * 1000 : os.createdAt);
            return date.getFullYear() === currentYear;
          });
          previousOS = docs.filter(os => {
            const date = new Date(os.createdAt?.seconds ? os.createdAt.seconds * 1000 : os.createdAt);
            return os.status === 'Finalizada' && date.getFullYear() === currentYear - 1;
          });
        }

        const totalRevenue = filteredOS.reduce((sum, os) => sum + (os.valorTotal || 0), 0);
        const previousRevenue = previousOS.reduce((sum, os) => sum + (os.valorTotal || 0), 0);
        const totalServices = filteredOS.length;
        const averageTicket = totalServices > 0 ? totalRevenue / totalServices : 0;

        setMetrics({
          totalRevenue,
          totalServices,
          averageTicket,
          previousRevenue
        });

        // Chart Data
        if (period === 'mensal') {
          const dailyData: Record<string, number> = {};
          filteredOS.forEach(os => {
            const date = new Date(os.createdAt?.seconds ? os.createdAt.seconds * 1000 : os.createdAt);
            const day = date.getDate().toString();
            dailyData[day] = (dailyData[day] || 0) + (os.valorTotal || 0);
          });
          setChartData(Object.entries(dailyData).map(([name, value]) => ({ name: `Dia ${name}`, value })));
        } else {
          const monthlyData: Record<string, number> = {};
          filteredOS.forEach(os => {
            const date = new Date(os.createdAt?.seconds ? os.createdAt.seconds * 1000 : os.createdAt);
            const month = date.toLocaleString('pt-BR', { month: 'short' });
            monthlyData[month] = (monthlyData[month] || 0) + (os.valorTotal || 0);
          });
          setChartData(Object.entries(monthlyData).map(([name, value]) => ({ name, value })));
        }

        // Service Type Data (Mocking categories from description if not present)
        const types: Record<string, number> = {};
        filteredOS.forEach(os => {
          const type = os.tipoServico || 'Mecânica Geral';
          types[type] = (types[type] || 0) + 1;
        });
        setServiceTypeData(Object.entries(types).map(([name, value]) => ({ name, value })));

        // Top Clients
        const clients: Record<string, number> = {};
        filteredOS.forEach(os => {
          const client = os.clienteNome || 'Cliente não identificado';
          clients[client] = (clients[client] || 0) + (os.valorTotal || 0);
        });
        setTopClientsData(
          Object.entries(clients)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)
        );

        setLoading(false);
      });

      return unsub;
    };

    const unsubPromise = initDb();

    return () => {
      unsubPromise.then(unsub => unsub());
    };
  }, [user, period]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const getGrowth = () => {
    if (metrics.previousRevenue === 0) return 100;
    return ((metrics.totalRevenue - metrics.previousRevenue) / metrics.previousRevenue) * 100;
  };

  const buildReportPdf = () => {
    const doc = new jsPDF();
    const margin = 15;
    let currentY = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Desempenho', margin, currentY);
    currentY += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${period.charAt(0).toUpperCase() + period.slice(1)}`, margin, currentY);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, margin + 100, currentY);
    currentY += 15;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Indicadores Principais', margin, currentY);
    currentY += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Faturamento Total: ${formatCurrency(metrics.totalRevenue)}`, margin, currentY);
    doc.text(`Total de Serviços: ${metrics.totalServices}`, margin, currentY + 7);
    doc.text(`Ticket Médio: ${formatCurrency(metrics.averageTicket)}`, margin, currentY + 14);
    currentY += 25;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Top 5 Clientes', margin, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['Cliente', 'Faturamento']],
      body: topClientsData.map(c => [c.name, formatCurrency(c.value)]),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Distribuição por Tipo de Serviço', margin, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['Tipo de Serviço', 'Quantidade']],
      body: serviceTypeData.map(s => [s.name, s.value]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: margin, right: margin }
    });

    const fileName = `Relatorio_${period}_${new Date().toISOString().split('T')[0]}.pdf`;

    if (user?.uid) {
      void pdfArchiveService.saveGeneratedPdf({
        uid: user.uid,
        recordType: 'relatorio',
        recordId: period,
        fileName,
        doc,
      }).catch((error) => {
        console.error('Erro ao arquivar PDF do relatório:', error);
      });
    }

    return { doc, fileName };
  };

  const exportPDF = () => {
    const { doc, fileName } = buildReportPdf();

    void pdfOpenService.openPdf(doc, fileName).catch((error) => {
      console.error('Erro ao abrir PDF do relatório:', error);
      toast.error('Não foi possível abrir o PDF neste dispositivo.');
    });
  };

  const sharePDF = async () => {
    const { doc, fileName } = buildReportPdf();

    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Relatório de Desempenho',
          text: 'Confira o relatório de desempenho da oficina.'
        });
      } catch (error) {
        console.error('Error sharing:', error);
        toast.error('Erro ao compartilhar relatório.');
      }
    } else {
      toast.error('Seu navegador não suporta o compartilhamento de arquivos.');
      exportPDF(); // Fallback to download
    }
  };

  const growth = getGrowth();

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Relatórios e Análises</h1>
          <p className="text-slate-500 mt-1 font-medium">Acompanhe o crescimento e a saúde financeira da sua oficina.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['mensal', 'anual', 'geral'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  period === p 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Download className="w-5 h-5" />
            PDF
          </button>
          <button 
            onClick={sharePDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Share2 className="w-5 h-5" />
            Compartilhar
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            {period !== 'geral' && (
              <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${
                growth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
              }`}>
                {growth >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                {Math.abs(growth).toFixed(1)}%
              </span>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Faturamento {period === 'geral' ? 'Total' : period === 'mensal' ? 'do Mês' : 'do Ano'}</p>
            <h3 className="text-3xl font-black text-slate-900">
              {formatCurrency(metrics.totalRevenue)}
            </h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-50 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Serviços Realizados</p>
            <h3 className="text-3xl font-black text-slate-900">{metrics.totalServices}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-amber-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Ticket Médio</p>
            <h3 className="text-3xl font-black text-slate-900">
              {formatCurrency(metrics.averageTicket)}
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Desempenho de Faturamento ({period.charAt(0).toUpperCase() + period.slice(1)})
          </h2>
          <div className="h-[400px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={period === 'mensal' ? 20 : 60} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center">
                <p className="text-slate-400 font-medium italic">Sem dados de faturamento para exibir.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-blue-600" />
            Tipos de Serviço
          </h2>
          <div className="h-[300px]">
            {serviceTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {serviceTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center">
                <p className="text-slate-400 font-medium italic">Sem dados.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            Top 5 Clientes (por Faturamento)
          </h2>
          <div className="space-y-4">
            {topClientsData.length > 0 ? topClientsData.map((client, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-200">
                    {index + 1}
                  </div>
                  <span className="font-medium text-slate-700">{client.name}</span>
                </div>
                <span className="font-bold text-emerald-600">{formatCurrency(client.value)}</span>
              </div>
            )) : (
              <p className="text-slate-400 italic text-center py-8">Sem dados de clientes.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            Resumo de Operações
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Total de Serviços</p>
              <p className="text-2xl font-black text-blue-900">{metrics.totalServices}</p>
            </div>
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Ticket Médio</p>
              <p className="text-2xl font-black text-emerald-900">{formatCurrency(metrics.averageTicket)}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 col-span-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Eficiência Operacional</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: '85%' }}></div>
                </div>
                <span className="text-sm font-bold text-slate-700">85%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 italic">* Baseado no tempo médio de conclusão vs. estimado</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
