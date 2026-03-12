import React, { useState, useEffect } from 'react';
import { Settings, User, Save, LogOut, Loader2, Phone, Mail as MailIcon, MapPin, Building2, FileText, FileSignature, Cloud, Image as ImageIcon, Globe, Bell, Check, AlertTriangle, RefreshCw, Users, Plus, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { toast } from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../utils/firestore';
import { googleService, GoogleTokens, GoogleIntegrationConfig, DriveBackupFile, DriveBackupFolderInfo } from '../services/googleService';
import { backupService } from '../services/backupService';
import { Modal } from './Modal';
import { Usuario } from '../types';
import bcrypt from 'bcryptjs';
import { API_BASE_CONFIGURATION_MESSAGE, getApiBaseUrl, isNativeRuntime, setApiBaseUrl } from '../utils/api';

type TabType = 'empresa' | 'documentos' | 'termos' | 'integracoes' | 'usuarios';

export const ConfiguracoesView: React.FC = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('empresa');
  const [googleTokens, setGoogleTokens] = useState<GoogleTokens | null>(googleService.getTokens());
  const [googleConfig, setGoogleConfig] = useState<GoogleIntegrationConfig | null>(null);
  const [googleConfigError, setGoogleConfigError] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState(getApiBaseUrl());
  const [isSavingBackendUrl, setIsSavingBackendUrl] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isLoadingDriveBackups, setIsLoadingDriveBackups] = useState(false);
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [driveBackupFolder, setDriveBackupFolder] = useState<DriveBackupFolderInfo | null>(null);
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [userFormData, setUserFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    role: 'tecnico' as 'adm' | 'tecnico'
  });
  const isAndroidAppWithoutBackend = isNativeRuntime() && !backendUrl;

  const loadGoogleConfig = async () => {
    try {
      const config = await googleService.getIntegrationConfig();
      setGoogleConfig(config);
      setGoogleConfigError(null);
    } catch (error: any) {
      setGoogleConfig(null);
      setGoogleConfigError(error?.message || 'Não foi possível carregar a configuração Google.');
    }
  };

  useEffect(() => {
    if (!user || activeTab !== 'usuarios') return;
    
    let unsubscribe = () => {};
    const fetchUsers = async () => {
      unsubscribe = await dbService.list('usuarios', user.uid, (docs) => {
        setUsuarios(docs as Usuario[]);
      });
    };
    fetchUsers();
    return () => unsubscribe();
  }, [user, activeTab]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      const userData = { ...userFormData };
      
      // Hash password if provided
      if (userData.senha) {
        userData.senha = bcrypt.hashSync(userData.senha, 10);
      } else if (editingUser) {
        // If editing and no password provided, remove it from update to keep existing
        delete (userData as any).senha;
      }

      if (editingUser) {
        await dbService.update('usuarios', editingUser.id, userData);
        toast.success('Usuário atualizado com sucesso!');
      } else {
        await dbService.create('usuarios', {
          ...userData,
          uid: user.uid,
          id: Math.random().toString(36).slice(2) + Date.now().toString(36)
        });
        toast.success('Usuário cadastrado com sucesso!');
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserFormData({ nome: '', email: '', senha: '', role: 'tecnico' });
    } catch (error) {
      toast.error('Erro ao salvar usuário.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUserId || !user) return;
    setIsDeletingUser(true);
    try {
      await dbService.delete('usuarios', deletingUserId, user.uid);
      toast.success('Usuário excluído com sucesso!');
      setDeletingUserId(null);
    } catch (error) {
      toast.error('Erro ao excluir usuário.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  useEffect(() => {
    loadGoogleConfig();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        googleService.setTokens(tokens);
        setGoogleTokens(tokens);
        backupService.ensureDriveBackupFolder(tokens)
          .then((folder) => setDriveBackupFolder(folder))
          .catch((error) => console.error('Drive folder ensure error:', error));
        toast.success('Conectado ao Google com sucesso!');
      }
    };

    // Mobile/WebView fallback: check for cookie and URL flag
    const checkGoogleAuthFallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('google_auth') === 'success') {
        // Try to get tokens from cookie
        const getCookie = (name: string) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(';').shift();
          return null;
        };

        const tokensStr = getCookie('google_tokens_temp');
        if (tokensStr) {
          try {
            const tokens = JSON.parse(decodeURIComponent(tokensStr));
            googleService.setTokens(tokens);
            setGoogleTokens(tokens);
            backupService.ensureDriveBackupFolder(tokens)
              .then((folder) => setDriveBackupFolder(folder))
              .catch((error) => console.error('Drive folder ensure error:', error));
            toast.success('Conectado ao Google com sucesso!');
            
            // Clean up: remove cookie and URL param
            document.cookie = "google_tokens_temp=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {
            console.error('Error parsing google tokens from cookie', e);
          }
        }
      }
    };

    checkGoogleAuthFallback();
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSaveBackendUrl = async () => {
    setIsSavingBackendUrl(true);

    try {
      const normalizedUrl = setApiBaseUrl(backendUrl);
      setBackendUrl(normalizedUrl);
      await loadGoogleConfig();
      toast.success(normalizedUrl ? 'Backend HTTPS configurado com sucesso!' : 'Configuração de backend removida.');
    } catch (error: any) {
      console.error('Error saving backend URL:', error);
      toast.error(error?.message || 'Erro ao salvar a URL do backend.');
    } finally {
      setIsSavingBackendUrl(false);
    }
  };

  const handleConnectGoogle = async () => {
    if (googleConfig && !googleConfig.configured) {
      toast.error('OAuth do Google não está configurado no servidor.');
      return;
    }

    if (isAndroidAppWithoutBackend) {
      toast.error(API_BASE_CONFIGURATION_MESSAGE);
      return;
    }

    if (googleConfig) {
      const redirectOrigin = new URL(googleConfig.redirectUri).origin;
      const currentOrigin = window.location.origin;

      if (redirectOrigin !== currentOrigin) {
        toast.error(`Integração Google bloqueada neste ambiente. O callback está configurado para ${redirectOrigin}. Abra o sistema nesse domínio ou cadastre ${currentOrigin} no Google Cloud.`);
        return;
      }
    }

    const popup = window.open('', 'google_auth', 'width=600,height=700');

    try {
      const url = await googleService.getAuthUrl();
      if (popup) {
        popup.location.href = url;
        popup.focus();
      } else {
        window.location.href = url;
      }
    } catch (error: any) {
      popup?.close();
      console.error('Error getting auth URL:', error);
      toast.error(error?.message || 'Erro ao iniciar autenticação com Google.');
    }
  };

  const handleDisconnectGoogle = () => {
    googleService.removeTokens();
    setGoogleTokens(null);
    toast.success('Desconectado do Google.');
  };

  const handleBackupToDrive = async () => {
    if (!googleTokens || !user) return;
    setIsBackingUp(true);
    try {
      await backupService.uploadBackupToDrive(googleTokens);
    } catch (error) {
      console.error('Backup error:', error);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleBackupEmail = async () => {
    if (!googleTokens || !user) return;
    setIsBackingUp(true);
    try {
      await backupService.sendBackupByEmail(user.email || '', googleTokens);
    } catch (error) {
      console.error('Backup email error:', error);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleOpenRestoreModal = async () => {
    if (!googleTokens) {
      toast.error('Conecte o Google para restaurar backups do Drive.');
      return;
    }

    setIsRestoreModalOpen(true);
    setIsLoadingDriveBackups(true);
    try {
      const result = await backupService.listDriveBackups(googleTokens);
      setDriveBackups(result.files);
      setDriveBackupFolder(result.folder || null);
    } catch (error: any) {
      console.error('Drive backup list error:', error);
      toast.error(error?.message || 'Falha ao listar backups do Drive.');
    } finally {
      setIsLoadingDriveBackups(false);
    }
  };

  const handleRestoreFromDrive = async (fileId: string) => {
    if (!googleTokens) {
      toast.error('Conecte o Google para restaurar backups do Drive.');
      return;
    }

    setRestoringBackupId(fileId);
    try {
      await backupService.restoreFromDrive(fileId, googleTokens);
    } catch (error: any) {
      console.error('Drive backup restore error:', error);
      toast.error(error?.message || 'Falha ao restaurar backup do Drive.');
    } finally {
      setRestoringBackupId(null);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        await backupService.importDatabase(content);
      } catch (error) {
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    try {
      const backup = await backupService.exportDatabase();
      const blob = new Blob([backup.content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Backup baixado com sucesso!');
    } catch (error) {
      console.error('Download backup error:', error);
      toast.error('Erro ao baixar backup.');
    } finally {
      setIsBackingUp(false);
    }
  };
  
  const [formData, setFormData] = useState({
    nomeOficina: '',
    cnpj: '',
    inscricaoMunicipal: '',
    inscricaoEstadual: '',
    endereco: '',
    complemento: '',
    bairro: '',
    cep: '',
    cidade: '',
    uf: '',
    telefone: '',
    email: '',
    logo: '',
    termoGarantia: '',
    validadePadraoOrcamento: 15,
    tecnicoPadrao: '',
    exibirLogoNoPdf: true,
    exibirFotosNoPdf: true
  });

  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);

  const fetchCnpjData = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;

    setIsFetchingCnpj(true);
    try {
      // Using BrasilAPI as it's free and doesn't require a key for basic usage
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!response.ok) throw new Error('CNPJ não encontrado');
      
      const data = await response.json();
      
      setFormData(prev => ({
        ...prev,
        nomeOficina: data.razao_social || data.nome_fantasia || prev.nomeOficina,
        cnpj: cnpj,
        endereco: `${data.logradouro}${data.numero ? ', ' + data.numero : ''}`,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        cep: data.cep || prev.cep,
        cidade: data.municipio || prev.cidade,
        uf: data.uf || prev.uf,
        email: data.email || prev.email,
        telefone: data.ddd_telefone_1 || prev.telefone
      }));
      
      toast.success('Dados da empresa carregados com sucesso!');
    } catch (error) {
      console.error('Error fetching CNPJ:', error);
      toast.error('Erro ao buscar CNPJ. Verifique o número ou tente manualmente.');
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, cnpj: value });
    
    // Auto-fetch if it looks like a full CNPJ (with or without mask)
    const cleanCnpj = value.replace(/\D/g, '');
    if (cleanCnpj.length === 14) {
      fetchCnpjData(value);
    }
  };

  useEffect(() => {
    if (!user) return;

    let unsubscribe = () => {};

    const initDb = async () => {
      unsubscribe = await dbService.list('configuracoes', user.uid, (docs) => {
        if (docs.length > 0) {
          const data = docs[0];
          setConfigId(data.id);
          setFormData({
            nomeOficina: data.nomeOficina || '',
            cnpj: data.cnpj || '',
            inscricaoMunicipal: data.inscricaoMunicipal || '',
            inscricaoEstadual: data.inscricaoEstadual || '',
            endereco: data.endereco || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            cep: data.cep || '',
            cidade: data.cidade || '',
            uf: data.uf || '',
            telefone: data.telefone || '',
            email: data.email || '',
            logo: data.logo || '',
            termoGarantia: data.termoGarantia || '',
            validadePadraoOrcamento: data.validadePadraoOrcamento || 15,
            tecnicoPadrao: data.tecnicoPadrao || '',
            exibirLogoNoPdf: data.exibirLogoNoPdf !== undefined ? data.exibirLogoNoPdf : true,
            exibirFotosNoPdf: data.exibirFotosNoPdf !== undefined ? data.exibirFotosNoPdf : true
          });
        }
        setLoading(false);
      });
    };

    initDb();
    return () => unsubscribe();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const path = 'configuracoes';
    
    try {
      if (configId) {
        await dbService.update(path, configId, { ...formData, uid: user.uid });
      } else {
        await dbService.create(path, {
          ...formData,
          uid: user.uid
        });
      }
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Error saving config:', error);
      const errorMessage = error?.message || 'Erro ao salvar configurações.';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
          <p className="text-slate-500 text-sm">Gerencie as informações do seu sistema.</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full border-2 border-white"></span>
          </button>
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{user?.displayName || 'Usuário'}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <User className="w-6 h-6" />
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-slate-900">Configurações do Sistema</h2>

        {/* Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('empresa')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'empresa' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Dados da Empresa
          </button>
          <button
            onClick={() => setActiveTab('documentos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'documentos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Documentos
          </button>
          <button
            onClick={() => setActiveTab('termos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'termos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            Termos e Condições
          </button>
          <button
            onClick={() => setActiveTab('integracoes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'integracoes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Cloud className="w-4 h-4" />
            Integrações
          </button>
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'usuarios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Usuários
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {activeTab === 'empresa' && (
            <div className="p-8 space-y-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Building2 className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Dados da Empresa</h3>
                  <p className="text-sm text-slate-500">Configure as informações da sua empresa que aparecerão em documentos e relatórios.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nome da Empresa *</label>
                  <input
                    type="text"
                    value={formData.nomeOficina}
                    onChange={e => setFormData({ ...formData, nomeOficina: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Auto Mecânica Exemplar"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">CNPJ</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.cnpj}
                      onChange={handleCnpjChange}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="12.345.678/0001-90"
                    />
                    {isFetchingCnpj && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">Digite os 14 números para preencher automaticamente</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Inscrição Municipal</label>
                  <input
                    type="text"
                    value={formData.inscricaoMunicipal}
                    onChange={e => setFormData({ ...formData, inscricaoMunicipal: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Inscrição Estadual</label>
                  <input
                    type="text"
                    value={formData.inscricaoEstadual}
                    onChange={e => setFormData({ ...formData, inscricaoEstadual: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Endereço</label>
                  <input
                    type="text"
                    value={formData.endereco}
                    onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Rua das Ferramentas, 123 - Centro"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Complemento</label>
                  <input
                    type="text"
                    value={formData.complemento}
                    onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Bairro</label>
                  <input
                    type="text"
                    value={formData.bairro}
                    onChange={e => setFormData({ ...formData, bairro: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">CEP</label>
                  <input
                    type="text"
                    value={formData.cep}
                    onChange={e => setFormData({ ...formData, cep: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Cidade</label>
                  <input
                    type="text"
                    value={formData.cidade}
                    onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">UF</label>
                  <input
                    type="text"
                    value={formData.uf}
                    onChange={e => setFormData({ ...formData, uf: e.target.value })}
                    maxLength={2}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Telefone</label>
                  <input
                    type="text"
                    value={formData.telefone}
                    onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="(11) 98765-4321"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="contato@automecanica.exemplo.com"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Logo (Base64)</label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={formData.logo}
                        onChange={e => setFormData({ ...formData, logo: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        placeholder="String da imagem em Base64"
                      />
                      <p className="text-xs text-slate-400 mt-1">Cole aqui a string Base64 da imagem do logo da empresa</p>
                    </div>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-all cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Upload
                      </label>
                    </div>
                  </div>
                  {formData.logo && (
                    <div className="mt-4 p-4 border border-slate-100 rounded-xl bg-slate-50 flex justify-center">
                      <img src={formData.logo} alt="Logo Preview" className="max-h-32 object-contain" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Salvar Configurações
                </button>
              </div>
            </div>
          )}

          {activeTab === 'documentos' && (
            <div className="p-8 space-y-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <FileText className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Configurações de Documentos</h3>
                  <p className="text-sm text-slate-500">Configure como seus orçamentos e ordens de serviço são gerados.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Validade Padrão de Orçamentos (dias)</label>
                    <input
                      type="number"
                      value={formData.validadePadraoOrcamento}
                      onChange={e => setFormData({ ...formData, validadePadraoOrcamento: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Técnico Responsável Padrão</label>
                    <input
                      type="text"
                      value={formData.tecnicoPadrao}
                      onChange={e => setFormData({ ...formData, tecnicoPadrao: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Ex: João Silva"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900">Exibir Logo no PDF</p>
                      <p className="text-xs text-slate-500">Mostra o logotipo da empresa no cabeçalho dos documentos.</p>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, exibirLogoNoPdf: !formData.exibirLogoNoPdf })}
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        formData.exibirLogoNoPdf ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                        formData.exibirLogoNoPdf ? 'right-1' : 'left-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900">Exibir Fotos no PDF</p>
                      <p className="text-xs text-slate-500">Inclui as fotos anexadas no final do documento PDF.</p>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, exibirFotosNoPdf: !formData.exibirFotosNoPdf })}
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        formData.exibirFotosNoPdf ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                        formData.exibirFotosNoPdf ? 'right-1' : 'left-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Salvar Configurações
                </button>
              </div>
            </div>
          )}

          {activeTab === 'termos' && (
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <FileSignature className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Termos e Condições</h3>
                  <p className="text-sm text-slate-500">Defina o termo de garantia e observações padrão para seus documentos.</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Termo de Garantia Padrão</label>
                <textarea
                  rows={6}
                  value={formData.termoGarantia}
                  onChange={e => setFormData({ ...formData, termoGarantia: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Ex: A garantia deste serviço é de 90 dias contra defeitos de fabricação das peças ou falha na execução..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Salvar Termos
                </button>
              </div>
            </div>
          )}

          {activeTab === 'integracoes' && (
            <div className="p-8 space-y-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Cloud className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Integrações</h3>
                  <p className="text-sm text-slate-500">Conecte o sistema com serviços externos para automatizar tarefas.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Google Integration Card */}
                <div className="p-6 border border-slate-200 rounded-2xl space-y-4 bg-white shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">Google Workspace</h4>
                        <p className="text-xs text-slate-500">Gmail & Google Drive</p>
                      </div>
                    </div>
                    {googleTokens ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-full">
                        Conectado
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded-full">
                        Desconectado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    Conecte sua conta Google para enviar orçamentos por email e realizar backups automáticos no Google Drive.
                  </p>

                  {driveBackupFolder && (
                    <div className="flex items-center justify-between gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <div>
                        <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Pasta de Backups</p>
                        <p className="text-sm text-blue-900">{driveBackupFolder.folderName}</p>
                      </div>
                      <a
                        href={driveBackupFolder.folderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-white text-blue-700 rounded-xl font-bold border border-blue-200 hover:bg-blue-50 transition-all"
                      >
                        Abrir no Drive
                      </a>
                    </div>
                  )}

                  {googleConfigError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <p className="text-[11px] text-red-800 leading-tight">{googleConfigError}</p>
                    </div>
                  )}

                  {isNativeRuntime() && (
                    <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-slate-600 shrink-0" />
                        <p className="text-[11px] text-slate-700 leading-tight">
                          Informe a URL do backend HTTPS para habilitar Google Login, Gmail e Google Drive neste APK.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={backendUrl}
                          onChange={(e) => setBackendUrl(e.target.value)}
                          placeholder="https://api.seudominio.com.br"
                          className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                        <button
                          onClick={handleSaveBackendUrl}
                          disabled={isSavingBackendUrl}
                          className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSavingBackendUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Salvar
                        </button>
                      </div>
                      {isAndroidAppWithoutBackend && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <p className="text-[11px] text-red-800 leading-tight">
                            <strong>Backend não configurado no APK:</strong> informe acima a URL do backend HTTPS. Sem isso, Google Login, Gmail e Google Drive não funcionam no Android.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {googleConfig && new URL(googleConfig.redirectUri).origin !== window.location.origin && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <p className="text-[11px] text-red-800 leading-tight">
                        <strong>Integração não conclui neste ambiente:</strong> o callback OAuth está apontando para <strong>{new URL(googleConfig.redirectUri).origin}</strong>, mas este app está aberto em <strong>{window.location.origin}</strong>.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-[11px] text-amber-800 leading-tight">
                      <strong>Nota:</strong> Estas integrações requerem conexão ativa com a internet e não funcionam em modo offline.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <Cloud className="w-4 h-4 text-slate-600 shrink-0" />
                    <p className="text-[11px] text-slate-700 leading-tight">
                      <strong>Retenção automática:</strong> somente os 3 backups mais recentes são mantidos no Google Drive desta conta.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {googleTokens ? (
                      <>
                        <button
                          onClick={handleBackupToDrive}
                          disabled={isBackingUp}
                          className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                          Backup Drive
                        </button>
                        <button
                          onClick={handleBackupEmail}
                          disabled={isBackingUp}
                          className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailIcon className="w-4 h-4" />}
                          Backup Email
                        </button>
                        <button
                          onClick={handleDisconnectGoogle}
                          className="px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                          title="Desconectar"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleConnectGoogle}
                        disabled={isAndroidAppWithoutBackend}
                        className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Globe className="w-4 h-4" />
                        Conectar Google
                      </button>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Backup e Restauração Local</h5>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadBackup}
                        disabled={isBackingUp}
                        className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Baixar Backup
                      </button>
                      <label className="flex-1 py-2.5 bg-white border-2 border-dashed border-slate-200 text-slate-500 rounded-xl font-bold hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2 cursor-pointer">
                        <RefreshCw className="w-4 h-4" />
                        Restaurar .enc
                        <input type="file" className="hidden" accept=".enc" onChange={handleImportFile} />
                      </label>
                    </div>
                    <button
                      onClick={handleOpenRestoreModal}
                      disabled={!googleTokens || isBackingUp}
                      className="w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Cloud className="w-4 h-4" />
                      Restaurar do Drive
                    </button>
                  </div>
                </div>

                {/* WhatsApp Card (Placeholder) */}
                <div className="p-6 border border-slate-200 rounded-2xl space-y-4 bg-slate-50/50 opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                        <Phone className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">WhatsApp Business</h4>
                        <p className="text-xs text-slate-500">API Oficial</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-full">
                      Em breve
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Envie notificações automáticas de status e lembretes de agendamento diretamente para o WhatsApp do cliente.
                  </p>
                  <button disabled className="w-full py-2.5 bg-slate-200 text-slate-400 rounded-xl font-bold cursor-not-allowed">
                    Indisponível
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'usuarios' && (
            <div className="p-8 space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Users className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Gestão de Usuários</h3>
                    <p className="text-sm text-slate-500">Cadastre e gerencie os usuários que têm acesso ao sistema.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setUserFormData({ nome: '', email: '', senha: '', role: 'tecnico' });
                    setIsUserModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  <Plus className="w-4 h-4" />
                  Novo Usuário
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Nome</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Email</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Cargo</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4 font-medium text-slate-900">{u.nome}</td>
                        <td className="py-4 px-4 text-slate-600">{u.email}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            u.role === 'adm' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.role === 'adm' ? 'Administrador' : 'Técnico'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setUserFormData({ nome: u.nome, email: u.email, senha: '', role: u.role });
                                setIsUserModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingUserId(u.id)}
                              className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {usuarios.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400">
                          Nenhum usuário cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* User Modal */}
        <Modal
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          title={editingUser ? "Editar Usuário" : "Cadastrar Novo Usuário"}
        >
          <form onSubmit={handleSaveUser} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={userFormData.nome}
                  onChange={e => setUserFormData({ ...userFormData, nome: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Ex: João Silva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="exemplo@gmail.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Senha {editingUser && '(Deixe em branco para manter)'}</label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userFormData.senha}
                  onChange={e => setUserFormData({ ...userFormData, senha: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                />
                <p className="text-[10px] text-slate-400 italic">Senha para acesso ao sistema.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Cargo / Role</label>
                <select
                  value={userFormData.role}
                  onChange={e => setUserFormData({ ...userFormData, role: e.target.value as 'adm' | 'tecnico' })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="tecnico">Técnico (Acesso limitado)</option>
                  <option value="adm">Administrador (Acesso total)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {editingUser ? "Atualizar" : "Cadastrar"}
              </button>
            </div>
          </form>
        </Modal>

        <Modal
          isOpen={isRestoreModalOpen}
          onClose={() => setIsRestoreModalOpen(false)}
          title="Restaurar Backup do Google Drive"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Selecione um backup salvo na sua conta Google para restaurar neste aparelho.
            </p>

            {isLoadingDriveBackups ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : driveBackups.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl text-sm text-slate-500 text-center">
                Nenhum backup encontrado no Google Drive desta conta.
              </div>
            ) : (
              <div className="space-y-3">
                {driveBackups.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between gap-4 p-4 border border-slate-200 rounded-2xl">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{backup.name}</p>
                      <p className="text-xs text-slate-500">
                        {backup.createdTime ? new Date(backup.createdTime).toLocaleString('pt-BR') : 'Data desconhecida'}
                        {backup.size ? ` • ${Math.round(Number(backup.size) / 1024)} KB` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestoreFromDrive(backup.id)}
                      disabled={restoringBackupId !== null}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 min-w-[110px]"
                    >
                      {restoringBackupId === backup.id ? 'Restaurando...' : 'Restaurar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>

        {/* Logout Section */}
        <div className="flex justify-center pt-8">
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-6 py-2 text-red-600 hover:bg-red-50 rounded-xl font-bold transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sair do Sistema
          </button>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão de Usuário */}
      <Modal
        isOpen={!!deletingUserId}
        onClose={() => setDeletingUserId(null)}
        title="Confirmar Exclusão"
      >
        <div className="space-y-6">
          <p className="text-slate-600">
            Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeletingUserId(null)}
              className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteUser}
              disabled={isDeletingUser}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
            >
              {isDeletingUser ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
