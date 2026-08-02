import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  Coins,
  PiggyBank,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "../components/StatCard";
import { repository } from "../repositories";
import type { EntityRecord } from "../repositories";
import type { Transaction } from "../types";
import { getManualInvestment } from "../services/manualInvestment";
const money = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const iso = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};
type CompanyUnit="mottus"|"rastrear"|"imoveis";
const companyUnit=(value:string):CompanyUnit|null=>{
  const normalized=value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  if(normalized.includes("MOTTUS"))return"mottus";
  if(normalized.includes("RASTREAR"))return"rastrear";
  if(normalized.includes("IMOVE"))return"imoveis";
  return null;
};
export default function Dashboard() {
  const navigate = useNavigate();
  const[data,setData]=useState<{transactions:Transaction[];accounts:EntityRecord[];properties:EntityRecord[];vehicles:EntityRecord[];investments:EntityRecord[];charges:EntityRecord[];metrics:EntityRecord[]}>({transactions:[],accounts:[],properties:[],vehicles:[],investments:[],charges:[],metrics:[]});
  const[manualInvestment,setManualInvestment]=useState<number|null>(null);
  const[fixedCosts,setFixedCosts]=useState<EntityRecord[]>([]);
  useEffect(()=>{let active=true;Promise.all([getManualInvestment(),repository.list('fixed_costs')]).then(([investment,costs])=>{if(active){setManualInvestment(investment?.value??null);setFixedCosts(costs)}}).catch(()=>{if(active){setManualInvestment(null);setFixedCosts([])}});return()=>{active=false}},[]);
  useEffect(()=>{let active=true;const all=async(module:Parameters<typeof repository.list>[0],orderBy='id')=>{if(!repository.listPage)return repository.list(module);const rows:EntityRecord[]=[];for(let offset=0;;offset+=1000){const page=await repository.listPage(module,offset,1000,orderBy,true);rows.push(...page.records);if(rows.length>=page.total||page.records.length<1000)break}return rows};Promise.all([all('transactions','transaction_date'),all('companies'),all('bank_accounts'),all('assets'),all('properties'),all('vehicles'),all('investments'),all('charges'),all('company_metrics')]).then(([transactionRows,companies,accounts,assets,propertyRows,vehicleRows,investments,charges,metrics])=>{if(!active)return;const names=new Map(companies.map(company=>[company.id,String(company.name||'')])),assetById=new Map(assets.map(asset=>[asset.id,asset])),properties=propertyRows.map(row=>({...assetById.get(row.id),...row})),vehicles=vehicleRows.map(row=>({...assetById.get(row.id),...row}));setData({transactions:transactionRows.map(row=>({id:row.id,date:String(row.transaction_date||''),description:String(row.description||''),company:String(names.get(String(row.company_id||''))||'')as Transaction['company'],companyId:String(row.company_id||''),clientOrProvider:String(row.client_id||''),assetId:String(row.asset_id||''),bankAccountId:String(row.bank_account_id||''),category:String(row.category_id||''),value:Number(row.value||0),type:(row.type||'despesa')as Transaction['type'],status:(row.status||'pendente')as Transaction['status'],investmentKind:/invest/i.test(String(row.investment_kind||row.source_module||row.origem||''))?'investimento':'operacional'})),accounts,properties,vehicles,investments,charges,metrics})}).catch(()=>{if(active)setData({transactions:[],accounts:[],properties:[],vehicles:[],investments:[],charges:[],metrics:[]})});return()=>{active=false}},[]);
  const [period, setPeriod] = useState<"ano" | "mes" | "hoje" | "custom">(
      "mes",
    ),
    [showCustom, setShowCustom] = useState(false),
    [customStart, setCustomStart] = useState(""),
    [customEnd, setCustomEnd] = useState("");
  const now = new Date();
  const range = useMemo(() => {
    if (period === "custom")
      return { start: customStart, end: customEnd || iso(now) };
    const start = new Date(now);
    if (period === "ano") start.setMonth(0, 1);
    else if (period === "mes") start.setDate(1);
    return { start: iso(start), end: iso(now) };
  }, [period, customStart, customEnd]);
  const allTransactions = data.transactions.filter(transaction=>transaction.nature!=='caucao_passivo');
  const currentMonthKey=iso(now).slice(0,7);
  const previousMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1);
  const previousMonthKey=`${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth()+1).padStart(2,"0")}`;
  const transactionsInMonth=(key:string)=>allTransactions.filter(transaction=>transaction.date.startsWith(key));
  const paidInMonth=(key:string)=>transactionsInMonth(key).filter(transaction=>transaction.status==='pago');
  const currentMonthTransactions=transactionsInMonth(currentMonthKey);
  const currentMonthPaidTransactions=paidInMonth(currentMonthKey);
  const previousMonthTransactions=paidInMonth(previousMonthKey);
  const monthlyRevenue=currentMonthTransactions.filter(transaction=>transaction.type==='receita').reduce((sum,transaction)=>sum+Math.abs(transaction.value),0);
  const monthlyExpense=currentMonthTransactions.filter(transaction=>transaction.type==='despesa').reduce((sum,transaction)=>sum+Math.abs(transaction.value),0);
  const monthlyCashFlow=currentMonthPaidTransactions.reduce((sum,transaction)=>sum+(transaction.type==='receita'?Math.abs(transaction.value):-Math.abs(transaction.value)),0);
  const previousMonthlyCashFlow=previousMonthTransactions.reduce((sum,transaction)=>sum+(transaction.type==='receita'?Math.abs(transaction.value):-Math.abs(transaction.value)),0);
  const monthlyGrowth=previousMonthlyCashFlow===0?0:((monthlyCashFlow-previousMonthlyCashFlow)/Math.abs(previousMonthlyCashFlow))*100;
  const transactions = allTransactions.filter(
    (t) =>
      t.status === "pago" &&
      (!range.start || t.date >= range.start) &&
      (!range.end || t.date <= range.end),
  );
  const revenues = transactions
    .filter((t) => t.type === "receita")
    .reduce((s, t) => s + Math.abs(t.value), 0);
  const expenses = transactions
    .filter((t) => t.type === "despesa")
    .reduce((s, t) => s + Math.abs(t.value), 0);
  const cash = data.accounts.filter(account=>account.active!==false).reduce((sum,account)=>{
    if(account.current_balance!==undefined&&account.current_balance!==null)return sum+Number(account.current_balance||0);
    return sum+Number(account.initial_balance||0)+allTransactions.filter(transaction=>transaction.status==='pago'&&transaction.bankAccountId===account.id).reduce((balance,transaction)=>balance+(transaction.type==='receita'?Math.abs(transaction.value):-Math.abs(transaction.value)),0);
  },0);
  const investedAccount=data.accounts.find(account=>
    /investido atual/i.test(String(account.account_name??account.name??account.bank_name??account.banco??'')));
  const investedCurrent=investedAccount
    ? Number(investedAccount.current_balance??investedAccount.balance??investedAccount.initial_balance??0)
    : manualInvestment;
  const properties = data.properties,
    vehicles = data.vehicles;
  const currentOperationalCosts=fixedCosts
    .filter(cost=>
      (Number(cost.year)===Number(currentMonthKey.slice(0,4))
        && Number(cost.month)===Number(currentMonthKey.slice(5,7)))
      || String(cost.due_date||'').startsWith(currentMonthKey))
    .reduce((sum,cost)=>sum+Number(cost.total??cost.price??0),0);
  const previousRange = useMemo(() => {
    const start = new Date(`${range.start || iso(now)}T12:00:00`),
      end = new Date(`${range.end}T12:00:00`),
      days = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
      );
    const pEnd = new Date(start);
    pEnd.setDate(pEnd.getDate() - 1);
    const pStart = new Date(pEnd);
    pStart.setDate(pStart.getDate() - days + 1);
    return { start: iso(pStart), end: iso(pEnd) };
  }, [range]);
  const previousCashFlow = allTransactions
    .filter(
      (t) =>
        t.status === "pago" &&
        t.date >= previousRange.start &&
        t.date <= previousRange.end,
    )
    .reduce(
      (s, t) =>
        s + (t.type === "receita" ? Math.abs(t.value) : -Math.abs(t.value)),
      0,
    );
  const currentCashFlow = revenues - expenses;
  const growth =
    previousCashFlow === 0
      ? 0
      : ((currentCashFlow - previousCashFlow) / Math.abs(previousCashFlow)) *
        100;
  const chartEnd = new Date(`${range.end || iso(now)}T12:00:00`);
  const months = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const date = new Date(
          chartEnd.getFullYear(),
          chartEnd.getMonth() - 5 + index,
          1,
        );
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const list = allTransactions.filter(
          (t) =>
            t.status === "pago" &&
            t.date.startsWith(key) &&
            (!range.start || t.date >= range.start) &&
            (!range.end || t.date <= range.end),
        );
        return {
          name: date
            .toLocaleDateString("pt-BR", { month: "short" })
            .replace(".", ""),
          Receitas: list
            .filter((t) => t.type === "receita")
            .reduce((s, t) => s + Math.abs(t.value), 0),
          Despesas: list
            .filter((t) => t.type === "despesa")
            .reduce((s, t) => s + Math.abs(t.value), 0),
        };
      }),
    [allTransactions, range.start, range.end],
  );
  const annualFlow=useMemo(
    ()=>Array.from({length:12},(_,month)=>{
      const date=new Date(now.getFullYear(),month,1);
      const key=`${date.getFullYear()}-${String(month+1).padStart(2,"0")}`;
      const list=allTransactions.filter(transaction=>transaction.status==="pago"&&transaction.date.startsWith(key));
      return{
        name:date.toLocaleDateString("pt-BR",{month:"short"}).replace(".",""),
        Receitas:list.filter(transaction=>transaction.type==="receita").reduce((sum,transaction)=>sum+Math.abs(transaction.value),0),
        Despesas:list.filter(transaction=>transaction.type==="despesa").reduce((sum,transaction)=>sum+Math.abs(transaction.value),0),
      };
    }),
    [allTransactions,now.getFullYear()],
  );
  const companyStats = (company: "LOC MOTTUS" | "3A RASTREAR" | "IMÓVEIS") => {
    const list = transactions.filter((t) => companyUnit(t.company)===companyUnit(company));
    const receipt = list
        .filter((t) => t.type === "receita")
        .reduce((s, t) => s + Math.abs(t.value), 0),
      cost = list
        .filter((t) => t.type === "despesa")
        .reduce((s, t) => s + Math.abs(t.value), 0);
    return {
      receipt,
      cost,
      result: receipt - cost,
      monthly: months.map((m, index) => {
        const date = new Date(
            chartEnd.getFullYear(),
            chartEnd.getMonth() - 5 + index,
            1,
          ),
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const companyList = allTransactions.filter(
          (t) =>
            companyUnit(t.company)===companyUnit(company) &&
            t.status === "pago" &&
            t.date.startsWith(key) &&
            (!range.start || t.date >= range.start) &&
            (!range.end || t.date <= range.end),
        );
        return {
          month: m.name,
          value: companyList.reduce(
            (s, t) =>
              s +
              (t.type === "receita" ? Math.abs(t.value) : -Math.abs(t.value)),
            0,
          ),
        };
      }),
      count:list.length,
    };
  };
  const mottus = companyStats("LOC MOTTUS"),
    rastrear = companyStats("3A RASTREAR"),
    imoveis = companyStats("IMÓVEIS");
  const pieData = [
    { name: "LOC MOTTUS", value: mottus.receipt, color: "#ffc300" },
    { name: "3A RASTREAR", value: rastrear.receipt, color: "#293138" },
    { name: "IMÓVEIS", value: imoveis.receipt, color: "#81765f" },
  ];
  const totalPie = pieData.reduce((s, i) => s + i.value, 0);
  const mottusCompanyIds=new Set(allTransactions.filter(transaction=>companyUnit(transaction.company)==='mottus').map(transaction=>transaction.companyId).filter(Boolean));
  const overdue = data.charges.filter(charge=>
    mottusCompanyIds.has(String(charge.company_id||''))&&
    (charge.status==='vencido'||(charge.status==='pendente'&&String(charge.due_date||'')<iso(now)))
  ).length;
  const activeProperties = properties.filter((property) => property.status !== "manutencao"),
    occupancy = activeProperties.length
      ? Math.round(
          (activeProperties.filter((property) => property.status === "alugado").length /
            activeProperties.length) *
            100,
        )
      : 0;
  const setPreset = (value: "ano" | "mes" | "hoje") => {
    setPeriod(value);
    setShowCustom(false);
  };
  const unitCard = (
    title: string,
    route: string,
    stats: {
      receipt: number;
      result: number;
      monthly: { month: string; value: number }[];
    },
    secondaryLabel: string,
    secondaryValue: string,
  ) => (
    <article
      role="button"
      tabIndex={0}
      onClick={() => navigate(route)}
      onKeyDown={(e) => e.key === "Enter" && navigate(route)}
      className="bg-white border border-outline-variant rounded-xl overflow-hidden custom-shadow flex flex-col group hover:border-primary-container hover:-translate-y-0.5 cursor-pointer transition-all"
    >
      <div className="h-36 bg-gradient-to-br from-inverse-surface to-secondary p-5 flex items-end relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <h4 className="relative text-white font-display font-black uppercase">
          {title}
        </h4>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] uppercase font-bold text-secondary">
              Receita
            </p>
            <b>{money(stats.receipt)}</b>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-secondary">
              {secondaryLabel}
            </p>
            <b>{secondaryValue}</b>
          </div>
        </div>
        <div className="h-16 bg-surface-container-low rounded">
          <ResponsiveContainer>
            <BarChart data={stats.monthly}>
              <Bar dataKey="value" fill="#ffc300" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-surface-container-low p-3 rounded">
          <p className="text-[9px] uppercase font-bold text-secondary">
            Resultado líquido
          </p>
          <b className={stats.result >= 0 ? "text-green-700" : "text-red-700"}>
            {money(stats.result)}
          </b>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(route);
          }}
          className="w-full border border-black py-2.5 font-bold text-xs uppercase hover:bg-black hover:text-white flex justify-center gap-2"
        >
          Ver Detalhes <ArrowRight className="w-4" />
        </button>
      </div>
    </article>
  );
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h2 className="font-display font-black text-lg">Dashboard</h2>
          <p className="text-xs text-secondary">
            Indicadores financeiros e operacionais consolidados do grupo.
          </p>
        </div>
        <div className="relative flex items-center gap-2">
          <span className="text-[10px] font-bold text-secondary">PERÍODO:</span>
          <div className="bg-white border p-1 rounded flex">
            <button
              onClick={() => setPreset("ano")}
              className={`px-3 py-1 text-xs rounded ${period === "ano" ? "bg-primary-container" : ""}`}
            >
              Este Ano
            </button>
            <button
              onClick={() => setPreset("mes")}
              className={`px-3 py-1 text-xs rounded ${period === "mes" ? "bg-primary-container" : ""}`}
            >
              Este Mês
            </button>
            <button
              onClick={() => setPreset("hoje")}
              className={`px-3 py-1 text-xs rounded ${period === "hoje" ? "bg-primary-container" : ""}`}
            >
              Hoje
            </button>
          </div>
          <button
            title="Período personalizado"
            onClick={() => {
              setShowCustom(!showCustom);
              setPeriod("custom");
            }}
            className={`p-2 border rounded ${period === "custom" ? "bg-primary-container" : "bg-white"}`}
          >
            <Calendar className="w-4" />
          </button>
          {showCustom && (
            <div className="absolute right-0 top-12 bg-white border rounded-lg shadow-xl p-3 z-20 flex gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border rounded p-2 text-xs"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border rounded p-2 text-xs"
              />
            </div>
          )}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-6">
        <button onClick={() => navigate("/bancos")} className="text-left">
          <StatCard
            title="Saldo do Mês"
            value={money(monthlyCashFlow)}
            trend={{
              value: `${monthlyGrowth >= 0 ? "+" : ""}${monthlyGrowth.toFixed(1)}%`,
              isPositive: monthlyGrowth >= 0,
            }}
            icon={<TrendingUp className="w-5 text-green-600" />}
            colorVariant="success"
          />
        </button>
        <button onClick={() => navigate("/bancos")} className="text-left">
          <StatCard
            title="Investido Atual"
            value={investedCurrent===null?"Não configurado":money(investedCurrent)}
            icon={<PiggyBank className="w-5 text-secondary" />}
          />
        </button>
        <button
          onClick={() => navigate("/fluxo-caixa?tipo=receita")}
          className="text-left"
        >
          <StatCard
            title="Receitas do Mês"
            value={money(monthlyRevenue)}
            icon={<Coins className="w-5 text-primary" />}
          />
        </button>
        <button
          onClick={() => navigate("/fluxo-caixa?tipo=despesa")}
          className="text-left"
        >
          <StatCard
            title="Despesas do Mês"
            value={money(monthlyExpense)}
            icon={<ShoppingCart className="w-5 text-error" />}
          />
        </button>
        <button onClick={() => navigate("/custo-fixo")} className="text-left">
          <StatCard
            title="Custos Operacionais"
            value={money(currentOperationalCosts)}
            icon={<ShoppingCart className="w-5 text-error" />}
          />
        </button>
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 bg-white border rounded-xl p-6 custom-shadow">
          <h3 className="font-display font-bold">Fluxo Mensal</h3>
          <p className="text-xs text-secondary mb-5">
            Comparativo anual de Receitas vs Despesas
          </p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={annualFlow}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Bar dataKey="Receitas" fill="#ffc300" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#293138" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="bg-white border rounded-xl p-6 custom-shadow">
          <h3 className="font-display font-bold">Por Empresa</h3>
          <p className="text-xs text-secondary">
            Participação na receita total
          </p>
          <div className="h-48 relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={55}
                  outerRadius={78}
                  dataKey="value"
                >
                  {pieData.map((i) => (
                    <Cell key={i.name} fill={i.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <b>100%</b>
              <small>Global</small>
            </div>
          </div>
          {pieData.map((i) => (
            <div key={i.name} className="flex justify-between text-xs py-1">
              <span>{i.name}</span>
              <b>
                {totalPie
                  ? `${((i.value / totalPie) * 100).toFixed(1)}%`
                  : "0%"}
              </b>
            </div>
          ))}
        </section>
      </div>
      <section>
        <h3 className="font-display font-black uppercase mb-5">
          Performance por Unidade
        </h3>
        <div className="grid md:grid-cols-3 gap-7">
          {unitCard(
            "LOC MOTTUS",
            "/veiculos",
            mottus,
            "Inadimplência",
            `${overdue} cobrança(s)`,
          )}
          {unitCard(
            "3A RASTREAR",
            "/equipamentos",
            rastrear,
            "Lançamentos no período",
            `${rastrear.count} lançamento(s)`,
          )}
          {unitCard(
            "IMÓVEIS",
            "/imoveis",
            imoveis,
            "Ocupação",
            `${occupancy}%`,
          )}
        </div>
      </section>
    </div>
  );
}
