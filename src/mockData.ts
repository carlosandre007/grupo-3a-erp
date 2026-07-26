import { Transaction, Vehicle, Equipment, Property, Client, Charge, DeletionLog, BankAccount, BankMovement, FixedCost, Investment, TrackerSummary, RentalGuarantee, MarketingSpend, AssetDetails } from './types';
import { isSupabaseConfigured } from './lib/supabase';

// Helper to load/save from localStorage
const getStored = <T>(key: string, fallback: T): T => {
  if (isSupabaseConfigured) return fallback;
  const data = localStorage.getItem(`erp_3a_${key}`);
  return data ? JSON.parse(data) : fallback;
};

const saveStored = <T>(key: string, val: T): void => {
  if (isSupabaseConfigured) return;
  localStorage.setItem(`erp_3a_${key}`, JSON.stringify(val));
};

const codeSuffix = { moto: 'M', carro: 'CAR', Kitnet: 'KIT', Loja: 'LOJ', Casa: 'CAS' } as const;
type CodedType = keyof typeof codeSuffix;
const nextAssetCode = (type: CodedType): string => {
  const counters = getStored<Record<string, number>>('asset_code_counters', {});
  counters[type] = (counters[type] || 0) + 1;
  saveStored('asset_code_counters', counters);
  return `${String(counters[type]).padStart(2, '0')}${codeSuffix[type]}`;
};
const syncCounter = (type: CodedType, code?: string) => {
  if (!code) return;
  const counters = getStored<Record<string, number>>('asset_code_counters', {});
  const number = Number(code.match(/^\d+/)?.[0] || 0);
  if (number > (counters[type] || 0)) { counters[type] = number; saveStored('asset_code_counters', counters); }
};

// Data is loaded exclusively from localStorage. No sample records are inserted.
const removeConfirmedTemplateTransactions=():void=>{const migration='erp_3a_cleanup_template_transactions_v1';if(localStorage.getItem(migration))return;const key='erp_3a_transactions',raw=localStorage.getItem(key);if(!raw){localStorage.setItem(migration,'none');return;}try{const records=JSON.parse(raw)as Transaction[],smallTemplateId=/^(?:tx[-_])?0?\d{1,3}$/i,candidates=records.filter(item=>smallTemplateId.test(item.id));const normalized=candidates.map(item=>item.description.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()),signatures=['aluguel semanal','manutencao preventiva','seguro semanal','assinatura mensal','manutencao veicular'];if(candidates.length===11&&signatures.every(signature=>normalized.some(value=>value.includes(signature)))){localStorage.setItem(`erp_3a_backup_before_mock_cleanup_${new Date().toISOString()}`,raw);const ids=new Set(candidates.map(item=>item.id));localStorage.setItem(key,JSON.stringify(records.filter(item=>!ids.has(item.id))));localStorage.setItem(migration,JSON.stringify({removedIds:[...ids],removedCount:ids.size,origin:'google-ai-studio-template'}));}else localStorage.setItem(migration,'unconfirmed');}catch{localStorage.setItem(migration,'invalid-storage');}};
if(!isSupabaseConfigured)removeConfirmedTemplateTransactions();

// CRUD APIS OPERATING OVER LOCALSTORAGE WITH TYPINGS

export const getTransactions = (): Transaction[] => getStored<Transaction[]>('transactions', []);
export const saveTransactions = (txs: Transaction[]): void => {
  saveStored<Transaction[]>('transactions', txs);
  window.dispatchEvent(new CustomEvent('erp-transactions-updated'));
};
export const addTransaction = (tx: Omit<Transaction, 'id'>): Transaction => {
  const txs = getTransactions();
  const newTx: Transaction = {
    ...tx,
    id: `tx-${Date.now()}`
  };
  txs.unshift(newTx);
  saveTransactions(txs);
  return newTx;
};

