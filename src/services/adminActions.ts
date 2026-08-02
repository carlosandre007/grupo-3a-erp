import { requireSupabase } from '../lib/supabase';
import { clearSupabaseReadCache } from '../repositories/supabaseRepository';

export type AdminTable =
  | 'banks'
  | 'clients'
  | 'properties'
  | 'motorcycles'
  | 'charges'
  | 'transactions'
  | 'fixed_costs';

export type SystemErrorLog = {
  operationId: string;
  module: string;
  message: string;
  occurredAt: string;
};

const KEY = 'grupo3a_system_errors';

export const getSystemErrors = (): SystemErrorLog[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as SystemErrorLog[];
  } catch {
    return [];
  }
};

export const addSystemError = (module: string, message: string, operationId: string = crypto.randomUUID()) => {
  const safe = message
    .replace(/(Bearer|apikey|password|token|secret)\s*[:=]?\s*\S+/gi, '$1=[redacted]')
    .slice(0, 500);
  localStorage.setItem(
    KEY,
    JSON.stringify([
      { operationId, module, message: safe, occurredAt: new Date().toISOString() },
      ...getSystemErrors(),
    ].slice(0, 500)),
  );
  return operationId;
};

async function request(body: Record<string, unknown>) {
  const { data: { session } } = await requireSupabase().auth.getSession();
  if (!session) throw new Error('Sessão inválida ou expirada.');

  const endpoint = import.meta.env.VITE_ADMIN_API_URL
    || `${import.meta.env.BASE_URL}api/admin-action.php`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  if (!String(response.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    throw new Error('Servidor administrativo indisponível nesta hospedagem.');
  }
  const result = await response.json().catch(() => ({})) as { error?: string; operationId?: string };

  if (!response.ok) {
    addSystemError('admin-action', result.error || 'Falha administrativa.', result.operationId);
    throw new Error(
      `${result.error || 'Falha administrativa.'}${result.operationId ? ` Operação: ${result.operationId}.` : ''}`,
    );
  }

  if (!['verify', 'verify-owner'].includes(String(body.action))) {
    clearSupabaseReadCache();
    window.dispatchEvent(new CustomEvent('erp-data-updated'));
    window.dispatchEvent(new CustomEvent('erp-transactions-updated'));
  }
  return result;
}

export const validateMasterPassword = (password: string) => request({ action: 'verify', password });
export const validateOwnerMasterPassword = (password: string) => request({ action: 'verify-owner', password });
export const deleteProtected = (table: AdminTable, id: string, password: string, reason: string) =>
  request({ action: 'delete', table, id, password, reason });
export const updateProtected = (
  table: AdminTable,
  id: string,
  password: string,
  changes: Record<string, unknown>,
) => request({ action: 'update', table, id, password, changes });
export const markFixedCostPaid = (id: string, password: string) =>
  request({ action: 'mark-fixed-cost-paid', id, password });
export const setManualInvestedCurrentProtected = (value: number, password: string) =>
  request({ action: 'set-invested-current', value, password });
export const createCompanyProtected = (record: Record<string, unknown>, password: string) =>
  request({ action: 'create-company', record, password });
export const createAlertProtected = (record: Record<string, unknown>, password: string) =>
  request({ action: 'create-alert', record, password });
export const createBankProtected = (record: Record<string, unknown>, password: string) =>
  request({ action: 'create-bank', record, password });
export const payCharge = (id: string) =>
  request({ action: 'pay-charge', id }) as Promise<{
    operationId: string;
    paidAt: string;
    transaction: Record<string, unknown>;
  }>;
