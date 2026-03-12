import React, { useState, useEffect } from 'react';
import { Search, Plus, Tractor, Truck, Settings2, MoreVertical, Save, Loader2, Edit2, Trash2 } from 'lucide-react';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { Veiculo, Cliente } from '../types';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';
import { OperationType } from '../utils/firestore';

interface VeiculosViewProps {
  openCreateSignal?: number;
}

export const VeiculosView: React.FC<VeiculosViewProps> = ({ openCreateSignal = 0 }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [veiculos, setVeiculos] = useState<(Veiculo & { clienteNome?: string })[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVeiculo, setEditingVeiculo] = useState<Veiculo | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const initialFormData = {
    clienteId: '',
    clienteNome: '',
    modelo: '',
    marca: '',
    ano: new Date().getFullYear(),
    placa_serie: '',
    tipo: 'Trator'
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!user) return;

    let unsubscribeClientes = () => {};
    let unsubscribeVeiculos = () => {};

    const initDb = async () => {
      // Fetch Clientes for the dropdown
      unsubscribeClientes = await dbService.list('clientes', user.uid, (docs) => {
        setClientes(docs as Cliente[]);
      });

      // Fetch Veiculos
      unsubscribeVeiculos = await dbService.list('veiculos', user.uid, (docs) => {
        setVeiculos(docs as Veiculo[]);
        setLoading(false);
      });
    };

    initDb();
    return () => {
      unsubscribeClientes();
      unsubscribeVeiculos();
    };
  }, [user]);

  useEffect(() => {
    if (openCreateSignal === 0) return;

    setEditingVeiculo(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  }, [openCreateSignal]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    const path = 'veiculos';
    try {
      // If a client was selected from the list, ensure we have their ID
      const selectedCliente = clientes.find(c => c.nome === formData.clienteNome);
      const finalClienteId = selectedCliente ? selectedCliente.id : formData.clienteId;

      const dataToSave = {
        ...formData,
        clienteId: finalClienteId,
        uid: user.uid
      };

      if (editingVeiculo) {
        await dbService.update(path, editingVeiculo.id, dataToSave);
        toast.success('Equipamento atualizado com sucesso!');
      } else {
        await dbService.create(path, dataToSave);
        toast.success('Equipamento salvo com sucesso!');
      }
      setIsModalOpen(false);
      setEditingVeiculo(null);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error saving equipment:', error);
      toast.error('Erro ao salvar equipamento.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (veiculo: Veiculo) => {
    setEditingVeiculo(veiculo);
    const cliente = clientes.find(c => c.id === veiculo.clienteId);
    setFormData({
      clienteId: veiculo.clienteId,
      clienteNome: veiculo.clienteNome || cliente?.nome || '',
      modelo: veiculo.modelo,
      marca: veiculo.marca,
      ano: veiculo.ano,
      placa_serie: veiculo.placa_serie,
      tipo: veiculo.tipo
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    const path = 'veiculos';
    try {
      await dbService.delete(path, deletingId, user.uid);
      toast.success('Equipamento excluído com sucesso!');
      setDeletingId(null);
    } catch (error) {
      console.error('Error deleting equipment:', error);
      toast.error('Erro ao excluir equipamento.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getClienteNome = (clienteId: string, veiculo?: Veiculo) => {
    if (veiculo?.clienteNome) return veiculo.clienteNome;
    return clientes.find(c => c.id === clienteId)?.nome || 'Cliente não encontrado';
  };

  const filteredVeiculos = veiculos.filter(v => {
    const clienteNome = getClienteNome(v.clienteId, v).toLowerCase();
    return v.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
           v.placa_serie.toLowerCase().includes(searchTerm.toLowerCase()) ||
           clienteNome.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Veículos e Equipamentos</h1>
          <p className="text-slate-500 mt-1 font-medium">Controle a frota de máquinas dos seus clientes.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-semibold"
        >
          <Plus className="w-5 h-5" />
          Novo Equipamento
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por modelo, série ou cliente..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Equipamento</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Série / Placa</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Proprietário</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo / Ano</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVeiculos.map((veiculo) => (
                  <tr key={veiculo.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-50 p-2 rounded-lg">
                          <Tractor className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{veiculo.marca} {veiculo.modelo}</span>
                          <span className="text-xs text-slate-400">ID: {veiculo.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-slate-600">{veiculo.placa_serie}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">{getClienteNome(veiculo.clienteId, veiculo)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-700 font-medium">{veiculo.tipo}</span>
                        <span className="text-xs text-slate-400">{veiculo.ano}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(veiculo)}
                          className="p-2 hover:bg-emerald-50 rounded-lg transition-colors text-slate-400 hover:text-emerald-600"
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setDeletingId(veiculo.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-600"
                          title="Excluir"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {!loading && filteredVeiculos.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-400 font-medium">Nenhum equipamento encontrado.</p>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingVeiculo(null);
          setFormData(initialFormData);
        }} 
        title={editingVeiculo ? "Editar Equipamento" : "Cadastrar Novo Equipamento"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Proprietário (Cliente)</label>
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
                      clienteId: cliente ? cliente.id : ''
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
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Marca</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: John Deere" 
                value={formData.marca}
                onChange={e => setFormData({...formData, marca: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Modelo</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: 7230J" 
                value={formData.modelo}
                onChange={e => setFormData({...formData, modelo: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Ano</label>
              <input 
                required 
                type="number" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                value={formData.ano}
                onChange={e => setFormData({...formData, ano: parseInt(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Placa / Série</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Número de série ou placa" 
                value={formData.placa_serie}
                onChange={e => setFormData({...formData, placa_serie: e.target.value})}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Tipo de Equipamento</label>
              <select 
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={formData.tipo}
                onChange={e => setFormData({...formData, tipo: e.target.value})}
              >
                <option value="Trator">Trator</option>
                <option value="Colheitadeira">Colheitadeira</option>
                <option value="Plantadeira">Plantadeira</option>
                <option value="Pulverizador">Pulverizador</option>
                <option value="Caminhão">Caminhão</option>
                <option value="Outro">Outro</option>
              </select>
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
              Salvar Equipamento
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Confirmar Exclusão"
      >
        <div className="space-y-6">
          <p className="text-slate-600">
            Tem certeza que deseja excluir este equipamento? Esta ação não pode ser desfeita.
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
