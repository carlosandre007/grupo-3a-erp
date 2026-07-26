import { readFile } from 'node:fs/promises';
const env=Object.fromEntries((await readFile(new URL('../.env.local',import.meta.url),'utf8')).split(/\r?\n/).filter(line=>line&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)]}));
const email=process.env.TEST_EMAIL,password=process.env.TEST_PASSWORD,label=process.env.TEST_LABEL||'USER';
if(!email||!password)throw new Error('Credenciais de teste ausentes.');
const tokenResponse=await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
if(!tokenResponse.ok){const failure=await tokenResponse.json().catch(()=>({}));console.log(`${label}_LOGIN=FAILED_HTTP_${tokenResponse.status}_${failure.error_code||failure.code||'UNKNOWN'}`);process.exitCode=1;}else{
 const auth=await tokenResponse.json();
 const profileResponse=await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${auth.user.id}&select=role,active`,{headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${auth.access_token}`}});
 const profiles=profileResponse.ok?await profileResponse.json():[];
 console.log(`${label}_LOGIN=OK`);console.log(`${label}_PROFILE=${profiles[0]?.role||'MISSING'}`);
 const logout=await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${auth.access_token}`}});
 console.log(`${label}_LOGOUT=${logout.ok?'OK':`FAILED_HTTP_${logout.status}`}`);
}
