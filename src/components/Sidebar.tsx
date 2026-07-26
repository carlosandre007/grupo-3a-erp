import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Coins,
  Briefcase,
  Settings,
  ChevronDown,
  ChevronLeft,
  X,
  Zap,
  PlusCircle,
  MinusCircle,
  CalendarPlus,
  UserPlus,
  Building2,
  WalletCards,
  Calendar,
  Repeat2,
  Landmark,
  Users,
  Bike,
  Radio,
  Building,
  History,
  ScrollText,
  AlertTriangle,
  TrendingUp,
  Megaphone,
  ArrowRightLeft,
} from "lucide-react";
interface Props {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (v: boolean) => void;
}
const groups = [
  {
    id: "financeiro",
    label: "FINANCEIRO",
    icon: Coins,
    items: [
      ["Fluxo de Caixa", "/fluxo-caixa", WalletCards],
      ["Marketing e CAC", "/marketing-cac", Megaphone],
      ["Agenda de Cobranças", "/calendario-cobranca", Calendar],
      ["Custo Fixo Mensal", "/custo-fixo", Repeat2],
      ["Bancos", "/bancos", Landmark],
    ],
  },
  {
    id: "patrimonio",
    label: "PATRIMÔNIO",
    icon: Briefcase,
    items: [
      ["Todos os bens", "/patrimonio", Briefcase],
      ["Imóveis", "/imoveis", Building2],
      ["Veículos — LOC MOTTUS", "/veiculos", Bike],
    ],
  },
  {
    id: "sistema",
    label: "SISTEMA",
    icon: Settings,
    items: [
      ["Alertas", "/alertas", AlertTriangle],
      ["Backup", "/backup", History],
      ["Migração e Sincronização", "/migracao", ArrowRightLeft],
      ["Log de Exclusões", "/log-exclusoes", ScrollText],
    ],
  },
] as const;
export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  isOpenMobile,
  setIsOpenMobile,
}: Props) {
  const location = useLocation(),
    navigate = useNavigate();
  const { profile } = useAuth();
  const [openGroup, setOpenGroup] = useState<string | null>(() =>
      sessionStorage.getItem("erp_sidebar_group"),
    ),
    [quick, setQuick] = useState(false);
  const toggle = (id: string) => {
    const next = openGroup === id ? null : id;
    setOpenGroup(next);
    next
      ? sessionStorage.setItem("erp_sidebar_group", next)
      : sessionStorage.removeItem("erp_sidebar_group");
  };
  const go = (path: string) => {
    navigate(path);
    setIsOpenMobile(false);
    setQuick(false);
  };
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-[55] md:hidden ${isOpenMobile ? "block" : "hidden"}`}
        onClick={() => setIsOpenMobile(false)}
      />
      <aside
        className={`fixed left-0 top-0 h-full z-[60] bg-inverse-surface text-white shadow-xl transition-all duration-300 flex flex-col ${isCollapsed ? "md:w-16" : "md:w-64"} w-72 ${isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <header className={`relative flex border-b border-white/10 ${isCollapsed ? "h-16 items-center justify-center md:px-2" : "h-52 flex-col items-center justify-center px-4"}`}>
          <div className={`flex items-center overflow-hidden ${isCollapsed ? "justify-center" : "flex-col gap-2"}`}>
            <button onClick={() => isCollapsed && setIsCollapsed(false)} title="GRUPO 3A ERP" className="shrink-0 flex items-center justify-center">
              <img src="/assets/logo-grupo-3a.png" alt="GRUPO 3A ERP" className={`${isCollapsed ? "w-11 h-11" : "w-36 h-36"} object-contain`} />
            </button>
            {(!isCollapsed || isOpenMobile) && (
              <b className="whitespace-nowrap text-primary-fixed">
                GRUPO 3A ERP
              </b>
            )}
          </div>
          <button
            className="md:hidden absolute right-3 top-3"
            onClick={() => setIsOpenMobile(false)}
            aria-label="Fechar menu"
          >
            <X />
          </button>
          {!isCollapsed && <button
            className="hidden md:block absolute right-3 top-3"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expandir sidebar" : "Reduzir sidebar"}
          >
            <ChevronLeft className={isCollapsed ? "rotate-180" : ""} />
          </button>}
        </header>
        <div className="p-3 relative">
          <button
            onClick={() => setQuick(!quick)}
            title="Acesso rápido"
            className={`w-full flex items-center gap-3 p-3 rounded-lg bg-primary-container text-black font-black text-xs ${isCollapsed ? "justify-center" : ""}`}
          >
            <Zap className="w-5" />
            {!isCollapsed && "ACESSO RÁPIDO"}
          </button>
          {quick && (
            <div
              className={`absolute top-16 ${isCollapsed ? "left-16" : "left-3 right-3"} w-56 bg-white text-black rounded-xl shadow-2xl border z-[80] p-2 space-y-1`}
            >
              {[
                ["Nova cobrança", "/calendario-cobranca?new=1", CalendarPlus],
                ["Nova receita", "/fluxo-caixa?new=receita", PlusCircle],
                ["Nova despesa", "/fluxo-caixa?new=despesa", MinusCircle],
                ["Novo cliente", "/clientes?new=1", UserPlus],
                ["Novo bem", "/imoveis?new=1", Building2],
              ].map(([label, path, Icon]) => (
                <button
                  key={path as string}
                  onClick={() => go(path as string)}
                  className="w-full flex gap-2 items-center p-2.5 rounded hover:bg-amber-50 text-xs font-bold"
                >
                  <Icon className="w-4" />
                  {label as string}
                </button>
              ))}
            </div>
          )}
        </div>
        <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpenMobile(false)}
            title="Dashboard"
            className={`flex items-center gap-3 p-3 rounded-lg ${location.pathname === "/" ? "bg-white/10 border-l-4 border-primary-fixed" : "hover:bg-white/5"} ${isCollapsed ? "justify-center" : ""}`}
          >
            <LayoutDashboard className="w-5" />
            {!isCollapsed && (
              <span className="text-xs font-bold">DASHBOARD</span>
            )}
          </Link>
          {groups.map((group) => {
            const active = group.items.some(
              (item) => location.pathname === item[1],
            );
            return (
              <div key={group.id} className="relative">
                <button
                  onClick={() => toggle(group.id)}
                  title={group.label}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg ${active || openGroup === group.id ? "bg-white/10 text-primary-fixed" : "hover:bg-white/5"} ${isCollapsed ? "justify-center" : ""}`}
                >
                  <group.icon className="w-5" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left text-xs font-bold">
                        {group.label}
                      </span>
                      <ChevronDown
                        className={`w-4 transition-transform ${openGroup === group.id ? "rotate-180" : ""}`}
                      />
                    </>
                  )}
                </button>
                {openGroup === group.id && (
                  <div
                    className={`${isCollapsed ? "absolute left-14 top-0 w-64 bg-inverse-surface shadow-2xl rounded-r-xl p-2 z-[75]" : "ml-4 mt-1"} space-y-1`}
                  >
                    {isCollapsed && (
                      <p className="px-3 py-2 text-[10px] font-black text-primary-fixed">
                        {group.label}
                      </p>
                    )}
                    {group.items.filter(([,path]) => !['/log-exclusoes','/backup','/migracao','/empresas'].includes(path) || profile?.role === 'owner').map(([label, path, Icon]) => (
                      <Link
                        key={path}
                        to={path}
                        title={label}
                        onClick={() => setIsOpenMobile(false)}
                        className={`flex items-center gap-3 p-2.5 rounded text-xs ${location.pathname === path ? "bg-primary-container text-black font-black" : "text-gray-300 hover:bg-white/5 hover:text-white"}`}
                      >
                        <Icon className="w-4 min-w-4" />
                        <span>{label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <footer className="p-3 border-t border-white/10 text-center text-[9px] text-gray-500">
          {!isCollapsed && "ERP GRUPO 3A"}
        </footer>
      </aside>
    </>
  );
}
