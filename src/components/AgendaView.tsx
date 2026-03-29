import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, User, Plus, Save, Loader2, Edit2, Trash2, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { Agendamento, Cliente, Veiculo, OrdemServico } from '../types';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgendaViewProps {
  openCreateSignal?: number;
}

export const AgendaView: React.FC<AgendaViewProps> = ({ openCreateSignal = 0 }) => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const initialFormData = {
    clienteId: '',
    clienteNome: '',
    veiculoId: '',
    osId: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    hora: format(new Date(), 'HH:mm'),
    descricao: '',
    local: '',
    status: 'Pendente' as Agendamento['status']
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!user) return;

    let unsubscribeClientes = () => {};
    let unsubscribeVeiculos = () => {};
    let unsubscribeAgenda = () => {};
    let unsubscribeOS = () => {};

    const initDb = async () => {
      // Fetch Clientes
      unsubscribeClientes = await dbService.list('clientes', user.uid, (docs) => {
        setClientes(docs as Cliente[]);
      });

      // Fetch Veiculos
      unsubscribeVeiculos = await dbService.list('veiculos', user.uid, (docs) => {
        setVeiculos(docs as Veiculo[]);
      });

      // Fetch OS
      unsubscribeOS = await dbService.list('ordens_servico', user.uid, (docs) => {
        setOrdensServico(docs as OrdemServico[]);
      });

      // Fetch Agendamentos
      unsubscribeAgenda = await dbService.list('agendamentos', user.uid, (docs) => {
        const mappedDocs = docs.map(data => ({
          ...data,
          data: new Date(data.data)
        })) as Agendamento[];
        setAgendamentos(mappedDocs);
        setLoading(false);
      });
    };

    initDb();
    return () => {
      unsubscribeClientes();
      unsubscribeVeiculos();
      unsubscribeAgenda();
      unsubscribeOS();
    };
  }, [user]);

  useEffect(() => {
    if (openCreateSignal === 0) return;

    setEditingAgendamento(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  }, [openCreateSignal]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    const path = 'agendamentos';
    try {
      // If a client was selected from the list, ensure we have their ID
      const selectedCliente = clientes.find(c => c.nome === formData.clienteNome);
      const finalClienteId = selectedCliente ? selectedCliente.id : formData.clienteId;

      const dataToSave = {
        ...formData,
        clienteId: finalClienteId,
        uid: user.uid,
        data: new Date(`${formData.data}T${formData.hora}`).toISOString()
      };

      if (editingAgendamento) {
        await dbService.update(path, editingAgendamento.id, dataToSave);
        toast.success('Agendamento atualizado com sucesso!');
      } else {
        await dbService.create(path, dataToSave);
        toast.success('Serviço agendado com sucesso!');
      }
      
      setIsModalOpen(false);
      setEditingAgendamento(null);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error('Erro ao salvar agendamento.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (ag: Agendamento) => {
    setEditingAgendamento(ag);
    const date = ag.data instanceof Date ? ag.data : new Date(ag.data);
    const cliente = clientes.find(c => c.id === ag.clienteId);
    setFormData({
      clienteId: ag.clienteId,
      clienteNome: ag.clienteNome || cliente?.nome || '',
      veiculoId: ag.veiculoId || '',
      osId: ag.osId || '',
      data: format(date, 'yyyy-MM-dd'),
      hora: ag.hora || format(date, 'HH:mm'),
      descricao: ag.descricao,
      local: ag.local || '',
      status: ag.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId || !user) return;
    setIsDeleting(true);
    try {
      await dbService.delete('agendamentos', deletingId, user.uid);
      toast.success('Agendamento excluído com sucesso!');
      setDeletingId(null);
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast.error('Erro ao excluir agendamento.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getClienteNome = (id: string, ag?: Agendamento) => {
    if (ag?.clienteNome) return ag.clienteNome;
    return clientes.find(c => c.id === id)?.nome || 'N/A';
  };

  const getVeiculoModelo = (id: string) => {
    const v = veiculos.find(v => v.id === id);
    return v ? `${v.marca} ${v.modelo}` : '';
  };

  const getOSNumero = (id: string) => {
    const os = ordensServico.find(o => o.id === id);
    return os ? os.numero : '';
  };

  const getStatusIcon = (status: Agendamento['status']) => {
    switch (status) {
      case 'Pendente': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'Confirmado': return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'Concluído': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'Cancelado': return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: Agendamento['status']) => {
    switch (status) {
      case 'Pendente': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Confirmado': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Concluído': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Cancelado': return 'bg-red-50 text-red-700 border-red-100';
    }
  };

  const filteredAgendamentos = agendamentos
    .filter(ag => isSameDay(new Date(ag.data), selectedDate))
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  const tileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month') {
      const hasAgendamento = agendamentos.some(ag => isSameDay(new Date(ag.data), date));
      if (hasAgendamento) {
        return <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full mx-auto mt-1"></div>;
      }
    }
    return null;
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Agenda de Serviços</h1>
          <p className="text-slate-500 mt-1 font-medium">Organize seus compromissos e visitas técnicas.</p>
        </div>
        <button 
          onClick={() => {
            setEditingAgendamento(null);
            setFormData(initialFormData);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-semibold"
        >
          <Plus className="w-5 h-5" />
          Agendar Serviço
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Calendar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <Calendar
              onChange={(value) => setSelectedDate(value as Date)}
              value={selectedDate}
              locale="pt-BR"
              tileContent={tileContent}
              className="w-full border-none font-sans"
            />
          </div>

          <div className="bg-emerald-900 p-6 rounded-2xl text-white shadow-xl shadow-emerald-100">
            <h3 className="font-bold mb-2">Resumo do Dia</h3>
            <p className="text-emerald-100 text-sm mb-4">
              {filteredAgendamentos.length === 0 
                ? 'Nenhum serviço agendado para hoje.' 
                : `Você tem ${filteredAgendamentos.length} serviço(s) para este dia.`}
            </p>
            <div className="space-y-2">
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full transition-all duration-500" 
                  style={{ width: `${Math.min((filteredAgendamentos.length / 5) * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-emerald-300 uppercase tracking-widest font-bold">
                {Math.round(Math.min((filteredAgendamentos.length / 5) * 100, 100))}% da capacidade diária
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Appointments List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-emerald-600" />
              Compromissos para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </h2>
          </div>
          
          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAgendamentos.map((ag) => (
                <div key={ag.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-6 group hover:border-emerald-200 transition-all relative">
                  <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl px-4 py-2 border border-slate-100 min-w-[80px]">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                      {format(new Date(ag.data), 'MMM', { locale: ptBR }).toUpperCase()}
                    </span>
                    <span className="text-2xl font-black text-slate-900">
                      {format(new Date(ag.data), 'dd')}
                    </span>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-widest">
                        <Clock className="w-3 h-3" />
                        {format(new Date(ag.data), 'HH:mm')}
                      </div>
                      <div className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${getStatusColor(ag.status)}`}>
                        {getStatusIcon(ag.status)}
                        {ag.status}
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {ag.descricao}
                    </h3>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{getClienteNome(ag.clienteId, ag)}</span>
                        {ag.veiculoId && (
                          <span className="text-slate-300 ml-1">({getVeiculoModelo(ag.veiculoId)})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {ag.local || 'Local não informado'}
                      </div>
                      {ag.osId && (
                        <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                          <FileText className="w-4 h-4" />
                          OS: {getOSNumero(ag.osId)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(ag)}
                      className="p-2 hover:bg-emerald-50 rounded-lg transition-colors text-slate-400 hover:text-emerald-600"
                      title="Editar"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setDeletingId(ag.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-600"
                      title="Excluir"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              
              {filteredAgendamentos.length === 0 && (
                <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                  <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium italic">Nenhum serviço agendado para este dia.</p>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="mt-4 text-emerald-600 font-bold hover:underline"
                  >
                    Agendar agora
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Cadastro/Edição */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingAgendamento(null);
          setFormData(initialFormData);
        }} 
        title={editingAgendamento ? "Editar Agendamento" : "Agendar Novo Serviço"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cliente</label>
              <div className="relative">
                <input 
                  list="clientes-list"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Digite o nome do cliente ou selecione..."
                  value={formData.clienteNome}
                  onChange={e => {
                    const nome = e.target.value;
                    const cliente = clientes.find(c => c.nome === nome);
                    setFormData({
                      ...formData, 
                      clienteNome: nome,
                      clienteId: cliente ? cliente.id : '',
                      veiculoId: cliente ? formData.veiculoId : '', // Reset vehicle if client changes and not found
                      osId: cliente ? formData.osId : ''
                    });
                  }}
                />
                <datalist id="clientes-list">
                  {clientes.map(c => (
                    <option key={c.id} value={c.nome} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Equipamento (Opcional)</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={formData.veiculoId}
                onChange={e => setFormData({...formData, veiculoId: e.target.value})}
                disabled={!formData.clienteId}
              >
                <option value="">Selecione um equipamento</option>
                {veiculos
                  .filter(v => v.clienteId === formData.clienteId)
                  .map(v => (
                    <option key={v.id} value={v.id}>{v.marca} {v.modelo} ({v.placa_serie})</option>
                  ))
                }
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Vincular OS (Opcional)</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={formData.osId}
                onChange={e => setFormData({...formData, osId: e.target.value})}
                disabled={!formData.clienteNome}
              >
                <option value="">Selecione uma OS aberta</option>
                {ordensServico
                  .filter(os => {
                    const osClienteNome = os.clienteNome || clientes.find(c => c.id === os.clienteId)?.nome || '';
                    const matchCliente = formData.clienteId ? os.clienteId === formData.clienteId : osClienteNome === formData.clienteNome;
                    return matchCliente && os.status !== 'Finalizada' && os.status !== 'Cancelada';
                  })
                  .map(os => (
                    <option key={os.id} value={os.id}>{os.numero} - {os.status}</option>
                  ))
                }
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Data</label>
              <input 
                required 
                type="date" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                value={formData.data}
                onChange={e => setFormData({...formData, data: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Hora</label>
              <input 
                required 
                type="time" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                value={formData.hora}
                onChange={e => setFormData({...formData, hora: e.target.value})}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Status</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['Pendente', 'Confirmado', 'Concluído', 'Cancelado'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFormData({...formData, status})}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      formData.status === status 
                        ? getStatusColor(status) + ' ring-2 ring-emerald-500/20' 
                        : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Local / Fazenda</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: Fazenda Boa Vista, KM 45" 
                value={formData.local}
                onChange={e => setFormData({...formData, local: e.target.value})}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Descrição do Compromisso</label>
              <textarea 
                required 
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: Entrega técnica de Trator 7230J" 
                value={formData.descricao}
                onChange={e => setFormData({...formData, descricao: e.target.value})}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <button 
              type="button"
              disabled={isSaving}
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {editingAgendamento ? 'Atualizar Agendamento' : 'Agendar Serviço'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Confirmar Exclusão"
      >
        <div className="space-y-6">
          <p className="text-slate-600">
            Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeletingId(null)}
              className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
