import { requireSupabase } from '../lib/supabase';
export type ValidationResult = { valid: boolean; configured: boolean; message: string };

async function validate(password: string, allowed: Array<'owner'|'admin'>): Promise<ValidationResult> {
  const client=requireSupabase(); const {data:{user}}=await client.auth.getUser();
  if(!user?.email)return{valid:false,configured:true,message:'Sessão autenticada obrigatória.'};
  const {data:profile,error:profileError}=await client.from('profiles').select('role,active').eq('id',user.id).single();
  if(profileError||!profile?.active||!allowed.includes(profile.role))return{valid:false,configured:true,message:'Seu perfil não possui permissão para esta ação.'};
  const {error}=await client.auth.signInWithPassword({email:user.email,password});
  return error?{valid:false,configured:true,message:'Senha atual incorreta.'}:{valid:true,configured:true,message:'Acesso autorizado.'};
}
export const validateAdministrativePassword=(password:string)=>validate(password,['owner','admin']);
export const validateOwnerPassword=(password:string)=>validate(password,['owner']);
