import { requireSupabase } from '../lib/supabase';
import { setManualInvestedCurrentProtected } from './adminActions';

export type ManualInvestment = {
  value: number;
  updatedAt?: string;
};
export type ManualInvestmentHistory = {
  id: string;
  previousValue?: number;
  newValue: number;
  changedAt: string;
};

export class ManualInvestmentStorageUnavailableError extends Error {
  constructor() {
    super('Estrutura do Investido Atual indisponível.');
    this.name = 'ManualInvestmentStorageUnavailableError';
  }
}

const isMissingStorage = (error: { code?: string; message?: string }) =>
  error.code === 'PGRST205'
  || /app_settings|app_setting_history/i.test(error.message || '');

export async function getManualInvestment(): Promise<ManualInvestment | null> {
  const { data, error } = await requireSupabase()
    .from('app_settings')
    .select('numeric_value,updated_at')
    .eq('setting_key', 'invested_current')
    .maybeSingle();
  if (error) {
    if (isMissingStorage(error)) throw new ManualInvestmentStorageUnavailableError();
    throw error;
  }
  return data ? { value: Number(data.numeric_value || 0), updatedAt: data.updated_at } : null;
}

export async function getManualInvestmentHistory(): Promise<ManualInvestmentHistory[]> {
  const { data, error } = await requireSupabase()
    .from('app_setting_history')
    .select('id,previous_numeric_value,new_numeric_value,changed_at')
    .eq('setting_key', 'invested_current')
    .order('changed_at', { ascending: false })
    .limit(50);
  if (error) {
    if (isMissingStorage(error)) throw new ManualInvestmentStorageUnavailableError();
    throw error;
  }
  return (data || []).map(item => ({
    id: item.id,
    previousValue: item.previous_numeric_value === null ? undefined : Number(item.previous_numeric_value),
    newValue: Number(item.new_numeric_value),
    changedAt: item.changed_at,
  }));
}

export const saveManualInvestment = (value: number, password: string) =>
  setManualInvestedCurrentProtected(value, password);
