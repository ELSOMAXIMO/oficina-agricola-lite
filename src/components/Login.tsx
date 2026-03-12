import React, { useState, useEffect } from 'react';
import { Tractor, LogIn, Mail, Lock, Loader2, UserPlus, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import bcrypt from 'bcryptjs';

export const Login: React.FC = () => {
  const { loginWithEmail, checkInitial } = useAuth();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [nome, setNome] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const check = async () => {
      const exists = await checkInitial();
      setHasUsers(exists);
    };
    check();
  }, [checkInitial]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await loginWithEmail(email, senha, rememberMe);
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const { sqlDbService } = await import('../services/sqlDbService');
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const now = new Date().toISOString();
      const hashedPassword = bcrypt.hashSync(senha, 10);

      await sqlDbService.run(
        "INSERT INTO usuarios (id, uid, nome, email, senha, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, id, nome, email, hashedPassword, 'adm', now, now]
      );

      // Mark system as initialized
      await sqlDbService.run(
        "INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
        ['initialized', 'true']
      );
      
      toast.success('Administrador criado com sucesso! O sistema está pronto.');
      setHasUsers(true);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar administrador');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (hasUsers === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Verificando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Left Side: Brand & Visuals */}
      <div className="hidden md:flex md:w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.2),transparent_70%)]"></div>
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8">
              <Globe className="w-4 h-4" />
              Gestão Inteligente
            </div>
            
            <h1 className="text-6xl lg:text-7xl font-black text-white leading-tight mb-6 tracking-tighter">
              OFICINA<br />
              <span className="text-emerald-500">AGRÍCOLA</span>
            </h1>
            
            <p className="text-slate-400 text-lg leading-relaxed mb-12 font-medium">
              Potencialize sua produtividade com o sistema de gestão mais avançado para manutenção de máquinas pesadas e implementos.
            </p>
            
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-3xl font-bold text-white mb-1">99.9%</div>
                <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Disponibilidade</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">+500</div>
                <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Máquinas Atendidas</div>
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* Decorative Element */}
        <div className="absolute bottom-12 left-12 flex items-center gap-4 text-slate-500">
          <Tractor className="w-6 h-6" />
          <span className="text-xs font-bold tracking-widest uppercase">Hardware Specialist Tool v2.0</span>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-16 lg:p-24 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="md:hidden flex justify-center mb-12">
            <div className="bg-emerald-600 p-4 rounded-2xl shadow-xl shadow-emerald-200">
              <Tractor className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="mb-12">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
              {hasUsers ? 'Bem-vindo de volta' : 'Configuração Inicial'}
            </h2>
            <p className="text-slate-500 font-medium">
              {hasUsers 
                ? 'Acesse sua conta para gerenciar as ordens de serviço.' 
                : 'Crie a conta mestre para começar a utilizar o sistema.'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!hasUsers ? (
              <motion.form
                key="setup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleCreateAdmin}
                className="space-y-6"
              >
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <p className="text-sm text-amber-700 font-bold flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Primeiro Acesso Detectado
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Defina as credenciais do administrador do sistema.
                  </p>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input 
                    type="text"
                    required
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium placeholder:text-slate-300"
                    placeholder="Ex: João da Silva"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium placeholder:text-slate-300"
                    placeholder="adm@oficina.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
                  <input 
                    type="password"
                    required
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium placeholder:text-slate-300"
                    placeholder="••••••••"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xl shadow-emerald-200 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                  Finalizar Configuração
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleEmailLogin}
                className="space-y-6"
              >
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-14 pr-5 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium placeholder:text-slate-300"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Senha</label>
                    <button type="button" className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider">Esqueceu?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="password"
                      required
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                      className="w-full pl-14 pr-5 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium placeholder:text-slate-300"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex items-center ml-1">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-6 h-6 border-2 border-slate-200 rounded-lg bg-white peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all"></div>
                      <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity left-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Manter conectado</span>
                  </label>
                </div>

                <button 
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xl shadow-emerald-200 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  Entrar no Sistema
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col items-center gap-4">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] text-center">
              © 2026 Oficina Agrícola • Todos os direitos reservados
            </p>
            <div className="flex items-center gap-6">
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Segurança SSL</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