export const getVehicles = (): Vehicle[] => {
  const vehicles = getStored<Vehicle[]>('vehicles', []);
  let changed = false;
  const normalized = vehicles.map(vehicle => { const kind = vehicle.kind || (/moto|scooter|yamaha|honda|mottus/i.test(vehicle.model) ? 'moto' : 'carro'); const code = vehicle.code || nextAssetCode(kind); if (!vehicle.code) changed = true; syncCounter(kind, code); return { ...vehicle, kind, code }; });
  if (changed) saveStored('vehicles', normalized);
  return normalized;
};
export const saveVehicles = (vehicles: Vehicle[]): void => saveStored<Vehicle[]>('vehicles', vehicles);
export const addVehicle = (vehicle: Omit<Vehicle, 'id'> & { id?: string }): Vehicle => {
  const vehicles = getVehicles();
  const newVehicle: Vehicle = {
    ...vehicle,
    id: vehicle.id || crypto.randomUUID(),
    code: vehicle.code || nextAssetCode(vehicle.kind || 'moto')
  };
  vehicles.unshift(newVehicle);
  saveVehicles(vehicles);
  return newVehicle;
};

export const getEquipments = (): Equipment[] => {
  const equipments = getStored<Equipment[]>('equipments', []);
  return equipments.map(item => ({
    ...item,
    name: item.name || item.model || 'Ativo sem nome',
    serialNumber: item.serialNumber || item.serial || 'Sem número de série',
    lastSignal: item.lastSignal || item.lastUpdate,
    status: item.status === 'ativo' ? 'instalado' : item.status === 'manutencao' ? 'defeito' : item.status === 'standby' ? 'estoque' : item.status,
    rentalValue: item.rentalValue ?? 0
  }));
};
export const saveEquipments = (eqs: Equipment[]): void => saveStored<Equipment[]>('equipments', eqs);
export const addEquipment = (eq: Omit<Equipment, 'id'>): Equipment => {
  const eqs = getEquipments();
  const newEq: Equipment = {
    ...eq,
    id: `eq-${Date.now()}`
  };
  eqs.unshift(newEq);
  saveEquipments(eqs);
  return newEq;
};

export const getProperties = (): Property[] => {
  const properties = getStored<Property[]>('properties', []);
  let changed = false;
  const normalized = properties.map(property => { const codedType = (property.type === 'Kitnet' || property.type === 'Loja' || property.type === 'Casa') ? property.type : null; const code = property.code || (codedType ? nextAssetCode(codedType) : undefined); if (!property.code && code) changed = true; if (codedType) syncCounter(codedType, code); return { ...property, code }; });
  if (changed) saveStored('properties', normalized);
  return normalized;
};
export const saveProperties = (properties: Property[]): void => saveStored<Property[]>('properties', properties);
export const addProperty = (property: Omit<Property, 'id'> & { id?: string }): Property => {
  const properties = getProperties();
  const newProp: Property = {
    ...property,
    id: property.id || crypto.randomUUID(),
    code: property.code || ((property.type === 'Kitnet' || property.type === 'Loja' || property.type === 'Casa') ? nextAssetCode(property.type) : undefined)
  };
  properties.unshift(newProp);
  saveProperties(properties);
  return newProp;
};

export const getClients = (): Client[] => getStored<Client[]>('clients', []);
export const saveClients = (clients: Client[]): void => saveStored<Client[]>('clients', clients);
export const addClient = (client: Omit<Client, 'id'>): Client => {
  const clients = getClients();
  const newClient: Client = {
    ...client,
    id: `cl-${Date.now()}`
  };
  clients.unshift(newClient);
  saveClients(clients);
  return newClient;
};

export const getCharges = (): Charge[] => getStored<Charge[]>('charges', []).map(charge => ({ ...charge, frequency: charge.frequency || 'unica', seriesId: charge.seriesId || charge.id, recurrenceActive: charge.recurrenceActive ?? charge.frequency !== 'unica' }));
export const saveCharges = (charges: Charge[]): void => saveStored('charges', charges);
export const addCharge = (charge: Omit<Charge, 'id' | 'seriesId'>): Charge => {
  if (!charge.clientId || !charge.assetId) throw new Error('Cliente e bem são obrigatórios.');
  if (getCharges().some(item => item.assetId === charge.assetId && item.status !== 'pago' && item.recurrenceActive !== false)) throw new Error('Este bem já possui uma locação ativa.');
  const id = crypto.randomUUID();
  const created: Charge = { ...charge, id, seriesId: id };
  saveCharges([created, ...getCharges()]);
  if (charge.assetType === 'veiculo') {
    const vehicles = getVehicles().map(vehicle => vehicle.id === charge.assetId ? { ...vehicle, status: 'locado' as const, tenant: charge.client } : vehicle);
    saveVehicles(vehicles);
  } else {
    const properties = getProperties().map(property => property.id === charge.assetId ? { ...property, status: 'alugado' as const, tenant: charge.client } : property);
    saveProperties(properties);
  }
  window.dispatchEvent(new CustomEvent('erp-data-updated'));
  return created;
};

