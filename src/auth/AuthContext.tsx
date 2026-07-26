import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { requireSupabase } from '../lib/supabase';

export type AccessRole = 'owner' | 'admin' | 'operator';
export type AuthProfile = { id: string; display_name: string | null; role: AccessRole; active: boolean };
export class AuthenticationError extends Error { name = 'AuthenticationError'; }
export class ProfileLoadError extends Error { name = 'ProfileLoadError'; }
type AuthValue = { loading: boolean; session: Session | null; user: User | null; profile: AuthProfile | null; profileError: string | null; signIn(email: string, password: string): Promise<void>; signOut(): Promise<void>; requestPasswordReset(email: string): Promise<void>; updatePassword(password: string): Promise<void>; confirmCurrentPassword(password: string): Promise<boolean> };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<AuthProfile|null>(null),[profileError,setProfileError]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const requestRef=useRef(0),authOperationRef=useRef(false);
  const fetchProfile=useCallback(async(next:Session):Promise<AuthProfile>=>{
    const query=()=>requireSupabase().from('profiles').select('id,display_name,role,active').eq('id',next.user.id).maybeSingle();
    let result=await query();
    if(!result.data&&!result.error){await new Promise(resolve=>setTimeout(resolve,250));result=await query();}
    if(result.error)throw new ProfileLoadError(`Sessão válida, mas o perfil não pôde ser carregado: ${result.error.message}`);
    if(!result.data)throw new ProfileLoadError('Sessão válida, mas não existe perfil de acesso vinculado a este usuário.');
    return result.data as AuthProfile;
  },[]);
  const hydrate=useCallback(async(next:Session|null)=>{
    const request=++requestRef.current;setLoading(true);setProfileError(null);setSession(next);
    if(!next){setProfile(null);setLoading(false);return;}
    try{const loaded=await fetchProfile(next);if(request!==requestRef.current)return;setProfile(loaded);}
    catch(error){if(request!==requestRef.current)return;setProfile(null);const message=error instanceof Error?error.message:'Falha ao carregar o perfil.';setProfileError(message);throw error;}
    finally{if(request===requestRef.current)setLoading(false);}
  },[fetchProfile]);
  useEffect(()=>{
    let active=true;
    void requireSupabase().auth.getSession().then(async({data,error})=>{if(!active)return;if(error){setProfileError(error.message);setLoading(false);return;}try{await hydrate(data.session);}catch{/* erro separado já armazenado */}});
    const{data}=requireSupabase().auth.onAuthStateChange((_event,next)=>{if(!active||authOperationRef.current)return;setSession(next);setLoading(true);window.setTimeout(()=>{if(active)void hydrate(next).catch(()=>undefined);},0);});
    return()=>{active=false;data.subscription.unsubscribe();};
  },[hydrate]);
  const value=useMemo<AuthValue>(()=>({loading,session,user:session?.user??null,profile,profileError,
    async signIn(email,password){if(authOperationRef.current)throw new AuthenticationError('Uma autenticação já está em andamento.');authOperationRef.current=true;setLoading(true);setProfileError(null);try{const{data,error}=await requireSupabase().auth.signInWithPassword({email,password});if(error)throw new AuthenticationError(error.message);if(!data.session||!data.user)throw new AuthenticationError('O Supabase não retornou uma sessão válida.');await hydrate(data.session);}catch(error){setLoading(false);throw error;}finally{authOperationRef.current=false;}},
    async signOut(){authOperationRef.current=true;setLoading(true);try{const{error}=await requireSupabase().auth.signOut();if(error)throw error;await hydrate(null);}finally{authOperationRef.current=false;}},
    async requestPasswordReset(email){const{error}=await requireSupabase().auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/recuperar-senha`});if(error)throw error;},
    async updatePassword(password){const{error}=await requireSupabase().auth.updateUser({password});if(error)throw error;},
    async confirmCurrentPassword(password){if(!session?.user.email)return false;const{error}=await requireSupabase().auth.signInWithPassword({email:session.user.email,password});return!error;},
  }),[loading,session,profile,profileError,hydrate]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth deve estar dentro de AuthProvider.');return context;}
