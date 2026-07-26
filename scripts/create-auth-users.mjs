import { readFile } from 'node:fs/promises';

const env = Object.fromEntries((await readFile(new URL('../.env.local', import.meta.url), 'utf8')).split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => { const at=line.indexOf('='); return [line.slice(0,at),line.slice(at+1)]; }));
const users = [{ email: process.env.OWNER_EMAIL, password: process.env.OWNER_PASSWORD }, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }];
for (const user of users) {
  if (!user.email || !user.password) throw new Error('Credenciais temporárias de usuário não fornecidas ao processo.');
  const response = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/signup`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(user) });
  if (response.ok) console.log(`${user.email === users[0].email ? 'OWNER' : 'ADMIN'}_AUTH=CREATED_OR_CONFIRMATION_PENDING`);
  else if (response.status === 422 || response.status === 400) console.log(`${user.email === users[0].email ? 'OWNER' : 'ADMIN'}_AUTH=ALREADY_EXISTS_OR_REQUIRES_PANEL`);
  else throw new Error(`Falha segura no Auth: HTTP ${response.status}.`);
}