export const getNextDueDate = (dueDate: string, frequency: Charge['frequency'], customIntervalDays?: number): string | null => {
  if (frequency === 'unica') return null;
  const [year, month, day] = dueDate.split('-').map(Number);
  if (frequency === 'semanal' || frequency === 'personalizada') {
    const date = new Date(year, month - 1, day, 12);
    date.setDate(date.getDate() + (frequency === 'semanal' ? 7 : Math.max(1, customIntervalDays || 1)));
    return date.toISOString().split('T')[0];
  }
  const targetMonth = frequency === 'mensal' ? month : month;
  const targetYear = frequency === 'anual' ? year + 1 : month === 12 ? year + 1 : year;
  const targetMonthIndex = frequency === 'anual' ? month - 1 : targetMonth % 12;
  const lastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
};

export const markChargeAsPaid = (chargeId: string, bankAccountId?: string): { charge: Charge; transaction: Transaction } | null => {
  const charges = getCharges();
  const charge = charges.find(item => item.id === chargeId);
  if (!charge) return null;

  const transactions = getTransactions();
  const existing = transactions.find(item => item.chargeId === chargeId);
  if (charge.status === 'pago' || existing) {
    return existing ? { charge, transaction: existing } : null;
  }

  const paidAt = new Date().toISOString();
  const transaction: Transaction = {
    id: `tx-charge-${chargeId}`,
    date: paidAt.split('T')[0],
    description: charge.description,
    company: charge.company,
    clientOrProvider: charge.client,
    value: Math.abs(charge.value),
    type: 'receita',
    status: 'pago',
    category: charge.category,
    chargeId,
    seriesId: charge.seriesId,
    competencyDate: charge.dueDate,
    createdAt: paidAt,
    assetId: charge.assetId,
    assetCode: charge.assetCode
    ,bankAccountId
  };

  const paidCharge: Charge = { ...charge, status: 'pago', paidAt, transactionId: transaction.id };
  const updatedCharges = charges.map(item => item.id === chargeId ? paidCharge : item);
  if (charge.recurrenceActive && charge.frequency !== 'unica') {
    const nextDueDate = getNextDueDate(charge.dueDate, charge.frequency, charge.customIntervalDays);
    if (nextDueDate && !updatedCharges.some(item => item.seriesId === charge.seriesId && item.dueDate === nextDueDate)) {
      updatedCharges.push({ ...charge, id: crypto.randomUUID(), dueDate: nextDueDate, status: 'pendente', paidAt: undefined, transactionId: undefined });
    }
  }
  saveTransactions([transaction, ...transactions]);
  saveCharges(updatedCharges);
  window.dispatchEvent(new CustomEvent('erp-data-updated'));
  window.dispatchEvent(new CustomEvent('erp-transactions-updated'));
  return { charge: paidCharge, transaction };
};

export const deleteChargeOccurrence = (id: string): void => { saveCharges(getCharges().filter(c => c.id !== id)); window.dispatchEvent(new CustomEvent('erp-data-updated')); };
export const endChargeRecurrence = (charge: Charge): void => {
  saveCharges(getCharges().filter(c => !(c.seriesId === charge.seriesId && c.dueDate > charge.dueDate && c.status !== 'pago')).map(c => c.seriesId === charge.seriesId ? { ...c, recurrenceActive: false } : c));
  window.dispatchEvent(new CustomEvent('erp-data-updated'));
};
export const updateCharge = (updated: Charge, scope: 'single' | 'series'): void => {
  const currentCharges = getCharges();
  const original = currentCharges.find(charge => charge.id === updated.id);
  const dueDateDelta = original ? Math.round((new Date(`${updated.dueDate}T12:00:00`).getTime() - new Date(`${original.dueDate}T12:00:00`).getTime()) / 86400000) : 0;
  const charges = currentCharges.map(charge => {
    if (charge.status === 'pago') return charge;
    if (scope === 'single') return charge.id === updated.id ? updated : charge;
    if (charge.seriesId !== updated.seriesId || charge.dueDate < updated.dueDate) return charge;
    const shifted = new Date(`${charge.dueDate}T12:00:00`); shifted.setDate(shifted.getDate() + dueDateDelta);
    return { ...charge, client: updated.client, company: updated.company, category: updated.category, description: updated.description, value: updated.value, frequency: updated.frequency, customIntervalDays: updated.customIntervalDays, dueDate: charge.id === updated.id ? updated.dueDate : shifted.toISOString().split('T')[0] };
  });
  saveCharges(charges); window.dispatchEvent(new CustomEvent('erp-data-updated'));
};

