import React, { useState, useEffect } from 'react';
import { Search, UserPlus, MoreVertical, Mail, Phone, MapPin, Save, Loader2, Edit2, Trash2 } from 'lucide-react';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { Cliente } from '../types';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';
import { OperationType } from '../utils/firestore';

interface ClientesViewProps {
  openCreateSignal?: number;
}

export const ClientesView: React.FC<ClientesViewProps> = ({ openCreateSignal = 0 }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const initialFormData = {
    nome: '',
    email: '',
    telefone: '',
    cpf_cnpj: '',
    inscricao_estadual: '',
    inscricao_municipal: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cep: '',
    cidade: '',
    uf: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!user) return;

    const path = 'clientes';
    let unsubscribe = () => {};

    const initDb = async () => {
      unsubscribe = await dbService.list(path, user.uid, (docs) => {
        setClientes(docs as Cliente[]);
        setLoading(false);
      });
    };

    initDb();
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (openCreateSignal === 0) return;

    setEditingCliente(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  }, [openCreateSignal]);

  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);

  const fetchCNPJData = async (cnpj: string) => {
    const cleanedCNPJ = cnpj.replace(/\D/g, '');
    if (cleanedCNPJ.length !== 14 || isSearchingCNPJ) return;

    setIsSearchingCNPJ(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanedCNPJ}`);
      if (!response.ok) throw new Error('CNPJ não encontrado');
      
      const data = await response.json();
      
      setFormData(prev => ({
        ...prev,
        nome: data.razao_social || data.nome_fantasia || prev.nome,
        email: data.email || prev.email,
        telefone: data.ddd_telefone_1 || prev.telefone,
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cep: data.cep || '',
        cidade: data.municipio || '',
        uf: data.uf || ''
      }));
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
      // Opcional: mostrar um alerta discreto
    } finally {
      setIsSearchingCNPJ(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    const path = 'clientes';
    try {
      if (editingCliente) {
        await dbService.update(path, editingCliente.id, formData);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await dbService.create(path, {
          ...formData,
          uid: user.uid
        });
        toast.success('Cliente salvo com sucesso!');
      }
      setIsModalOpen(false);
      setEditingCliente(null);
      setFormData(initialFormData);
      
      // Refresh list if local (since we don't have real-time listeners for SQLite yet)
      const docs = await dbService.list(path, user.uid, (docs) => setClientes(docs as Cliente[]));
    } catch (error) {
      console.error('Error saving cliente:', error);
      toast.error('Erro ao salvar cliente. Verifique os dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      cpf_cnpj: cliente.cpf_cnpj,
      inscricao_estadual: cliente.inscricao_estadual || '',
      inscricao_municipal: cliente.inscricao_municipal || '',
      logradouro: cliente.logradouro,
      numero: cliente.numero,
      complemento: cliente.complemento || '',
      bairro: cliente.bairro,
      cep: cliente.cep,
      cidade: cliente.cidade,
      uf: cliente.uf
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    const path = 'clientes';
    try {
      await dbService.delete(path, deletingId, user.uid);
      toast.success('Cliente excluído com sucesso!');
      setDeletingId(null);
      
      // Refresh list
      await dbService.list(path, user.uid, (docs) => setClientes(docs as Cliente[]));
    } catch (error) {
      console.error('Error deleting cliente:', error);
      toast.error('Erro ao excluir cliente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredClientes = clientes.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpf_cnpj.includes(searchTerm)
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Clientes</h1>
          <p className="text-slate-500 mt-1 font-medium">Gerencie sua base de contatos e produtores.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-semibold"
        >
          <UserPlus className="w-5 h-5" />
          Novo Cliente
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por nome ou documento..."
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
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Documento</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contato</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{cliente.nome}</span>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                          <MapPin className="w-3 h-3" />
                          {`${cliente.logradouro}, ${cliente.numero}${cliente.complemento ? ' - ' + cliente.complemento : ''}, ${cliente.bairro}, ${cliente.cidade} - ${cliente.uf}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-slate-600">{cliente.cpf_cnpj}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {cliente.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="w-4 h-4 text-slate-400" />
                            {cliente.email}
                          </div>
                        )}
                        {cliente.telefone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-4 h-4 text-slate-400" />
                            {cliente.telefone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(cliente)}
                          className="p-2 hover:bg-emerald-50 rounded-lg transition-colors text-slate-400 hover:text-emerald-600"
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setDeletingId(cliente.id)}
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
        
        {!loading && filteredClientes.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-400 font-medium">Nenhum cliente encontrado.</p>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingCliente(null);
          setFormData(initialFormData);
        }} 
        title={editingCliente ? "Editar Cliente" : "Cadastrar Novo Cliente"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nome Completo / Razão Social</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: João da Silva" 
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Email (Opcional)</label>
              <input 
                type="email" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="joao@exemplo.com" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Telefone (Opcional)</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="(00) 00000-0000" 
                value={formData.telefone}
                onChange={e => setFormData({...formData, telefone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">CPF / CNPJ</label>
              <div className="relative">
                <input 
                  required 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-12" 
                  placeholder="00.000.000/0000-00" 
                  value={formData.cpf_cnpj}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData({...formData, cpf_cnpj: val});
                    if (val.replace(/\D/g, '').length === 14) {
                      fetchCNPJData(val);
                    }
                  }}
                />
                {formData.cpf_cnpj.replace(/\D/g, '').length === 14 && (
                  <button
                    type="button"
                    onClick={() => fetchCNPJData(formData.cpf_cnpj)}
                    disabled={isSearchingCNPJ}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-50"
                    title="Buscar dados do CNPJ"
                  >
                    {isSearchingCNPJ ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Inscrição Estadual</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: 000.000.000.000" 
                value={formData.inscricao_estadual}
                onChange={e => setFormData({...formData, inscricao_estadual: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Inscrição Municipal</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: 000000" 
                value={formData.inscricao_municipal}
                onChange={e => setFormData({...formData, inscricao_municipal: e.target.value})}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Endereço (Logradouro)</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Rua, Avenida, etc." 
                value={formData.logradouro}
                onChange={e => setFormData({...formData, logradouro: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Número</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="123" 
                value={formData.numero}
                onChange={e => setFormData({...formData, numero: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Complemento</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Apto, Sala, etc." 
                value={formData.complemento}
                onChange={e => setFormData({...formData, complemento: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Bairro</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Centro" 
                value={formData.bairro}
                onChange={e => setFormData({...formData, bairro: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">CEP</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="00000-000" 
                value={formData.cep}
                onChange={e => setFormData({...formData, cep: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cidade</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Cidade" 
                value={formData.cidade}
                onChange={e => setFormData({...formData, cidade: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">UF</label>
              <input 
                required 
                type="text" 
                maxLength={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="UF" 
                value={formData.uf}
                onChange={e => setFormData({...formData, uf: e.target.value.toUpperCase()})}
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
              Salvar Cliente
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
            Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
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
