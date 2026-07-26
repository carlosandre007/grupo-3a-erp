import { isSupabaseConfigured } from '../lib/supabase';
import { LocalStorageRepository } from './localStorageRepository';
import { SupabaseRepository } from './supabaseRepository';

// Local storage remains the default until configuration is explicitly supplied.
export const repository = isSupabaseConfigured ? new SupabaseRepository() : new LocalStorageRepository();
export * from './contracts';
