import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      
      try {
        const message = this.state.error?.message;
        if (message && (message.trim().startsWith('{') || message.trim().startsWith('['))) {
          const errorData = JSON.parse(message);
          if (errorData && typeof errorData === 'object' && errorData.error && errorData.operationType) {
            errorMessage = `Erro de permissão no Firestore (${errorData.operationType}): ${errorData.error}`;
          } else {
            errorMessage = message;
          }
        } else if (message) {
          errorMessage = message;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-6 border border-slate-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">Ops! Algo deu errado</h1>
              <p className="text-slate-600">{errorMessage}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
            >
              <RefreshCw className="w-5 h-5" />
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