export const saveRentalGuarantee = (chargeId:string, guarantee:RentalGuarantee):Charge => {
  const charges=getCharges(),charge=charges.find(item=>item.id===chargeId);if(!charge)throw new Error('Cobrança não encontrada.');if(charge.assetType!=='imovel')throw new Error('Garantia disponível somente para imóveis.');
  const isReceived=guarantee.status==='recebida'&&(guarantee.type==='cash_deposit'||guarantee.type==='guarantor'||guarantee.type==='insurance_bond'||guarantee.type==='other');if(isReceived&&(!guarantee.receivedAt||guarantee.value<=0))throw new Error('Valor e data são obrigatórios quando houver recebimento real.');
  const previous=charge.rentalGuarantee,history=[...(previous?.history||guarantee.history||[])],txId=`tx-guarantee-${guarantee.id}`,movementId=`guarantee-in-${guarantee.id}`;let next={...guarantee,balance:previous?.balance??guarantee.value,history}as RentalGuarantee;
  if(isReceived){if(!getTransactions().some(item=>item.id===txId))saveTransactions([{id:txId,date:guarantee.receivedAt!,description:'Caução sob responsabilidade',company:charge.company,clientOrProvider:charge.client,value:Math.abs(guarantee.value),type:'receita',status:'pago',category:'Caução sob responsabilidade',chargeId,seriesId:charge.seriesId,competencyDate:guarantee.receivedAt,createdAt:new Date().toISOString(),assetId:charge.assetId,assetCode:charge.assetCode,nature:'caucao_passivo',guaranteeId:guarantee.id,bankAccountId:guarantee.bankAccountId},...getTransactions()]);if(guarantee.bankAccountId&&!getBankMovements().some(item=>item.id===movementId))saveBankMovements([{id:movementId,accountId:guarantee.bankAccountId,type:'security_deposit_in',value:Math.abs(guarantee.value),date:guarantee.receivedAt!,description:'Caução sob responsabilidade',chargeId,clientId:charge.clientId,assetId:charge.assetId,guaranteeId:guarantee.id,classification:'Caução sob responsabilidade'},...getBankMovements()]);next={...next,receivedMovementId:guarantee.bankAccountId?movementId:undefined,balance:previous?.balance??guarantee.value,history:previous?.history?.some(item=>item.action==='Garantia recebida')?history:[{id:crypto.randomUUID(),date:new Date().toISOString(),action:'Garantia recebida',value:guarantee.value},...history]};}
  if(guarantee.type==='cash_deposit'&&guarantee.status==='devolvida'&&previous?.status!=='devolvida'){const refundId=`guarantee-out-${guarantee.id}`,value=previous?.balance??guarantee.balance;if(guarantee.bankAccountId&&!getBankMovements().some(item=>item.id===refundId))saveBankMovements([{id:refundId,accountId:guarantee.bankAccountId,type:'security_deposit_out',value:-Math.abs(value),date:new Date().toISOString().slice(0,10),description:'Devolução de caução',chargeId,clientId:charge.clientId,assetId:charge.assetId,guaranteeId:guarantee.id,classification:'Caução sob responsabilidade'},...getBankMovements()]);next={...next,refundMovementId:guarantee.bankAccountId?refundId:undefined,balance:0,history:[{id:crypto.randomUUID(),date:new Date().toISOString(),action:'Caução devolvida',value},...history]};}
  const updated={...charge,rentalGuarantee:next};saveCharges(charges.map(item=>item.id===chargeId?updated:item));window.dispatchEvent(new CustomEvent('erp-data-updated'));return updated;
};

