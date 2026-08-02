import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import handler from '../api/admin-action';

type Call = { url: string; method: string; body?: string };

const password = 'test-only-password';
process.env.MASTER_PASSWORD_HASH = createHash('sha256').update(password).digest('hex');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';

const response = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const run = async (
  body: Record<string, unknown>,
  rpcStatus = 200,
) => {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    calls.push({ url, method, body: init?.body ? String(init.body) : undefined });
    if (url.endsWith('/auth/v1/user')) return response(200, { id: '00000000-0000-0000-0000-000000000001', app_metadata: { role: 'owner' } });
    if (url.includes('/profiles?')) return response(200, [{ role: 'owner', active: true }]);
    if (url.includes('/rpc/secure_delete_with_audit')) return response(rpcStatus, rpcStatus === 200 ? { deleted: true } : {});
    if (url.includes('/transactions?') || url.includes('/fixed_costs?')) {
      if (method === 'PATCH') return response(200, [{ id: body.id }]);
      return response(200, [{ id: body.id, description: 'registro', audit_log: [] }]);
    }
    return response(200, []);
  }) as typeof fetch;

  const raw = Buffer.from(JSON.stringify(body));
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer session-test', 'x-forwarded-for': '192.0.2.1' },
    socket: { remoteAddress: '192.0.2.2' },
    async *[Symbol.asyncIterator]() { yield raw; },
  };
  let statusCode = 0;
  let payload = '';
  const res = {
    setHeader() {},
    set statusCode(value: number) { statusCode = value; },
    get statusCode() { return statusCode; },
    end(value: string) { payload = value; },
  };
  await handler(req as never, res as never);
  return { statusCode, payload: JSON.parse(payload) as Record<string, unknown>, calls };
};

const wrong = await run({ action: 'update', table: 'transactions', id: crypto.randomUUID(), password: 'wrong', changes: { description: 'x' } });
if (wrong.statusCode !== 403 || wrong.payload.error !== 'Senha incorreta.' || wrong.calls.some(call => call.method === 'PATCH' || call.method === 'DELETE')) {
  throw new Error('Senha incorreta não bloqueou a alteração.');
}

const createdCompany = await run({ action: 'create-company', password, record: { name: 'Empresa de teste' } });
if (createdCompany.statusCode !== 200 || !createdCompany.calls.some(call => call.method === 'POST' && call.url.endsWith('/rest/v1/companies'))) {
  throw new Error('Cadastro com senha correta falhou.');
}

const blockedBank = await run({
  action: 'create-bank',
  password: 'wrong',
  record: { name: 'Conta teste', banco: 'Banco teste' },
});
if (blockedBank.statusCode !== 403 || blockedBank.calls.some(call => call.method === 'POST')) {
  throw new Error('Senha incorreta não bloqueou a criação do banco.');
}

const createdBank = await run({
  action: 'create-bank',
  password,
  record: { name: 'Conta teste', banco: 'Banco teste', balance: 0 },
});
if (createdBank.statusCode !== 200 || !createdBank.calls.some(call => call.method === 'POST' && call.url.endsWith('/rest/v1/banks'))) {
  throw new Error('Criação de banco com senha correta falhou.');
}

const edited = await run({ action: 'update', table: 'transactions', id: crypto.randomUUID(), password, changes: { description: 'editado', forbidden: 'x' } });
if (edited.statusCode !== 200 || !edited.calls.some(call => call.method === 'PATCH')) {
  throw new Error('Edição administrativa válida falhou.');
}
const patchBody = JSON.parse(edited.calls.find(call => call.method === 'PATCH')?.body || '{}');
if ('forbidden' in patchBody || !Array.isArray(patchBody.audit_log)) {
  throw new Error('Allowlist ou histórico de edição falhou.');
}

const deleted = await run({ action: 'delete', table: 'transactions', id: crypto.randomUUID(), password, reason: 'teste' });
if (deleted.statusCode !== 200 || !deleted.calls.some(call => call.url.includes('/rpc/secure_delete_with_audit'))) {
  throw new Error('Exclusão não utilizou a operação atômica.');
}
if (deleted.calls.some(call => call.method === 'DELETE')) {
  throw new Error('Foi detectado DELETE fora da função atômica.');
}

const unavailable = await run({ action: 'delete', table: 'fixed_costs', id: crypto.randomUUID(), password, reason: 'teste' }, 404);
if (unavailable.statusCode !== 503 || unavailable.calls.some(call => call.method === 'DELETE')) {
  throw new Error('Ausência da RPC não bloqueou a exclusão.');
}

const markedPaid = await run({ action: 'mark-fixed-cost-paid', id: crypto.randomUUID(), password });
if (markedPaid.statusCode !== 200 || !markedPaid.calls.some(call => call.method === 'PATCH' && call.url.includes('/fixed_costs?'))) {
  throw new Error('Marcar custo como pago não utilizou a atualização protegida.');
}

const duplicateEdit = await run({
  action: 'update',
  table: 'fixed_costs',
  id: crypto.randomUUID(),
  password,
  changes: { name: 'recorrência duplicada' },
});
if (duplicateEdit.statusCode !== 409 || duplicateEdit.calls.some(call => call.method === 'PATCH')) {
  throw new Error('Trava de recorrência duplicada no mesmo mês falhou.');
}

const sql = readFileSync('plans/secure-delete-with-audit.sql', 'utf8');
const insertPosition = sql.indexOf('insert into public.deletion_logs');
const deletePosition = sql.indexOf("execute format('delete from public.%I");
if (insertPosition < 0 || deletePosition < 0 || insertPosition > deletePosition || !sql.includes('begin;') || !sql.includes('commit;')) {
  throw new Error('Plano SQL não garante log anterior ao DELETE na mesma transação.');
}

console.log('admin-action-security-smoke: OK');
