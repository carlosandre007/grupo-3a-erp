export interface Transaction {
  id: string;
  date: string;
  description: string;
  company: 'LOC MOTTUS' | '3A RASTREAR' | 'IMÓVEIS' | 'HOLDING';
  clientOrProvider: string;
  value: number;
  type: 'receita' | 'despesa';
  status: 'pago' | 'pendente' | 'atrasado';
  category: string;
  chargeId?: string;
  createdAt?: string;
  assetId?: string;
  assetCode?: string;
  investmentKind?: 'operacional' | 'investimento';
  seriesId?: string;
  competencyDate?: string;
  bankAccountId?: string;
  nature?: 'operacional' | 'caucao_passivo';
  guaranteeId?: string;
  campaign?: string;
  marketingSpendId?: string;
  companyId?: string;
}

export interface Charge {
  id: string;
  dueDate: string;
  description: string;
  company: Transaction['company'];
  client: string;
  value: number;
  status: 'pago' | 'pendente' | 'vencido';
  category: string;
  paidAt?: string;
  transactionId?: string;
  frequency: 'unica' | 'semanal' | 'mensal' | 'anual' | 'personalizada';
  customIntervalDays?: number;
  seriesId: string;
  recurrenceActive?: boolean;
  propertyId?: string;
  referencePeriod?: string;
  paymentMethod?: string;
  receiptId?: string;
  receiptGeneratedAt?: string;
  clientId?: string;
  assetId?: string;
  assetCode?: string;
  assetName?: string;
  assetType?: 'veiculo' | 'imovel';
  rentalGuarantee?: RentalGuarantee;
}

export type RentalGuaranteeType = 'none' | 'cash_deposit' | 'guarantor' | 'insurance_bond' | 'other';
export type RentalGuaranteeStatus = 'pendente' | 'recebida' | 'retida' | 'devolvida' | 'utilizada_parcialmente';
export interface GuaranteeHistoryEntry { id:string; date:string; action:string; value?:number; reason?:string; }
export interface RentalGuarantee {
  id:string; type:RentalGuaranteeType; value:number; receivedAt?:string; bankAccountId?:string;
  status:RentalGuaranteeStatus; notes?:string; proofName?:string; validUntil?:string;
  balance:number; receivedMovementId?:string; refundMovementId?:string; receiptId?:string;
  history:GuaranteeHistoryEntry[];
}

export interface Vehicle {
  id: string;
  model: string;
  plate: string;
  status: 'ativo' | 'disponivel' | 'manutencao' | 'locado' | 'baixado';
  unit?: string;
  nextRevision?: string;
  image: string;
  plateAlert?: string;
  rentalValue?: number;
  tenant?: string;
  nextMaintenance?: string;
  code?: string;
  kind?: 'moto' | 'carro';
  acquisitionDate?: string;
  purchaseValue?: number;
  currentValue?: number;
  ipvaDueDate?: string;
  licensingDueDate?: string;
}

export interface Equipment {
  id: string;
  model?: string;
  name?: string;
  serial?: string;
  serialNumber?: string;
  client?: string;
  lastUpdate?: string;
  lastSignal?: string;
  status: 'ativo' | 'manutencao' | 'standby' | 'instalado' | 'estoque' | 'defeito';
  rentalValue?: number;
}

export interface Property {
  id: string;
  name: string;
  type: 'Kitnet' | 'Casa' | 'Loja' | 'Industrial' | 'Comercial' | 'Outro';
  address: string;
  rentValue: number;
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  status: 'disponivel' | 'alugado' | 'manutencao' | 'baixado';
  image: string;
  tenant?: string;
  rentDate?: string;
  rentability?: string;
  occupancy?: string;
  code?: string;
  acquisitionDate?: string;
  purchaseValue?: number;
  currentValue?: number;
  annualAdjustmentDate?: string;
  contractEndDate?: string;
}

export interface Client {
  id: string;
  name: string;
  type: 'PF' | 'PJ';
  phone: string;
  email: string;
  document: string;
  activeAssetsCount?: number;
  avatar?: string;
  address?: string;
  activeContracts?: number;
  cnhNumber?: string;
  cnhExpiry?: string;
  acquisitionDate?: string;
  acquisitionSource?: string;
  acquisitionCampaign?: string;
  acquisitionChannel?: string;
  acquisitionCompany?: Transaction['company'];
  acquisitionCompanyId?: string;
}

export interface MarketingSpend { id:string; companyId:string; company:Transaction['company']; date:string; channel:'Google Ads'|'Meta Ads'|'Instagram'|'Agência'|'Comissão'|'Material publicitário'|'Ferramenta'|'Outro'; campaign:string; categoryId:string; category:string; description:string; value:number; status:'pendente'|'pago'; bankAccountId?:string; acquiredClients:number; notes?:string; mode:'create'|'link'; transactionId:string; createdAt:string; }

export interface DeletionLog {
  id: string;
  recordType: 'cliente' | 'veiculo' | 'imovel' | 'cobranca' | 'recorrencia' | 'lancamento_financeiro' | 'investimento';
  originalId: string;
  description: string;
  company: string;
  sourceModule: string;
  deletedAt: string;
  responsibleUser: string;
  reason: string;
  adminValidated: true;
  recordValue?: number;
  category?: string;
  recordDate?: string;
}

export interface BankAccount {
  id: string; bankName: string; accountName: string;
  type: 'corrente' | 'poupanca' | 'carteira' | 'caixa';
  company: Transaction['company']; agency?: string; accountLastDigits?: string;
  initialBalance: number; initialBalanceDate: string; active: boolean; color?: string;
}
export interface BankMovement {
  id: string; accountId: string; type: 'adjustment' | 'transfer_in' | 'transfer_out' | 'security_deposit_in' | 'security_deposit_out';
  value: number; date: string; description: string; reason?: string; transferId?: string;
  chargeId?:string; clientId?:string; assetId?:string; guaranteeId?:string; classification?:'Caução sob responsabilidade';
}
export interface FixedCost {
  id: string; description: string; company: Transaction['company']; category: string;
  value: number; dueDay: number; frequency: 'semanal' | 'mensal' | 'anual' | 'personalizada';
  customIntervalDays?: number; bankAccountId?: string; startDate: string; endDate?: string;
  dueMonth?: number; autoGenerate?: boolean; status?: 'ativo'|'pausado'|'encerrado';
  active: boolean; notes?: string; nextDueDate: string; currentTransactionId?: string;
}
export interface AssetDetails { assetId:string; category:string; notes?:string; rentalStartDate?:string; rentalFrequency?:'semanal'|'mensal'|'anual'|'personalizada'; documents?:string; dueDates?:string; insurance?:string; financing?:string; improvements?:number; additionalCosts?:number; saleDate?:string; saleValue?:number; archived?:boolean; updatedAt:string; }

export interface Investment {
  id: string;
  company: Transaction['company'];
  description: string;
  category: string;
  value: number;
  date: string;
  notes?: string;
  assetId?: string;
  createdAt: string;
}

export interface TrackerSummary {
  total: number;
  available: number;
  installed: number;
  maintenance: number;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  revenue: number;
  expenses: number;
  margin: number;
  activeAssets: string;
  image: string;
  metricLabel: string;
  metricValue: string;
}