export const linkGuaranteeTransactionToAccount=(transactionId:string,accountId:string):void=>{const transactions=getTransactions(),transaction=transactions.find(item=>item.id===transactionId);if(!transaction||transaction.nature!=='caucao_passivo'||!transaction.guaranteeId)throw new Error('Lançamento de garantia não encontrado.');const movementId=`guarantee-in-${transaction.guaranteeId}`;if(!getBankMovements().some(item=>item.id===movementId))saveBankMovements([{id:movementId,accountId,type:'security_deposit_in',value:Math.abs(transaction.value),date:transaction.date,description:'Caução sob responsabilidade',chargeId:transaction.chargeId,assetId:transaction.assetId,guaranteeId:transaction.guaranteeId,classification:'Caução sob responsabilidade'},...getBankMovements()]);saveTransactions(transactions.map(item=>item.id===transactionId?{...item,bankAccountId:accountId}:item));const charges=getCharges().map(charge=>charge.rentalGuarantee?.id===transaction.guaranteeId?{...charge,rentalGuarantee:{...charge.rentalGuarantee,bankAccountId:accountId,receivedMovementId:movementId}}:charge);saveCharges(charges);};

export const useRentalGuarantee = (chargeId:string,value:number,reason:string):Charge => {
  if(!reason.trim()||!Number.isFinite(value)||value<=0)throw new Error('Valor e motivo são obrigatórios.');const charges=getCharges(),charge=charges.find(item=>item.id===chargeId),guarantee=charge?.rentalGuarantee;if(!charge||!guarantee||guarantee.type!=='cash_deposit')throw new Error('Caução não encontrada.');if(value>guarantee.balance)throw new Error('Valor superior ao saldo da caução.');const txId=`tx-guarantee-use-${guarantee.id}-${guarantee.history.length}`;if(getTransactions().some(item=>item.id===txId))throw new Error('Utilização já registrada.');const now=new Date().toISOString(),transaction:Transaction={id:txId,date:now.slice(0,10),description:`Utilização de caução: ${reason}`,company:charge.company,clientOrProvider:charge.client,value,type:'receita',status:'pago',category:charge.category,chargeId:charge.id,seriesId:charge.seriesId,competencyDate:now.slice(0,10),createdAt:now,assetId:charge.assetId,assetCode:charge.assetCode};const balance=guarantee.balance-value,updated={...charge,rentalGuarantee:{...guarantee,balance,status:balance===0?'retida':'utilizada_parcialmente',history:[{id:crypto.randomUUID(),date:now,action:'Caução utilizada',value,reason},...guarantee.history]}as RentalGuarantee};saveTransactions([transaction,...getTransactions()]);saveCharges(charges.map(item=>item.id===chargeId?updated:item));window.dispatchEvent(new CustomEvent('erp-data-updated'));window.dispatchEvent(new CustomEvent('erp-transactions-updated'));return updated;
};

export const attachReceiptToCharge = (chargeId: string, receiptId: string): Charge | null => {
  let attached: Charge | null = null;
  const charges = getCharges().map(charge => {
    if (charge.id !== chargeId) return charge;
    attached = { ...charge, receiptId: charge.receiptId || receiptId, receiptGeneratedAt: charge.receiptGeneratedAt || new Date().toISOString() };
    return attached;
  });
  saveCharges(charges);
  return attached;
};

export const getBankAccounts = (): BankAccount[] => getStored('bank_accounts', []);
export const saveBankAccounts = (accounts: BankAccount[]): void => { saveStored('bank_accounts', accounts); window.dispatchEvent(new CustomEvent('erp-banks-updated')); };
export const addBankAccount = (account: Omit<BankAccount, 'id'>): BankAccount => { const created={...account,id:crypto.randomUUID()}; saveBankAccounts([created,...getBankAccounts()]); return created; };
export const updateBankAccount = (account: BankAccount): void => saveBankAccounts(getBankAccounts().map(a=>a.id===account.id?account:a));
export const getBankMovements = (): BankMovement[] => getStored('bank_movements', []);
const saveBankMovements = (items: BankMovement[]) => { saveStored('bank_movements', items); window.dispatchEvent(new CustomEvent('erp-banks-updated')); };
export const getAccountBalance = (accountId: string): number => { const account=getBankAccounts().find(a=>a.id===accountId); if(!account)return 0; const tx=getTransactions().filter(t=>t.bankAccountId===accountId&&t.status==='pago'&&t.nature!=='caucao_passivo').reduce((sum,t)=>sum+(t.type==='receita'?Math.abs(t.value):-Math.abs(t.value)),0); const movements=getBankMovements().filter(m=>m.accountId===accountId).reduce((sum,m)=>sum+(m.type==='transfer_out'?-Math.abs(m.value):m.type==='transfer_in'?Math.abs(m.value):m.value),0); return account.initialBalance+tx+movements; };
export const adjustAccountBalance = (accountId:string,value:number,date:string,reason:string) => { if(!reason.trim()||!Number.isFinite(value)||value===0)throw Error('Ajuste e motivo são obrigatórios.'); const movement:BankMovement={id:crypto.randomUUID(),accountId,type:'adjustment',value,date,description:'Ajuste de saldo',reason}; saveBankMovements([movement,...getBankMovements()]); return movement; };
export const transferBetweenAccounts = (from:string,to:string,value:number,date:string,description:string) => { if(from===to)throw Error('Contas devem ser diferentes.'); if(!Number.isFinite(value)||value<=0)throw Error('Valor inválido.'); const transferId=crypto.randomUUID(); const current=getBankMovements(); if(current.some(m=>m.transferId===transferId))throw Error('Transferência duplicada.'); saveBankMovements([{id:crypto.randomUUID(),accountId:from,type:'transfer_out',value,date,description,transferId},{id:crypto.randomUUID(),accountId:to,type:'transfer_in',value,date,description,transferId},...current]); return transferId; };

