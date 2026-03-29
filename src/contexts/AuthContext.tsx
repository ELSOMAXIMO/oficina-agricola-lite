import React, { createContext, useContext, useState, useEffect } from 'react';
import { sqlDbService } from '../services/sqlDbService';
import bcrypt from 'bcryptjs';

interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  role: 'adm' | 'tecnico' | null;
  loading: boolean;
  loginWithEmail: (email: string, senha: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  checkInitial: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<'adm' | 'tecnico' | null>(null);
  const [loading, setLoading] = useState(true);

  const checkInitial = async () => {
    try {
      const results = await sqlDbService.query(
        "SELECT value FROM system_config WHERE key = 'initialized'"
      );
      return results.length > 0 && results[0].value === 'true';
    } catch (error) {
      console.error("Erro ao verificar usuários iniciais:", error);
      return true; 
    }
  };

  const loginWithEmail = async (email: string, senha: string, rememberMe: boolean = false) => {
    try {
      const results = await sqlDbService.query(
        "SELECT * FROM usuarios WHERE email = ?",
        [email]
      );
      
      if (results.length === 0) {
        throw new Error("Email ou senha incorretos.");
      }
      
      const userData = results[0];
      const isPasswordValid = bcrypt.compareSync(senha, userData.senha);
      
      if (!isPasswordValid) {
        throw new Error("Email ou senha incorretos.");
      }
      
      const appUser: AppUser = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.nome,
        photoURL: null
      };
      
      setUser(appUser);
      setRole(userData.role as 'adm' | 'tecnico');
      
      // Save session
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('auth_user', JSON.stringify(appUser));
      storage.setItem('auth_role', userData.role);
    } catch (error) {
      console.error("Erro ao fazer login com email:", error);
      throw error;
    }
  };

  const logout = async () => {
    setUser(null);
    setRole(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_role');
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_role');
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await sqlDbService.init();
        const savedUser = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
        const savedRole = localStorage.getItem('auth_role') || sessionStorage.getItem('auth_role');
        
        if (savedUser && savedRole) {
          setUser(JSON.parse(savedUser));
          setRole(savedRole as 'adm' | 'tecnico');
        }
      } catch (error) {
        console.error("Erro ao inicializar autenticação:", error);
      } finally {
        console.log("[AUTH] Loading finished, setting loading to false");
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, loginWithEmail, logout, checkInitial }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

