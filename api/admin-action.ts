import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const allowedTables = new Set([
  'banks', 'clients', 'properties', 'motorcycles', 'charges', 'transactions', 'fixed_costs',
]);

const editableFields: Record<string, Set<string>> = {
  banks: new Set(['name', 'balance', 'secondary_balance', 'company_id']),
  clients: new Set(['name', 'email', 'phone', 'document', 'address', 'company_id']),
  properties: new Set(['description', 'address', 'status', 'valor_atual']),
  motorcycles: new Set(['description', 'status', 'valor_atual']),
  charges: new Set(['description', 'value', 'due_date', 'status', 'company_id', 'category_id', 'client_id', 'asset_id']),
  transactions: new Set(['description', 'value', 'date', 'type', 'status', 'observation', 'category_id', 'company_id', 'id_conta']),
  fixed_costs: new Set(['name', 'invoice', 'price', 'qty', 'total', 'due_date', 'status', 'category', 'company_id', 'category_id']),
};

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>;
};

const authorized = (password: string, expected: string) => {
  const actual = Buffer.from(createHash('sha256').update(password).digest('hex'));
  const target = Buffer.from(expected.trim().toLowerCase());
  return actual.length === target.length && timingSafeEqual(actual, target);
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const operationId = randomUUID();
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.', operationId });

  try {
    const body = await readBody(req);
    const password = String(body.password ?? '');
    const expected = process.env.MASTER_PASSWORD_HASH;
    const authorization = String(req.headers.authorization ?? '');
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!authorization.startsWith('Bearer ') || !url || !key) {
      return json(res, 503, { error: 'Ambiente server-side incompleto.', operationId });
    }

    const headers = {
      apikey: key,
      Authorization: authorization,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers });
    if (!userResponse.ok) return json(res, 401, { error: 'Sessão inválida ou expirada.', operationId });

    const user = await userResponse.json() as {
      id?: string;
      app_metadata?: { role?: string; active?: boolean };
    };
    let profileRole = '';
    let profileActive = true;
    const profileResponse = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id ?? '')}&select=role,active&limit=1`,
      { headers },
    );
    if (profileResponse.ok) {
      const profiles = await profileResponse.json() as Array<{ role?: string; active?: boolean }>;
      profileRole = String(profiles[0]?.role ?? '');
      profileActive = profiles[0]?.active !== false;
    }
    const isOwner = (
      profileRole === 'owner'
      || user.app_metadata?.role === 'owner'
    ) && profileActive && user.app_metadata?.active !== false;
    const effectiveRole = profileRole || String(user.app_metadata?.role || '');
    const isAuthorizedAdmin = ['owner', 'admin'].includes(effectiveRole)
      && profileActive
      && user.app_metadata?.active !== false;
    const action = String(body.action ?? '');

    if (action === 'pay-charge') {
      const id = String(body.id ?? '');
      const paidAt = new Date();
      const paidDate = paidAt.toISOString().slice(0, 10);
      const chargeResponse = await fetch(
        `${url}/rest/v1/charges?id=eq.${encodeURIComponent(id)}&select=*`,
        { headers },
      );
      const chargeRows = await chargeResponse.json() as Array<Record<string, unknown>>;
      const charge = chargeRows[0];
      if (!chargeResponse.ok || !charge) {
        return json(res, 404, { error: 'Cobrança não encontrada.', operationId });
      }
      if (
        ['received', 'paid', 'pago'].includes(String(charge.status ?? '').toLowerCase())
        || charge.received_at
      ) {
        return json(res, 409, { error: 'Cobrança já registrada como paga.', operationId });
      }

      const duplicateResponse = await fetch(
        `${url}/rest/v1/transactions?or=(reference_id.eq.${encodeURIComponent(id)},referencia_id.eq.${encodeURIComponent(id)})&select=id&limit=1`,
        { headers },
      );
      const duplicates = await duplicateResponse.json() as Array<Record<string, unknown>>;
      if (duplicateResponse.ok && duplicates.length) {
        return json(res, 409, { error: 'Pagamento já lançado no Fluxo de Caixa.', operationId });
      }

      const transactionId = randomUUID();
      const value = Number(charge.value ?? charge.valor_cobranca ?? 0);
      const paymentHash = createHash('sha256').update(`${id}|${paidDate}|${value}`).digest('hex');
      const transaction = {
        id: transactionId,
        description: `Recebimento: ${String(charge.ref ?? charge.client_name ?? id)}`,
        category: 'Receita de cobrança',
        category_id: charge.category_id ?? charge.id_categoria_financeira ?? null,
        company_id: charge.company_id ?? null,
        value,
        type: 'in',
        date: paidDate,
        status: 'confirmed',
        referencia_id: id,
        reference_id: id,
        source_module: 'charges',
        origem: 'agenda_cobranca',
        payment_hash: paymentHash,
        payment_registered: true,
        time: paidAt.toTimeString().slice(0, 8),
        responsible: user.id ?? null,
        observation: String(charge.observation ?? ''),
        created_by: user.id ?? null,
      };
      const insert = await fetch(`${url}/rest/v1/transactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(transaction),
      });
      if (!insert.ok) {
        return json(res, 400, { error: 'Não foi possível registrar a receita no Fluxo de Caixa.', operationId });
      }

      const updateCharge = await fetch(
        `${url}/rest/v1/charges?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'received', received_at: paidAt.toISOString() }),
        },
      );
      if (!updateCharge.ok) {
        const rollback = await fetch(
          `${url}/rest/v1/transactions?id=eq.${transactionId}`,
          { method: 'DELETE', headers },
        );
        return json(res, 500, {
          error: rollback.ok
            ? 'Pagamento revertido: não foi possível atualizar a cobrança.'
            : 'Falha crítica: cobrança não atualizada e rollback do lançamento falhou.',
          operationId,
        });
      }
      return json(res, 200, { ok: true, operationId, paidAt: paidAt.toISOString(), transaction });
    }

    if (!expected) return json(res, 503, { error: 'Validação administrativa não configurada no servidor.', operationId });
    if (!authorized(password, expected)) return json(res, 403, { error: 'Senha incorreta.', operationId });
    if (!isAuthorizedAdmin) return json(res, 403, { error: 'Usuário sem autorização.', operationId });
    if (action === 'verify') return json(res, 200, { authorized: true, operationId });
    if (action === 'verify-owner') {
      return isOwner
        ? json(res, 200, { authorized: true, owner: true, operationId })
        : json(res, 403, { error: 'Acesso restrito ao proprietário.', operationId });
    }

    if (action === 'set-invested-current') {
      if (!isOwner) return json(res, 403, { error: 'Usuário sem autorização.', operationId });
      const value = Number(body.value);
      if (!Number.isFinite(value) || value < 0) {
        return json(res, 400, { error: 'Valor inválido.', operationId });
      }
      const update = await fetch(`${url}/rest/v1/rpc/set_manual_invested_current`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_value: value }),
      });
      if (update.status === 404) {
        return json(res, 503, { error: 'Estrutura de Investido Atual ainda não autorizada.', operationId });
      }
      return update.ok
        ? json(res, 200, { ok: true, message: 'Operação concluída.', operationId })
        : json(res, 400, { error: 'Não foi possível salvar o valor manual.', operationId });
    }

    if (action === 'create-company') {
      const record = body.record && typeof body.record === 'object'
        ? body.record as Record<string, unknown>
        : {};
      const company = {
        id: randomUUID(),
        name: String(record.name ?? '').trim(),
        legal_name: String(record.legal_name ?? '').trim() || null,
        kind: String(record.kind ?? 'empresa').trim(),
      };
      if (!company.name) return json(res, 400, { error: 'Nome da empresa é obrigatório.', operationId });
      const created = await fetch(`${url}/rest/v1/companies`, {
        method: 'POST', headers, body: JSON.stringify(company),
      });
      return created.ok
        ? json(res, 200, { ok: true, message: 'Operação concluída.', operationId })
        : json(res, 400, { error: 'Não foi possível cadastrar a empresa.', operationId });
    }

    if (action === 'create-bank') {
      const record = body.record && typeof body.record === 'object'
        ? body.record as Record<string, unknown>
        : {};
      const bank = {
        id: randomUUID(),
        name: String(record.name ?? '').trim(),
        banco: String(record.banco ?? '').trim(),
        responsavel: String(record.responsavel ?? '').trim(),
        tipo_conta: String(record.tipo_conta ?? '').trim(),
        balance: Number(record.balance ?? 0),
        secondary_balance: Number(record.secondary_balance ?? 0),
        company_id: record.company_id || null,
      };
      if (!bank.name || !bank.banco) {
        return json(res, 400, { error: 'Nome da conta e banco são obrigatórios.', operationId });
      }
      const created = await fetch(`${url}/rest/v1/banks`, {
        method: 'POST', headers, body: JSON.stringify(bank),
      });
      return created.ok
        ? json(res, 200, { ok: true, message: 'Operação concluída.', operationId })
        : json(res, 400, { error: 'Não foi possível criar o banco.', operationId });
    }

    if (action === 'create-alert') {
      const record = body.record && typeof body.record === 'object'
        ? body.record as Record<string, unknown>
        : {};
      const alert = {
        id: randomUUID(),
        title: String(record.title ?? '').trim(),
        description: String(record.description ?? '').trim(),
        priority: String(record.priority ?? 'media'),
        due_date: record.due_date || null,
        company_id: record.company_id || null,
        created_by: user.id,
      };
      if (!alert.title || !alert.description) {
        return json(res, 400, { error: 'Título e descrição do alerta são obrigatórios.', operationId });
      }
      const created = await fetch(`${url}/rest/v1/alerts`, {
        method: 'POST', headers, body: JSON.stringify(alert),
      });
      if (created.status === 404) {
        return json(res, 503, { error: 'Estrutura de alertas ainda não autorizada.', operationId });
      }
      return created.ok
        ? json(res, 200, { ok: true, message: 'Operação concluída.', operationId })
        : json(res, 400, { error: 'Não foi possível criar o alerta.', operationId });
    }

    if (action === 'mark-fixed-cost-paid') {
      const id = String(body.id ?? '');
      const month = new Date().toISOString().slice(0, 7);
      const current = await fetch(
        `${url}/rest/v1/fixed_costs?id=eq.${encodeURIComponent(id)}&select=id,paid_at,status,month,year`,
        { headers },
      );
      const rows = await current.json() as Array<Record<string, unknown>>;
      const row = rows[0];
      const now = new Date();
      if (!current.ok || !row) {
        return json(res, 404, { error: 'Custo fixo não encontrado.', operationId });
      }
      if (
        String(row.paid_at ?? '').startsWith(month)
        || (
          Number(row.month) === now.getMonth() + 1
          && Number(row.year) === now.getFullYear()
          && String(row.status).toLowerCase() === 'pago'
        )
      ) {
        return json(res, 409, { error: 'Custo já pago no mês corrente.', operationId });
      }
      const update = await fetch(
        `${url}/rest/v1/fixed_costs?id=eq.${encodeURIComponent(id)}`,
        { method: 'PATCH', headers, body: JSON.stringify({ status: 'pago', paid_at: new Date().toISOString() }) },
      );
      return update.ok
        ? json(res, 200, { ok: true, operationId })
        : json(res, 400, { error: 'Pagamento rejeitado pelo banco.', operationId });
    }

    const table = String(body.table ?? '');
    const id = String(body.id ?? '');
    if (!allowedTables.has(table) || !id) {
      return json(res, 400, { error: 'Operação fora da lista permitida.', operationId });
    }

    const current = await fetch(
      `${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`,
      { headers },
    );
    const rows = await current.json() as Array<Record<string, unknown>>;
    if (!current.ok || !rows[0]) {
      return json(res, 404, { error: 'Registro não encontrado.', operationId });
    }

    if (action === 'update') {
      const requested = body.changes && typeof body.changes === 'object'
        ? body.changes as Record<string, unknown>
        : {};
      const allowed = editableFields[table] ?? new Set<string>();
      const changes: Record<string, unknown> = Object.fromEntries(
        Object.entries(requested).filter(([field]) => allowed.has(field)),
      );
      if (!Object.keys(changes).length) {
        return json(res, 400, { error: 'Nenhum campo permitido foi informado.', operationId });
      }
      if ('updated_at' in rows[0]) changes.updated_at = new Date().toISOString();

      if (table === 'fixed_costs') {
        const candidate = { ...rows[0], ...changes };
        const filters = new URLSearchParams({
          select: 'id',
          id: `neq.${id}`,
          month: `eq.${String(candidate.month ?? '')}`,
          year: `eq.${String(candidate.year ?? '')}`,
          limit: '1',
        });
        if (candidate.recurrence_group_id) {
          filters.set('recurrence_group_id', `eq.${String(candidate.recurrence_group_id)}`);
        } else {
          filters.set('name', `eq.${String(candidate.name ?? '')}`);
          filters.set('company', `eq.${String(candidate.company ?? '')}`);
          filters.set('category', `eq.${String(candidate.category ?? '')}`);
        }
        const duplicateResponse = await fetch(
          `${url}/rest/v1/fixed_costs?${filters.toString()}`,
          { headers },
        );
        const duplicates = duplicateResponse.ok
          ? await duplicateResponse.json() as Array<Record<string, unknown>>
          : [];
        if (duplicates.length) {
          return json(res, 409, {
            error: 'Já existe um custo desta recorrência no mesmo mês.',
            operationId,
          });
        }
      }

      if (table === 'transactions') {
        if (changes.type === 'receita') changes.type = 'in';
        if (changes.type === 'despesa') changes.type = 'out';
        if (changes.status === 'pago') changes.status = 'confirmed';
        if (changes.status === 'pendente') changes.status = 'pending';
        const previousAudit = Array.isArray(rows[0].audit_log) ? rows[0].audit_log as unknown[] : [];
        changes.audit_log = [...previousAudit, {
          at: new Date().toISOString(),
          actor_id: user.id ?? null,
          operation_id: operationId,
          before: rows[0],
          changes: { ...changes },
        }].slice(-100);
      }

      const update = await fetch(
        `${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
        { method: 'PATCH', headers, body: JSON.stringify(changes) },
      );
      return update.ok
        ? json(res, 200, { ok: true, operationId })
        : json(res, 400, { error: 'Atualização rejeitada pelo banco.', operationId });
    }

    if (action !== 'delete') return json(res, 400, { error: 'Ação inválida.', operationId });

    const reason = String(body.reason ?? '').trim();
    if (!reason) return json(res, 400, { error: 'O motivo da exclusão é obrigatório.', operationId });
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    const ip = forwarded || req.socket.remoteAddress || null;
    const atomic = await fetch(`${url}/rest/v1/rpc/secure_delete_with_audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_table_name: table,
        p_record_id: id,
        p_reason: reason,
        p_ip: ip,
      }),
    });

    if (atomic.status === 404) {
      return json(res, 503, {
        error: 'Exclusão bloqueada: operação atômica ainda não foi autorizada no Supabase.',
        operationId,
      });
    }
    return atomic.ok
      ? json(res, 200, { ok: true, operationId })
      : json(res, 400, { error: 'Exclusão atômica rejeitada pelo banco.', operationId });
  } catch {
    return json(res, 500, { error: 'Falha interna sanitizada.', operationId });
  }
}