export const getFixedCosts = (): FixedCost[] => getStored('fixed_costs', []);
const saveFixedCosts = (costs:FixedCost[]) => { saveStored('fixed_costs',costs); window.dispatchEvent(new CustomEvent('erp-fixed-costs-updated')); };
const firstFixedCostDueDate=(cost:Pick<FixedCost,'startDate'|'frequency'|'dueDay'|'dueMonth'|'customIntervalDays'>):string=>{const start=new Date(`${cost.startDate}T12:00:00`),candidate=new Date(start);if(cost.frequency==='semanal'){const delta=(cost.dueDay-start.getDay()+7)%7;candidate.setDate(start.getDate()+delta);}else if(cost.frequency==='mensal'){candidate.setDate(1);candidate.setDate(Math.min(cost.dueDay,new Date(start.getFullYear(),start.getMonth()+1,0).getDate()));if(candidate<start){candidate.setMonth(candidate.getMonth()+1,1);candidate.setDate(Math.min(cost.dueDay,new Date(candidate.getFullYear(),candidate.getMonth()+1,0).getDate()));}}else if(cost.frequency==='anual'){candidate.setMonth((cost.dueMonth||1)-1,1);candidate.setDate(Math.min(cost.dueDay,new Date(candidate.getFullYear(),candidate.getMonth()+1,0).getDate()));if(candidate<start){candidate.setFullYear(candidate.getFullYear()+1);candidate.setDate(Math.min(cost.dueDay,new Date(candidate.getFullYear(),candidate.getMonth()+1,0).getDate()));}}else candidate.setDate(start.getDate()+Math.max(1,cost.customIntervalDays||1)-1);return candidate.toISOString().slice(0,10);};
export const addFixedCost = (cost:Omit<FixedCost,'id'|'nextDueDate'|'currentTransactionId'>):FixedCost => { const id=crypto.randomUUID(),nextDueDate=firstFixedCostDueDate(cost),txId=`tx-fixed-${id}-${nextDueDate}`,generate=cost.autoGenerate!==false&&cost.active; const created:FixedCost={...cost,id,nextDueDate,currentTransactionId:generate?txId:undefined}; if(generate&&!getTransactions().some(tx=>tx.id===txId))saveTransactions([{id:txId,date:nextDueDate,competencyDate:nextDueDate,description:cost.description,company:cost.company,clientOrProvider:'Custo Fixo',value:-Math.abs(cost.value),type:'despesa',status:'pendente',category:cost.category,bankAccountId:cost.bankAccountId},...getTransactions()]); saveFixedCosts([created,...getFixedCosts()]); return created; };
export const updateFixedCost=(cost:FixedCost)=>{const txs=getTransactions(),txId=cost.currentTransactionId||`tx-fixed-${cost.id}-${cost.nextDueDate}`,shouldCreate=cost.autoGenerate!==false&&cost.active&&!cost.currentTransactionId&&!txs.some(tx=>tx.id===txId),nextCost=shouldCreate?{...cost,currentTransactionId:txId}:cost;saveFixedCosts(getFixedCosts().map(c=>c.id===cost.id?nextCost:c));if(shouldCreate)saveTransactions([{id:txId,date:cost.nextDueDate,competencyDate:cost.nextDueDate,description:cost.description,company:cost.company,clientOrProvider:'Custo Fixo',value:-Math.abs(cost.value),type:'despesa',status:'pendente',category:cost.category,bankAccountId:cost.bankAccountId},...txs]);else if(cost.currentTransactionId)saveTransactions(txs.map(tx=>tx.id===cost.currentTransactionId&&tx.status!=='pago'?{...tx,description:cost.description,company:cost.company,category:cost.category,value:-Math.abs(cost.value),bankAccountId:cost.bankAccountId,date:cost.nextDueDate,competencyDate:cost.nextDueDate}:tx));};
export const payFixedCost=(id:string,bankAccountId?:string):FixedCost|null=>{const costs=getFixedCosts();const cost=costs.find(c=>c.id===id);if(!cost||!cost.currentTransactionId)return null;const txs=getTransactions();const tx=txs.find(t=>t.id===cost.currentTransactionId);if(!tx||tx.status==='pago')return cost;const paidAt=new Date().toISOString(),after=new Date(`${cost.nextDueDate}T12:00:00`);after.setDate(after.getDate()+1);const updatedTx={...tx,status:'pago' as const,bankAccountId:bankAccountId||cost.bankAccountId,createdAt:paidAt};const next=firstFixedCostDueDate({...cost,startDate:after.toISOString().slice(0,10)});let nextTx:Transaction|undefined;const withinPeriod=!cost.endDate||next<=cost.endDate,updatedCost={...cost,nextDueDate:withinPeriod?next:cost.nextDueDate,currentTransactionId:withinPeriod?`tx-fixed-${cost.id}-${next}`:undefined};if(withinPeriod&&!txs.some(t=>t.id===updatedCost.currentTransactionId)){nextTx={...tx,id:updatedCost.currentTransactionId!,date:next,competencyDate:next,status:'pendente',createdAt:undefined};}saveTransactions([...(nextTx?[nextTx]:[]),...txs.map(t=>t.id===tx.id?updatedTx:t)]);saveFixedCosts(costs.map(c=>c.id===id?updatedCost:c));return updatedCost;};

