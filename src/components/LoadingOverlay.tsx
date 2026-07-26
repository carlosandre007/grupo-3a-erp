import React from 'react';
import { Loader2, FolderOpen, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface LoadingOverlayProps {
  state: 'idle' | 'loading' | 'empty' | 'success' | 'error';
  emptyTitle?: string;
  emptyDesc?: string;
  errorTitle?: string;
  errorDesc?: string;
  successTitle?: string;
  successDesc?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
}

export default function LoadingOverlay({
  state,
  emptyTitle = "Nenhum registro encontrado",
  emptyDesc = "Experimente mudar os filtros ou adicione um novo registro.",
  errorTitle = "Erro ao carregar informações",
  errorDesc = "Não foi possível sincronizar com o banco de dados temporário. Verifique seu navegador.",
  successTitle = "Sucesso na operação!",
  successDesc = "O registro foi gravado com sucesso.",
  onRetry,
  children
}: LoadingOverlayProps) {
  
  if (state === 'idle' || !state) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center min-h-[300px] w-full animate-fade-in bg-white rounded-xl border border-outline-variant/30 custom-shadow">
      {state === 'loading' && (
        <div className="space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <div>
            <h3 className="font-display font-bold text-on-surface text-base">Sincronizando Dados...</h3>
            <p className="text-xs text-secondary max-w-sm mt-1 mx-auto">
              Carregando estruturas patrimoniais e financeiras consolidadas do Grupo 3A...
            </p>
          </div>
        </div>
      )}

      {state === 'empty' && (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto border border-outline-variant/30">
            <FolderOpen className="w-8 h-8 text-secondary" />
          </div>
          <div>
            <h3 className="font-display font-bold text-on-surface text-base">{emptyTitle}</h3>
            <p className="text-xs text-secondary max-w-sm mt-1 mx-auto">{emptyDesc}</p>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto border border-red-100">
            <AlertOctagon className="w-8 h-8 text-error" />
          </div>
          <div>
            <h3 className="font-display font-bold text-error text-base">{errorTitle}</h3>
            <p className="text-xs text-secondary max-w-sm mt-1 mx-auto mb-4">{errorDesc}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-on-background text-white text-xs font-semibold rounded hover:bg-neutral-800 transition-colors"
              >
                Tentar Novamente
              </button>
            )}
          </div>
        </div>
      )}

      {state === 'success' && (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto border border-green-100">
            <CheckCircle2 className="w-8 h-8 text-green-600 animate-bounce" />
          </div>
          <div>
            <h3 className="font-display font-bold text-green-700 text-base">{successTitle}</h3>
            <p className="text-xs text-secondary max-w-sm mt-1 mx-auto">{successDesc}</p>
          </div>
        </div>
      )}
    </div>
  );
}
