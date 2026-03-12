import React, { useState, useEffect } from 'react';
import { Search, Package, MoreVertical, Tag, Boxes, DollarSign, Save, Loader2, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { Peca } from '../types';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';
import { CurrencyInput } from './CurrencyInput';
import { formatCurrency } from '../utils/formatters';
import { handleFirestoreError, OperationType } from '../utils/firestore';

export const PecasView: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPeca, setEditingPeca] = useState<Peca | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const initialFormData = {
    codigo: '',
    descricao: '',
    marca: '',
    precoCusto: 0,
    precoVenda: 0,
    estoque: 0,
    estoqueMinimo: 0,
    unidade: 'UN'
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!user) return;

    const path = 'pecas';
    let unsubscribe = () => {};

    const initDb = async () => {
      unsubscribe = await dbService.list(path, user.uid, (docs) => {
        setPecas(docs as Peca[]);
        setLoading(false);
      });
    };

    initDb();
    return () => unsubscribe();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    const path = 'pecas';
    try {
      if (editingPeca) {
        await dbService.update(path, editingPeca.id, formData);
        toast.success('Peça atualizada com sucesso!');
      } else {
        await dbService.create(path, {
          ...formData,
          uid: user.uid
        });
        toast.success('Peça salva com sucesso!');
      }
      setIsModalOpen(false);
      setEditingPeca(null);
      setFormData(initialFormData);
      
      // Refresh list
      await dbService.list(path, user.uid, (docs) => setPecas(docs as Peca[]));
    } catch (error) {
      console.error('Error saving peca:', error);
      // If it's a Firestore error, it will be handled by our utility if we call it
      // But dbService might be using local DB.
      toast.error('Erro ao salvar peça. Verifique os dados.');
      
      // If not using local DB, we could throw to let ErrorBoundary catch it
      // if (process.env.NODE_ENV === 'production') handleFirestoreError(error, editingPeca ? OperationType.UPDATE : OperationType.CREATE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (peca: Peca) => {
    setEditingPeca(peca);
    setFormData({
      codigo: peca.codigo,
      descricao: peca.descricao,
      marca: peca.marca || '',
      precoCusto: peca.precoCusto,
      precoVenda: peca.precoVenda,
      estoque: peca.estoque,
      estoqueMinimo: peca.estoqueMinimo || 0,
      unidade: peca.unidade
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    const path = 'pecas';
    try {
      await dbService.delete(path, deletingId, user.uid);
      toast.success('Peça excluída com sucesso!');
      setDeletingId(null);
      
      // Refresh list
      await dbService.list(path, user.uid, (docs) => setPecas(docs as Peca[]));
    } catch (error) {
      console.error('Error deleting peca:', error);
      toast.error('Erro ao excluir peça.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPecas = pecas.filter(p => 
    p.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.marca?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Peças e Produtos</h1>
          <p className="text-slate-500 mt-1 font-medium">Gerencie o estoque de peças e componentes.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-semibold"
        >
          <Package className="w-5 h-5" />
          Nova Peça
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por código, descrição ou marca..."
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
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Peça / Código</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Marca</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estoque</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Preço Venda</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPecas.map((peca) => (
                  <tr key={peca.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{peca.descricao}</span>
                        <span className="text-xs font-mono text-slate-400 mt-1">{peca.codigo}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{peca.marca || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-bold",
                          peca.estoque <= (peca.estoqueMinimo || 0) 
                            ? "bg-red-100 text-red-700" 
                            : "bg-emerald-100 text-emerald-700"
                        )}>
                          {peca.estoque} {peca.unidade}
                        </span>
                        {peca.estoque <= (peca.estoqueMinimo || 0) && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700">{formatCurrency(peca.precoVenda)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(peca)}
                          className="p-2 hover:bg-emerald-50 rounded-lg transition-colors text-slate-400 hover:text-emerald-600"
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setDeletingId(peca.id)}
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
        
        {!loading && filteredPecas.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-400 font-medium">Nenhuma peça encontrada.</p>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingPeca(null);
          setFormData(initialFormData);
        }} 
        title={editingPeca ? "Editar Peça" : "Cadastrar Nova Peça"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Descrição da Peça</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: Filtro de Óleo" 
                value={formData.descricao}
                onChange={e => setFormData({...formData, descricao: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Código / SKU</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: ABC-123" 
                value={formData.codigo}
                onChange={e => setFormData({...formData, codigo: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Marca (Opcional)</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: Bosch" 
                value={formData.marca}
                onChange={e => setFormData({...formData, marca: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Preço de Custo</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <CurrencyInput 
                  value={formData.precoCusto}
                  onChange={val => setFormData({...formData, precoCusto: val})}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-right font-bold" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Preço de Venda</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <CurrencyInput 
                  required
                  value={formData.precoVenda}
                  onChange={val => setFormData({...formData, precoVenda: val})}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-right font-bold" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Estoque Atual</label>
              <div className="relative">
                <Boxes className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  required
                  type="number" 
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                  placeholder="0" 
                  value={formData.estoque}
                  onChange={e => setFormData({...formData, estoque: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Estoque Mínimo</label>
              <input 
                type="number" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="0" 
                value={formData.estoqueMinimo}
                onChange={e => setFormData({...formData, estoqueMinimo: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Unidade</label>
              <select 
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={formData.unidade}
                onChange={e => setFormData({...formData, unidade: e.target.value})}
              >
                <option value="UN">Unidade (UN)</option>
                <option value="KG">Quilograma (KG)</option>
                <option value="LT">Litro (LT)</option>
                <option value="MT">Metro (MT)</option>
                <option value="CJ">Conjunto (CJ)</option>
                <option value="PC">Peça (PC)</option>
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
              Salvar Peça
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
            Tem certeza que deseja excluir esta peça? Esta ação não pode ser desfeita.
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