export const updateClient = (client: Client): void => saveClients(getClients().map(item => item.id === client.id ? client : item));
export const updateVehicle = (vehicle: Vehicle): void => saveVehicles(getVehicles().map(item => item.id === vehicle.id ? vehicle : item));
export const updateProperty = (property: Property): void => saveProperties(getProperties().map(item => item.id === property.id ? property : item));
export const getAssetDetails=():AssetDetails[]=>getStored('asset_details',[]);
export const saveAssetDetails=(detail:AssetDetails):void=>{const list=getAssetDetails();saveStored('asset_details',[detail,...list.filter(item=>item.assetId!==detail.assetId)]);window.dispatchEvent(new CustomEvent('erp-data-updated'));};

export const getDeletionLogs = (): DeletionLog[] => getStored<DeletionLog[]>('deletion_logs', []);
export const addDeletionLog = (log: Omit<DeletionLog, 'id' | 'deletedAt'>): void => {
  const logs = getDeletionLogs();
  saveStored('deletion_logs', [{ ...log, id: crypto.randomUUID(), deletedAt: new Date().toISOString() }, ...logs]);
};

export const getInvestments = (): Investment[] => getStored<Investment[]>('investments', []);
const saveInvestments = (items: Investment[]): void => {
  saveStored('investments', items);
  window.dispatchEvent(new CustomEvent('erp-investments-updated'));
  window.dispatchEvent(new CustomEvent('erp-data-updated'));
};
export const addInvestment = (item: Omit<Investment, 'id' | 'createdAt'>): Investment => {
  if (item.assetId && getInvestments().some(existing => existing.assetId === item.assetId)) throw new Error('Já existe um investimento manual vinculado a este bem.');
  const created: Investment = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  saveInvestments([created, ...getInvestments()]);
  return created;
};
export const updateInvestment = (item: Investment): void => {
  if (item.assetId && getInvestments().some(existing => existing.id !== item.id && existing.assetId === item.assetId)) throw new Error('Já existe um investimento manual vinculado a este bem.');
  saveInvestments(getInvestments().map(existing => existing.id === item.id ? item : existing));
};
export const getMarketingSpends=():MarketingSpend[]=>getStored('marketing_spends',[]);
const saveMarketingSpends=(items:MarketingSpend[])=>{saveStored('marketing_spends',items);window.dispatchEvent(new CustomEvent('erp-marketing-updated'));window.dispatchEvent(new CustomEvent('erp-data-updated'));};
export const addMarketingSpend=(input:Omit<MarketingSpend,'id'|'transactionId'|'createdAt'> & {transactionId?:string}):MarketingSpend=>{if(!input.companyId||!input.categoryId)throw new Error('Empresa e categoria são obrigatórias.');let transactionId=input.transactionId;if(input.mode==='link'){const tx=getTransactions().find(item=>item.id===transactionId&&item.type==='despesa'&&item.company===input.company&&(item.companyId===input.companyId||!item.companyId));if(!tx)throw new Error('Selecione uma despesa da mesma empresa.');if(getMarketingSpends().some(item=>item.transactionId===transactionId))throw new Error('Esta despesa já está vinculada a outro gasto.');}else{const id=crypto.randomUUID();transactionId=`tx-marketing-${id}`;if(getTransactions().some(item=>item.id===transactionId))throw new Error('Lançamento duplicado.');saveTransactions([{id:transactionId,date:input.date,description:input.description,companyId:input.companyId,company:input.company,clientOrProvider:input.campaign,value:-Math.abs(input.value),type:'despesa',status:input.status,category:input.category,bankAccountId:input.bankAccountId,campaign:input.campaign,marketingSpendId:id},...getTransactions()]);const created={...input,id,transactionId,createdAt:new Date().toISOString()}as MarketingSpend;saveMarketingSpends([created,...getMarketingSpends()]);return created;}const created={...input,id:crypto.randomUUID(),transactionId:transactionId!,createdAt:new Date().toISOString()}as MarketingSpend;saveMarketingSpends([created,...getMarketingSpends()]);return created;};
export const updateMarketingSpend=(item:MarketingSpend)=>{const spends=getMarketingSpends(),original=spends.find(value=>value.id===item.id);if(!original)throw new Error('Gasto não encontrado.');if(!item.companyId||!item.categoryId)throw new Error('Empresa e categoria são obrigatórias.');if(spends.some(value=>value.id!==item.id&&value.transactionId===item.transactionId))throw new Error('Despesa já vinculada.');saveMarketingSpends(spends.map(value=>value.id===item.id?item:value));if(item.mode==='create')saveTransactions(getTransactions().map(tx=>tx.id===item.transactionId?{...tx,date:item.date,description:item.description,companyId:item.companyId,company:item.company,value:-Math.abs(item.value),status:item.status,category:item.category,bankAccountId:item.bankAccountId,campaign:item.campaign}:tx));};
export const getCompanyMarketingCac=(company:MarketingSpend['company'])=>{const spends=getMarketingSpends().filter(item=>item.company===company);const clients=getClients();const total=spends.reduce((sum,item)=>sum+item.value,0);const manual=spends.reduce((sum,item)=>sum+Math.max(0,item.acquiredClients),0);const automaticIds=new Set(spends.filter(item=>item.acquiredClients===0).flatMap(item=>clients.filter(client=>client.acquisitionCompanyId===item.companyId&&client.acquisitionCampaign===item.campaign).map(client=>client.id)));const acquired=manual+automaticIds.size;return{total,acquired,cac:acquired?total/acquired:null};};
export const deleteMarketingSpend=(id:string)=>{const spends=getMarketingSpends(),item=spends.find(value=>value.id===id);if(!item)return;if(item.mode==='create')saveTransactions(getTransactions().filter(tx=>tx.id!==item.transactionId));saveMarketingSpends(spends.filter(value=>value.id!==id));};
export const deleteInvestment = (id: string): void => saveInvestments(getInvestments().filter(item => item.id !== id));

export const getTrackerSummary = (): TrackerSummary => getStored<TrackerSummary>('tracker_summary', { total: 0, available: 0, installed: 0, maintenance: 0, updatedAt: '' });
export const saveTrackerSummary = (summary: TrackerSummary): void => {
  if ([summary.total, summary.available, summary.installed, summary.maintenance].some(value => value < 0)) throw new Error('Os totais não podem ser negativos.');
  if (summary.available + summary.installed + summary.maintenance > summary.total) throw new Error('A soma dos estados não pode superar o total de ativos.');
  saveStored('tracker_summary', summary);
  window.dispatchEvent(new CustomEvent('erp-data-updated'));
};

// RESET HELPER (Handy for restoring original numbers)
export const resetAllData = (): void => {
  window.dispatchEvent(new CustomEvent('erp-data-updated'));
};
