<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function uuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function supabaseRequest(
    string $method,
    string $endpoint,
    string $url,
    string $key,
    string $authorization,
    ?array $payload = null
): array {
    $curl = curl_init($url . $endpoint);
    $headers = [
        'apikey: ' . $key,
        'Authorization: ' . $authorization,
        'Content-Type: application/json',
        'Prefer: return=representation',
    ];
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 20,
    ]);
    if ($payload !== null) {
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
    }
    $content = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    return [
        'status' => $status,
        'body' => is_string($content) ? json_decode($content, true) : null,
        'transportError' => $error,
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$operationId = bin2hex(random_bytes(16));
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Método não permitido.', 'operationId' => $operationId]);
}

$url = rtrim((string) getenv('SUPABASE_URL'), '/');
$key = (string) getenv('SUPABASE_PUBLISHABLE_KEY');
$expectedHash = strtolower(trim((string) getenv('MASTER_PASSWORD_HASH')));
$authorization = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');

if ($url === '' || $key === '' || $expectedHash === '') {
    respond(503, ['error' => 'Validação administrativa não configurada no servidor.', 'operationId' => $operationId]);
}
if (!str_starts_with($authorization, 'Bearer ')) {
    respond(401, ['error' => 'Sessão expirada.', 'operationId' => $operationId]);
}

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body)) {
    respond(400, ['error' => 'Requisição inválida.', 'operationId' => $operationId]);
}

$userResponse = supabaseRequest('GET', '/auth/v1/user', $url, $key, $authorization);
if ($userResponse['status'] !== 200 || !is_array($userResponse['body'])) {
    respond(401, ['error' => 'Sessão expirada.', 'operationId' => $operationId]);
}
$user = $userResponse['body'];
$userId = (string) ($user['id'] ?? '');
$metadataRole = (string) ($user['app_metadata']['role'] ?? '');
$profileResponse = supabaseRequest(
    'GET',
    '/rest/v1/profiles?id=eq.' . rawurlencode($userId) . '&select=role,active&limit=1',
    $url,
    $key,
    $authorization
);
$profile = is_array($profileResponse['body']) ? ($profileResponse['body'][0] ?? []) : [];
$role = (string) ($profile['role'] ?? $metadataRole);
$active = ($profile['active'] ?? true) !== false
    && ($user['app_metadata']['active'] ?? true) !== false;

$password = (string) ($body['password'] ?? '');
$actualHash = hash('sha256', $password);
if (!hash_equals($expectedHash, $actualHash)) {
    respond(403, ['error' => 'Senha incorreta.', 'operationId' => $operationId]);
}
if (!$active || !in_array($role, ['owner', 'admin'], true)) {
    respond(403, ['error' => 'Usuário sem autorização.', 'operationId' => $operationId]);
}

$action = (string) ($body['action'] ?? '');
if ($action === 'verify') {
    respond(200, ['ok' => true, 'message' => 'Operação concluída.', 'operationId' => $operationId]);
}
if ($action === 'verify-owner') {
    if ($role !== 'owner') {
        respond(403, ['error' => 'Usuário sem autorização.', 'operationId' => $operationId]);
    }
    respond(200, ['ok' => true, 'message' => 'Operação concluída.', 'operationId' => $operationId]);
}

if ($action === 'create-bank') {
    $record = is_array($body['record'] ?? null) ? $body['record'] : [];
    $name = trim((string) ($record['name'] ?? ''));
    $bank = trim((string) ($record['banco'] ?? ''));
    if ($name === '' || $bank === '') {
        respond(400, ['error' => 'Nome da conta e banco são obrigatórios.', 'operationId' => $operationId]);
    }
    $payload = [
        'id' => uuidV4(),
        'name' => $name,
        'banco' => $bank,
        'responsavel' => trim((string) ($record['responsavel'] ?? '')),
        'tipo_conta' => trim((string) ($record['tipo_conta'] ?? '')),
        'balance' => (float) ($record['balance'] ?? 0),
        'secondary_balance' => (float) ($record['secondary_balance'] ?? 0),
        'company_id' => ($record['company_id'] ?? null) ?: null,
    ];
    $created = supabaseRequest('POST', '/rest/v1/banks', $url, $key, $authorization, $payload);
    if ($created['status'] < 200 || $created['status'] >= 300) {
        respond(400, ['error' => 'Não foi possível criar o banco.', 'operationId' => $operationId]);
    }
    respond(200, ['ok' => true, 'message' => 'Operação concluída.', 'operationId' => $operationId]);
}

if ($action === 'set-invested-current') {
    $value = $body['value'] ?? null;
    if (!is_numeric($value) || (float) $value < 0) {
        respond(400, ['error' => 'Valor inválido.', 'operationId' => $operationId]);
    }
    $updated = supabaseRequest(
        'POST',
        '/rest/v1/rpc/set_manual_invested_current',
        $url,
        $key,
        $authorization,
        ['p_value' => (float) $value]
    );
    if ($updated['status'] < 200 || $updated['status'] >= 300) {
        respond(400, ['error' => 'Não foi possível atualizar o Investido Atual.', 'operationId' => $operationId]);
    }
    respond(200, ['ok' => true, 'message' => 'Operação concluída.', 'operationId' => $operationId]);
}

$allowedFields = [
    'banks' => ['name', 'banco', 'responsavel', 'tipo_conta', 'balance', 'secondary_balance', 'company_id'],
    'clients' => ['name', 'email', 'phone', 'document', 'address', 'company_id'],
    'properties' => ['description', 'address', 'status', 'valor_atual'],
    'motorcycles' => ['description', 'status', 'valor_atual'],
    'charges' => ['description', 'value', 'due_date', 'status', 'company_id', 'category_id', 'client_id', 'asset_id'],
    'transactions' => ['description', 'value', 'date', 'type', 'status', 'observation', 'category_id', 'company_id', 'id_conta'],
    'fixed_costs' => ['name', 'invoice', 'price', 'qty', 'total', 'due_date', 'status', 'category', 'company_id', 'category_id'],
];

if ($action === 'update') {
    $table = (string) ($body['table'] ?? '');
    $id = (string) ($body['id'] ?? '');
    if (!isset($allowedFields[$table]) || $id === '') {
        respond(400, ['error' => 'Operação fora da lista permitida.', 'operationId' => $operationId]);
    }
    $requested = is_array($body['changes'] ?? null) ? $body['changes'] : [];
    $changes = array_intersect_key($requested, array_flip($allowedFields[$table]));
    if ($changes === []) {
        respond(400, ['error' => 'Nenhum campo permitido informado.', 'operationId' => $operationId]);
    }
    $updated = supabaseRequest(
        'PATCH',
        '/rest/v1/' . $table . '?id=eq.' . rawurlencode($id),
        $url,
        $key,
        $authorization,
        $changes
    );
    if ($updated['status'] < 200 || $updated['status'] >= 300) {
        respond(400, ['error' => 'Não foi possível editar o registro.', 'operationId' => $operationId]);
    }
    respond(200, ['ok' => true, 'message' => 'Operação concluída.', 'operationId' => $operationId]);
}

respond(400, ['error' => 'Ação administrativa ainda não disponível neste servidor.', 'operationId' => $operationId]);
