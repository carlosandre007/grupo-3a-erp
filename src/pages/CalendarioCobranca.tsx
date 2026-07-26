import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  Pencil,
  Trash2,
  Ban,
  Download,
} from "lucide-react";
import {
  addCharge,
  addDeletionLog,
  attachReceiptToCharge,
  deleteChargeOccurrence,
  endChargeRecurrence,
  getCharges,
  getBankAccounts,
  getClients,
  getProperties,
  getTransactions,
  getVehicles,
  markChargeAsPaid,
  saveRentalGuarantee,
  useRentalGuarantee,
  updateCharge,
} from "../mockData";
import { Charge, RentalGuarantee } from "../types";
import Modal from "../components/Modal";
import DeleteConfirmation from "../components/DeleteConfirmation";
import {
  generateRentalReceipt,
  getReceiptNumber,
  openRentalWhatsApp,
} from "../services/rentalReceipt";
import { generateSecurityDepositReceipt } from "../services/securityDepositReceipt";

const isoDate = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const blankGuarantee=():RentalGuarantee=>({id:crypto.randomUUID(),type:'none',value:0,status:'pendente',balance:0,history:[]});

export default function CalendarioCobranca() {
  const [searchParams] = useSearchParams();
  const [charges, setCharges] = useState<Charge[]>(getCharges);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterCompany, setFilterCompany] = useState("Todas as Empresas");
  const [view, setView] = useState<"month" | "week">("month");
  const [editing, setEditing] = useState<Charge | null>(null);
  const [editScope, setEditScope] = useState<"single" | "series">("single");
  const [protectedAction, setProtectedAction] = useState<{
    type: "delete" | "end" | "use_guarantee";
    charge: Charge;
    value?:number;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [payTarget, setPayTarget] = useState<Charge | null>(null);
  const [payAccountId, setPayAccountId] = useState("");
  const [newCharge, setNewCharge] = useState({
    assetId: "",
    clientId: "",
    value: "",
    dueDate: isoDate(new Date()),
    frequency: "mensal" as Charge["frequency"],
    category: "",
    guarantee: blankGuarantee(),
  });
  useEffect(()=>{if(searchParams.get("new")==="1")setCreating(true)},[searchParams]);
  const clients = getClients();
  const assets = [
    ...getVehicles().map((v) => ({
      id: v.id,
      code: v.code || "",
      name: v.model,
      type: v.kind === "carro" ? "Carro" : "Moto",
      status: v.status,
      company: "LOC MOTTUS" as const,
      value: v.rentalValue || 0,
      assetType: "veiculo" as const,
    })),
    ...getProperties()
      .filter((p) => p.code)
      .map((p) => ({
        id: p.id,
        code: p.code || "",
        name: p.name,
        type: p.type,
        status: p.status,
        company: "IMÓVEIS" as const,
        value: p.rentValue,
        assetType: "imovel" as const,
      })),
  ];

  const filtered = useMemo(
    () =>
      charges.filter(
        (c) =>
          filterCompany === "Todas as Empresas" || c.company === filterCompany,
      ),
    [charges, filterCompany],
  );
  const metrics = useMemo(
    () => ({
      pago: filtered
        .filter((c) => c.status === "pago")
        .reduce((a, c) => a + c.value, 0),
      pendente: filtered
        .filter((c) => c.status === "pendente")
        .reduce((a, c) => a + c.value, 0),
      vencido: filtered
        .filter((c) => c.status === "vencido")
        .reduce((a, c) => a + c.value, 0),
    }),
    [filtered],
  );

  const days = useMemo(() => {
    if (view === "week") {
      const start = new Date(cursor);
      start.setDate(cursor.getDate() - cursor.getDay());
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        return date;
      });
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  }, [cursor, view]);

  const selectedCharges = selectedDate
    ? filtered.filter((c) => c.dueDate === selectedDate)
    : [];
  const move = (direction: number) =>
    setCursor((prev) => {
      const next = new Date(prev);
      view === "month"
        ? next.setMonth(next.getMonth() + direction)
        : next.setDate(next.getDate() + direction * 7);
      return next;
    });
  const pay = (charge: Charge) => {
    const accounts = getBankAccounts().filter((account) => account.active);
    if (!accounts.length) {
      window.alert("Cadastre uma conta bancária ativa antes de concluir o pagamento.");
      return;
    }
    setPayTarget(charge);
    setPayAccountId("");
  };
  const completePayment = () => {
    const charge = payTarget;
    if (!charge || !payAccountId) return;
    if (
      !window.confirm(
        `Confirmar pagamento de ${money(charge.value)} para ${charge.client}?`,
      )
    )
      return;
    const result = markChargeAsPaid(charge.id, payAccountId);
    if (!result) return;
    if (charge.company === "IMÓVEIS") {
      const client = getClients().find(
        (item) =>
          item.name.trim().toLowerCase() === charge.client.trim().toLowerCase(),
      );
      const property = getProperties().find(
        (item) =>
          item.id === charge.propertyId ||
          item.tenant?.trim().toLowerCase() ===
            charge.client.trim().toLowerCase(),
      );
      const receiptId = getReceiptNumber(result.charge);
      const receiptCharge = { ...result.charge, receiptId };
      generateRentalReceipt(
        receiptCharge,
        result.transaction,
        client,
        property,
      );
      attachReceiptToCharge(charge.id, receiptId);
      if (!client?.phone || !openRentalWhatsApp(client, receiptCharge))
        window.alert(
          "Recibo gerado. O cliente não possui telefone válido cadastrado para abrir o WhatsApp.",
        );
    }
    setCharges(getCharges());
    setPayTarget(null);
    setPayAccountId("");
  };
  const downloadReceipt = (charge: Charge) => {
    const transaction = getTransactions().find(
      (item) => item.id === charge.transactionId || item.chargeId === charge.id,
    );
    if (!transaction)
      return window.alert("Lançamento financeiro relacionado não encontrado.");
    const client = getClients().find(
      (item) =>
        item.name.trim().toLowerCase() === charge.client.trim().toLowerCase(),
    );
    const property = getProperties().find(
      (item) =>
        item.id === charge.propertyId ||
        item.tenant?.trim().toLowerCase() ===
          charge.client.trim().toLowerCase(),
    );
    generateRentalReceipt(charge, transaction, client, property);
  };
  const executeProtected = (reason: string) => {
    if (!protectedAction) return;
    const { type, charge } = protectedAction;
    if(type==='use_guarantee'){useRentalGuarantee(charge.id,protectedAction.value||0,reason);setCharges(getCharges());setProtectedAction(null);return;}
    if (type === "delete") deleteChargeOccurrence(charge.id);
    else endChargeRecurrence(charge);
    addDeletionLog({
      recordType: type === "delete" ? "cobranca" : "recorrencia",
      originalId: charge.id,
      description: charge.description,
      company: charge.company,
      sourceModule: "Agenda de Cobranças",
      responsibleUser: "Administrador 3A",
      reason,
      adminValidated: true,
    });
    setCharges(getCharges());
    setProtectedAction(null);
  };
  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || editing.status === "pago") return;
    const guaranteeSaved=editing.rentalGuarantee?saveRentalGuarantee(editing.id,editing.rentalGuarantee):null;
    updateCharge(guaranteeSaved?{...editing,rentalGuarantee:guaranteeSaved.rentalGuarantee}:editing, editScope);
    setCharges(getCharges());
    setEditing(null);
  };
  const selectAsset = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    setCreateError("");
    setNewCharge((p) => ({
      ...p,
      assetId,
      value: asset ? String(asset.value) : "",
      frequency: asset?.assetType === "veiculo" ? "semanal" : "mensal",
      category:
        asset?.assetType === "veiculo"
          ? "LOCAÇÃO DE VEÍCULO"
          : "ALUGUEL DE IMÓVEL",
      guarantee:asset?.assetType==='imovel'?blankGuarantee():p.guarantee,
    }));
  };
  const createCharge = (event: React.FormEvent) => {
    event.preventDefault();
    const asset = assets.find((a) => a.id === newCharge.assetId);
    const client = clients.find((c) => c.id === newCharge.clientId);
    if (!asset || !client) {
      setCreateError("Selecione obrigatoriamente um bem e um cliente.");
      return;
    }
    if (
      asset.status === "locado" ||
      asset.status === "alugado" ||
      getCharges().some(
        (c) =>
          c.assetId === asset.id &&
          c.status !== "pago" &&
          c.recurrenceActive !== false,
      )
    ) {
      setCreateError(
        "Este bem já está locado e não pode receber outra locação ativa.",
      );
      return;
    }
    try {
      const created=addCharge({
        dueDate: newCharge.dueDate,
        description: `Locação - ${asset.name}`,
        company: asset.company,
        client: client.name,
        value: Number(newCharge.value),
        status: "pendente",
        category: newCharge.category,
        frequency: newCharge.frequency,
        recurrenceActive: newCharge.frequency !== "unica",
        clientId: client.id,
        assetId: asset.id,
        assetCode: asset.code,
        assetName: asset.name,
        assetType: asset.assetType,
        propertyId: asset.assetType === "imovel" ? asset.id : undefined,
        rentalGuarantee:asset.assetType==='imovel'?newCharge.guarantee:undefined,
      });
      if(asset.assetType==='imovel'&&newCharge.guarantee.type!=='none')saveRentalGuarantee(created.id,newCharge.guarantee);
      setCharges(getCharges());
      setCreating(false);
      setNewCharge({
        assetId: "",
        clientId: "",
        value: "",
        dueDate: isoDate(new Date()),
        frequency: "mensal",
        category: "",
        guarantee:blankGuarantee(),
      });
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a cobrança.",
      );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h2 className="font-display font-black text-lg">
            Agenda de Cobranças
          </h2>
          <p className="text-xs text-secondary">
            Cobranças consolidadas com vencimentos atualizados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2.5 bg-primary-container rounded-lg font-black text-xs uppercase"
          >
            + Nova Cobrança
          </button>
          <div className="flex items-center gap-2 bg-white border border-outline-variant rounded-lg p-2">
            <Filter className="w-4 h-4" />
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="text-xs bg-transparent"
            >
              <option>Todas as Empresas</option>
              <option>LOC MOTTUS</option>
              <option>3A RASTREAR</option>
              <option>IMÓVEIS</option>
              <option>HOLDING</option>
            </select>
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          ["Recebido", metrics.pago, CheckCircle, "text-green-700"],
          ["Pendente", metrics.pendente, Clock, "text-amber-700"],
          ["Vencido", metrics.vencido, AlertCircle, "text-red-700"],
        ].map(([label, value, Icon, color]) => (
          <div
            key={String(label)}
            className="bg-white border border-outline-variant rounded-xl p-5 flex justify-between"
          >
            <div>
              <p className="text-[10px] uppercase font-bold text-secondary">
                {String(label)}
              </p>
              <p className={`font-black text-lg ${color}`}>
                {money(Number(value))}
              </p>
            </div>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        ))}
      </div>
      <section className="bg-white border border-outline-variant rounded-xl overflow-hidden custom-shadow">
        <header className="p-4 flex flex-wrap justify-between gap-3 bg-gray-50 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <button onClick={() => move(-1)} aria-label="Período anterior">
              <ChevronLeft />
            </button>
            <strong className="capitalize">
              {cursor.toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button onClick={() => move(1)} aria-label="Próximo período">
              <ChevronRight />
            </button>
          </div>
          <div className="flex bg-gray-100 rounded p-1">
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1 text-xs rounded ${view === "month" ? "bg-white shadow" : ""}`}
            >
              Mês
            </button>
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1 text-xs rounded ${view === "week" ? "bg-white shadow" : ""}`}
            >
              Semana
            </button>
          </div>
        </header>
        <div className="grid grid-cols-7 border-b border-outline-variant">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div
              key={d}
              className="p-2 text-center text-[10px] font-bold uppercase text-secondary"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date) => {
            const key = isoDate(date);
            const dayCharges = filtered.filter((c) => c.dueDate === key);
            const outside =
              view === "month" && date.getMonth() !== cursor.getMonth();
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                className={`min-h-24 border-r border-b border-outline-variant/50 p-2 text-left hover:bg-amber-50 ${outside ? "opacity-40" : ""}`}
              >
                <span className="text-xs font-bold">{date.getDate()}</span>
                {dayCharges.map((c) => (
                  <span
                    key={c.id}
                    className={`block mt-1 truncate rounded px-1.5 py-1 text-[9px] font-bold ${c.status === "pago" ? "bg-green-100 text-green-800" : c.status === "vencido" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}
                  >
                    {c.assetCode || "SEM CÓDIGO"} — {c.client} —{" "}
                    {money(c.value)}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      </section>
      {selectedDate && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[80]"
            onClick={() => setSelectedDate(null)}
          />
          <aside className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-[90] shadow-2xl overflow-y-auto">
            <header className="sticky top-0 bg-white p-5 border-b flex justify-between">
              <div>
                <h3 className="font-black">Cobranças do dia</h3>
                <p className="text-xs text-secondary">
                  {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                    "pt-BR",
                  )}
                </p>
              </div>
              <button onClick={() => setSelectedDate(null)}>
                <X />
              </button>
            </header>
            <div className="p-5 space-y-4">
              {selectedCharges.length === 0 && (
                <p className="text-sm text-secondary">
                  Este dia não possui cobranças.
                </p>
              )}
              {selectedCharges.map((c) => (
                <article
                  key={c.id}
                  className="border rounded-lg p-4 text-xs space-y-2"
                >
                  <div className="flex justify-between">
                    <strong>{c.assetCode || "SEM CÓDIGO"} — {c.assetName || "Bem não identificado"}</strong>
                    <span className="uppercase font-bold">{c.status}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-secondary">
                    <div>Cliente: {c.client}</div>
                    <div>Telefone: {clients.find(client => client.id === c.clientId || client.name === c.client)?.phone || "Não informado"}</div>
                    <div>Empresa: {c.company}</div>
                    <div>Categoria: {c.category}</div>
                    <div>Vencimento: {c.dueDate}</div>
                    <div>Valor: {money(c.value)}</div>
                    <div>Frequência: {c.frequency}</div>
                    <div>Status: {c.status}</div>
                  </dl>
                  {c.rentalGuarantee&&c.rentalGuarantee.type!=='none'&&<section className="rounded border bg-gray-50 p-3"><h4 className="font-black uppercase">Garantia da locação</h4><div className="mt-2 grid grid-cols-2 gap-2"><span>Tipo: {c.rentalGuarantee.type}</span><span>Valor: {money(c.rentalGuarantee.value)}</span><span>Status: {c.rentalGuarantee.status}</span><span>Data: {c.rentalGuarantee.receivedAt||'Não informada'}</span><span>Saldo: {money(c.rentalGuarantee.balance)}</span></div><div className="mt-2 space-y-1">{c.rentalGuarantee.history.map(item=><p key={item.id}>{new Date(item.date).toLocaleString('pt-BR')} — {item.action}{item.value?` — ${money(item.value)}`:''}</p>)}</div><div className="mt-3 flex flex-wrap gap-2">{c.rentalGuarantee.type==='cash_deposit'&&c.rentalGuarantee.status==='recebida'&&<button type="button" onClick={()=>{const value=Number(window.prompt('Valor da caução a utilizar:'));if(value>0)setProtectedAction({type:'use_guarantee',charge:c,value});}} className="rounded border px-3 py-2 font-bold">Utilizar caução</button>}{c.rentalGuarantee.type==='cash_deposit'&&c.rentalGuarantee.receivedMovementId&&<button type="button" onClick={()=>{const property=getProperties().find(p=>p.id===c.assetId),client=getClients().find(item=>item.id===c.clientId);generateSecurityDepositReceipt(c,client,property);}} className="rounded border px-3 py-2 font-bold">Baixar recibo de caução</button>}</div></section>}
                  {c.paidAt && (
                    <p className="text-green-700">
                      Pago em {new Date(c.paidAt).toLocaleString("pt-BR")}
                    </p>
                  )}
                  <button
                    disabled={c.status === "pago"}
                    onClick={() => pay(c)}
                    className="w-full py-2 bg-primary-container disabled:bg-gray-200 rounded font-bold uppercase"
                  >
                    {c.status === "pago"
                      ? "Pagamento registrado"
                      : "Marcar como pago"}
                  </button>
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <button
                      disabled={c.status === "pago"}
                      onClick={() => {
                        setEditing({ ...c });
                        setEditScope("single");
                      }}
                      className="flex justify-center items-center gap-1 border rounded py-2 disabled:opacity-40"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar cobrança
                    </button>
                    <button
                      onClick={() =>
                        setProtectedAction({ type: "delete", charge: c })
                      }
                      className="flex justify-center items-center gap-1 border border-red-200 text-red-700 rounded py-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir esta cobrança
                    </button>
                    {c.frequency !== "unica" && c.recurrenceActive && (
                      <button
                        onClick={() =>
                          setProtectedAction({ type: "end", charge: c })
                        }
                        className="flex justify-center items-center gap-1 border border-amber-200 text-amber-700 rounded py-2"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Encerrar recorrência
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </>
      )}
      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title="Editar cobrança"
      >
        {editing && (
          <form onSubmit={saveEdit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                aria-label="Cliente"
                value={editing.client}
                onChange={(e) =>
                  setEditing({ ...editing, client: e.target.value })
                }
                className="border rounded p-2 text-xs"
                required
              />
              <select
                aria-label="Empresa"
                value={editing.company}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    company: e.target.value as Charge["company"],
                  })
                }
                className="border rounded p-2 text-xs"
              >
                <option>LOC MOTTUS</option>
                <option>3A RASTREAR</option>
                <option>IMÓVEIS</option>
                <option>HOLDING</option>
              </select>
              <input
                aria-label="Categoria"
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value })
                }
                className="border rounded p-2 text-xs"
                required
              />
              <input
                aria-label="Descrição"
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
                className="border rounded p-2 text-xs"
                required
              />
              <input
                aria-label="Valor"
                type="number"
                min="0.01"
                step="0.01"
                value={editing.value}
                onChange={(e) =>
                  setEditing({ ...editing, value: Number(e.target.value) })
                }
                className="border rounded p-2 text-xs"
                required
              />
              <input
                aria-label="Vencimento"
                type="date"
                value={editing.dueDate}
                onChange={(e) =>
                  setEditing({ ...editing, dueDate: e.target.value })
                }
                className="border rounded p-2 text-xs"
                required
              />
              <select
                aria-label="Frequência"
                value={editing.frequency}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    frequency: e.target.value as Charge["frequency"],
                  })
                }
                className="border rounded p-2 text-xs"
              >
                <option value="unica">Única</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
                <option value="personalizada">Personalizada</option>
              </select>
              <select
                aria-label="Status"
                value={editing.status}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    status: e.target.value as Charge["status"],
                  })
                }
                className="border rounded p-2 text-xs"
              >
                <option value="pendente">Pendente</option>
                <option value="vencido">Vencido</option>
              </select>
              {editing.frequency === "personalizada" && (
                <input
                  aria-label="Intervalo personalizado"
                  type="number"
                  min="1"
                  value={editing.customIntervalDays || 1}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      customIntervalDays: Number(e.target.value),
                    })
                  }
                  className="border rounded p-2 text-xs"
                />
              )}
            </div>
            {editing.assetId&&['Kitnet','Casa','Loja','Comercial'].includes(getProperties().find(p=>p.id===editing.assetId)?.type||'')&&<GuaranteeFields value={editing.rentalGuarantee||blankGuarantee()} onChange={rentalGuarantee=>setEditing({...editing,rentalGuarantee})}/>} 
            <div>
              <p className="text-[10px] uppercase font-bold text-secondary mb-2">
                Aplicar alteração a
              </p>
              <label className="mr-4 text-xs">
                <input
                  type="radio"
                  checked={editScope === "single"}
                  onChange={() => setEditScope("single")}
                />{" "}
                Somente esta
              </label>
              <label className="text-xs">
                <input
                  type="radio"
                  checked={editScope === "series"}
                  onChange={() => setEditScope("series")}
                />{" "}
                Esta e próximas
              </label>
            </div>
            <button className="w-full bg-primary-container rounded py-2.5 text-xs font-bold uppercase">
              Salvar alterações
            </button>
          </form>
        )}
      </Modal>
      <Modal
        isOpen={creating}
        onClose={() => setCreating(false)}
        title="Nova Cobrança"
      >
        <form onSubmit={createCharge} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase">
              Bem cadastrado
            </label>
            <select
              required
              value={newCharge.assetId}
              onChange={(e) => selectAsset(e.target.value)}
              className="w-full border rounded p-2.5 text-xs"
            >
              <option value="">Selecione o bem</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name} — {a.type} — {a.status}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase">Empresa</label>
              <input
                readOnly
                value={
                  assets.find((a) => a.id === newCharge.assetId)?.company || ""
                }
                className="w-full border rounded p-2.5 text-xs bg-gray-50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase">
                Cliente cadastrado
              </label>
              <select
                required
                value={newCharge.clientId}
                onChange={(e) =>
                  setNewCharge((p) => ({ ...p, clientId: e.target.value }))
                }
                className="w-full border rounded p-2.5 text-xs"
              >
                <option value="">Selecione</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase">Valor</label>
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={newCharge.value}
                onChange={(e) =>
                  setNewCharge((p) => ({ ...p, value: e.target.value }))
                }
                className="w-full border rounded p-2.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase">
                Primeiro vencimento
              </label>
              <input
                required
                type="date"
                value={newCharge.dueDate}
                onChange={(e) =>
                  setNewCharge((p) => ({ ...p, dueDate: e.target.value }))
                }
                className="w-full border rounded p-2.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase">
                Frequência
              </label>
              <select
                value={newCharge.frequency}
                onChange={(e) =>
                  setNewCharge((p) => ({
                    ...p,
                    frequency: e.target.value as Charge["frequency"],
                  }))
                }
                className="w-full border rounded p-2.5 text-xs"
              >
                <option value="unica">Única</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
                <option value="personalizada">Personalizada</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase">
                Categoria financeira
              </label>
              <input
                required
                value={newCharge.category}
                onChange={(e) =>
                  setNewCharge((p) => ({ ...p, category: e.target.value }))
                }
                className="w-full border rounded p-2.5 text-xs"
              />
            </div>
          </div>
          {['Kitnet','Casa','Loja','Comercial'].includes(assets.find(a=>a.id===newCharge.assetId)?.type||'')&&<GuaranteeFields value={newCharge.guarantee} onChange={guarantee=>setNewCharge(p=>({...p,guarantee}))}/>} 
          {createError && (
            <p className="text-xs text-red-700 bg-red-50 p-3 rounded">
              {createError}
            </p>
          )}
          <button className="w-full bg-primary-container rounded py-3 text-xs font-black uppercase">
            Criar cobrança e vincular locação
          </button>
        </form>
      </Modal>
      <Modal isOpen={!!payTarget} onClose={() => setPayTarget(null)} title="Confirmar conta do recebimento"><div className="space-y-4"><select value={payAccountId} onChange={e=>setPayAccountId(e.target.value)} className="w-full border rounded p-2.5 text-xs"><option value="">Selecione a conta bancária</option>{getBankAccounts().filter(account=>account.active).map(account=><option key={account.id} value={account.id}>{account.bankName} — {account.accountName}</option>)}</select><button disabled={!payAccountId} onClick={completePayment} className="w-full bg-primary-container disabled:bg-gray-200 rounded p-3 text-xs font-black">CONFIRMAR PAGAMENTO</button></div></Modal>
      <DeleteConfirmation
        isOpen={!!protectedAction}
        recordName={protectedAction?.charge.description || ""}
        onClose={() => setProtectedAction(null)}
        onValidated={executeProtected}
      />
      {selectedDate &&
        selectedCharges
          .filter(
            (c) =>
              c.status === "pago" && c.company === "IMÓVEIS" && c.receiptId,
          )
          .map((c, index) => (
            <button
              key={`receipt-${c.id}`}
              onClick={() => downloadReceipt(c)}
              style={{ bottom: `${24 + index * 44}px` }}
              className="fixed right-6 z-[100] px-4 py-2 bg-white border border-primary rounded shadow-lg font-bold text-xs uppercase flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar recibo novamente
            </button>
          ))}
    </div>
  );
}

function GuaranteeFields({value,onChange}:{value:RentalGuarantee;onChange:(value:RentalGuarantee)=>void}){const cash=value.type==='cash_deposit',bond=value.type==='guarantor'||value.type==='insurance_bond';return <fieldset className="rounded-lg border border-amber-300 bg-amber-50/40 p-4"><legend className="px-2 text-xs font-black uppercase">Garantia da Locação</legend><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><label className="text-[10px] font-bold uppercase">Tipo de garantia<select value={value.type} onChange={e=>{const type=e.target.value as RentalGuarantee['type'];onChange({...value,type,status:type==='none'?'pendente':value.status,value:type==='none'?0:value.value,balance:type==='none'?0:value.balance})}} className="mt-1 w-full rounded border bg-white p-2.5 text-xs"><option value="none">Sem garantia</option><option value="cash_deposit">Caução em dinheiro</option><option value="guarantor">Fiança</option><option value="insurance_bond">Seguro-fiança</option><option value="other">Outro</option></select></label>{value.type!=='none'&&<><label className="text-[10px] font-bold uppercase">Valor da garantia<input type="number" min="0" step="0.01" value={value.value||''} onChange={e=>onChange({...value,value:Number(e.target.value),balance:value.receivedMovementId?value.balance:Number(e.target.value)})} className="mt-1 w-full rounded border p-2.5 text-xs"/></label>{(cash||bond)&&<><label className="text-[10px] font-bold uppercase">Data do recebimento<input type="date" value={value.receivedAt||''} onChange={e=>onChange({...value,receivedAt:e.target.value})} className="mt-1 w-full rounded border p-2.5 text-xs"/></label><label className="text-[10px] font-bold uppercase">Conta bancária (opcional)<select value={value.bankAccountId||''} onChange={e=>onChange({...value,bankAccountId:e.target.value||undefined})} className="mt-1 w-full rounded border p-2.5 text-xs"><option value="">Sem conta vinculada</option>{getBankAccounts().filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.bankName} — {a.accountName}</option>)}</select></label></>}{bond&&<label className="text-[10px] font-bold uppercase">Validade<input type="date" value={value.validUntil||''} onChange={e=>onChange({...value,validUntil:e.target.value})} className="mt-1 w-full rounded border p-2.5 text-xs"/></label>}<label className="text-[10px] font-bold uppercase">Status<select value={value.status} onChange={e=>onChange({...value,status:e.target.value as RentalGuarantee['status']})} className="mt-1 w-full rounded border p-2.5 text-xs"><option value="pendente">Pendente</option><option value="recebida">Recebida</option><option value="retida">Retida</option><option value="devolvida">Devolvida</option><option value="utilizada_parcialmente">Utilizada parcialmente</option></select></label><label className="text-[10px] font-bold uppercase">Comprovante opcional<input type="file" onChange={e=>onChange({...value,proofName:e.target.files?.[0]?.name})} className="mt-1 w-full rounded border bg-white p-2 text-xs"/></label><label className="text-[10px] font-bold uppercase md:col-span-2">Observações<textarea value={value.notes||''} onChange={e=>onChange({...value,notes:e.target.value})} className="mt-1 w-full rounded border p-2.5 text-xs"/></label></>}</div></fieldset>}
