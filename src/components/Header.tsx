import React, { useEffect, useState } from 'react';
import { Menu, Bell, AlertTriangle, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getActiveAlerts } from './AlertsPanel';
import { useAuth } from '../auth/AuthContext';

interface HeaderProps {
  onMenuToggleMobile: () => void;
  isSidebarCollapsed: boolean;
  onClose: () => void;
}

export default function Header({ onMenuToggleMobile, isSidebarCollapsed: _isSidebarCollapsed, onClose }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [alertsHidden] = useState(() => sessionStorage.getItem('erp_alerts_hidden') === 'true');
  const [, setDataVersion] = useState(0);
  const alertCount = getActiveAlerts().length;
  useEffect(() => { const update = () => setDataVersion(v => v + 1); window.addEventListener('erp-data-updated', update); return () => window.removeEventListener('erp-data-updated', update); }, []);

  // Determine current context name based on route
  const getContextName = () => {
    switch (location.pathname) {
      case '/':
        return 'DASHBOARD GERAL';
      case '/fluxo-caixa':
        return 'FLUXO DE CAIXA';
      case '/calendario-cobranca':
        return 'CALENDÁRIO DE COBRANÇAS';
      case '/imoveis':
        return 'GESTÃO DE IMÓVEIS';
      case '/veiculos':
        return 'LOC MOTTUS (FROTA)';
      case '/equipamentos':
        return '3A RASTREAR (ATIVOS)';
      case '/clientes':
        return 'GESTÃO DE CLIENTES';
      case '/empresas':
        return 'EMPRESAS DO GRUPO';
      case '/backup':
        return 'BACKUP DO SISTEMA';
      case '/bancos':
        return 'BANCOS E CONTAS';
      case '/custo-fixo':
        return 'CUSTO FIXO MENSAL';
      case '/alertas':
        return 'CENTRAL DE ALERTAS';
      case '/investimentos':
        return 'INVESTIMENTOS';
      default:
        return 'GRUPO 3A';
    }
  };

  return (<>
    <header className="relative shrink-0 min-h-16 bg-white border-b border-outline-variant flex justify-between items-center px-4 md:px-8 shadow-sm">
      <div className="flex items-center gap-4">
        {/* Toggle mobile sidebar */}
        <button 
          onClick={onMenuToggleMobile}
          className="md:hidden p-2 hover:bg-gray-100 rounded text-primary transition-colors focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="font-display font-black text-primary text-base md:text-lg tracking-tight select-none">
            {getContextName()}
          </h1>
          <p className="hidden md:block text-[10px] text-gray-400 font-semibold uppercase tracking-wider -mt-1">
            ERP GRUPO 3A • CONSOLIDADO
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Rapid Alert Info Badge matching design */}
        {!alertsHidden && <button onClick={() => navigate('/alertas')} className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-full cursor-pointer transition-colors text-xs font-semibold">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{alertCount} ALERTAS ATIVOS</span>
          <span className="sm:hidden">{alertCount} ALER.</span>
        </button>}

        {/* Notifications */}
        <button onClick={() => navigate('/alertas')} className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-full transition-colors relative" aria-label="Abrir alertas">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full animate-ping" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full" />
        </button>

        {/* Profile menu toggle */}
        <div className="relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shadow-inner">
              E3A
            </div>
          </button>

          {/* Profile Popover Dropdown */}
          {showProfileMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowProfileMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white border border-outline-variant rounded-lg shadow-xl py-2 z-50 animate-fade-in">
                <div className="px-4 py-2 border-b border-outline-variant/30">
                  <p className="font-semibold text-xs text-on-surface">{profile?.display_name || 'Usuário autenticado'}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Perfil: {profile?.role}</p>
                </div>
                <button onClick={()=>void signOut()} className="w-full px-4 py-2 text-left text-xs font-bold text-red-700 hover:bg-red-50">Encerrar sessão</button>
                <div className="px-4 py-2 border-t border-outline-variant/30 text-[10px] text-gray-400">
                  Sistema online v1.0.0
                </div>
              </div>
            </>
          )}
        </div>
        <button onClick={onClose} className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-full transition-colors" title="Fechar barra superior" aria-label="Fechar barra superior"><X className="w-5 h-5" /></button>
      </div>
    </header>
    </>
  );
}
