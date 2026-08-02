# Auditoria de Custos Fixos

Data da auditoria: 27/07/2026  
Modo: somente leitura (`SELECT`)  
Gravações no Supabase: zero

## Escopo

- Custos fixos auditados: 102
- Transações auditadas: 1.309
- Pagamentos relacionados por referência: 82

## Problemas encontrados

### Valores ausentes ou iguais a zero

Foram encontrados 3 registros:

- INTER
- CONTADOR
- internet aurora

Nenhum valor foi inventado ou corrigido no banco.

### Recorrências duplicadas no mesmo mês

Foram encontrados 5 grupos:

- internet aurora: 2 registros em 05/2026
- SALARIO BIA: 3 registros em 04/2026
- IPTU: 2 registros em 04/2026
- IPTU: 2 registros em 05/2026
- IPTU: 2 registros em 06/2026

Nenhum registro foi excluído ou consolidado automaticamente.

### Status e pagamento

- Status “pago” sem `paid_at`: nenhum.
- `paid_at` preenchido com status não pago: nenhum.

### Campos obrigatórios de negócio

- Empresa ausente: nenhum.
- Categoria ausente: nenhum.
- Vencimento ausente: nenhum.

### Cálculo

- Total diferente de preço × quantidade: nenhum.

### Distribuição dos vencimentos

- Dia 1: 6
- Dia 7: 2
- Dia 10: 28
- Dia 11: 6
- Dia 13: 7
- Dia 15: 15
- Dia 20: 24
- Dia 21: 2
- Dia 23: 3
- Dia 25: 3
- Dia 30: 6

Os 8 registros dos dias 1 e 7 são exibidos em “Fora das faixas 9–31” para evitar ocultação de dados.

## Correções realizadas somente no projeto

- Cards compactados e agrupados por vencimento.
- Ordenação crescente dentro de cada grupo.
- Painel Visualizar simplificado e traduzido.
- UUIDs e campos técnicos removidos da visualização.
- Histórico e gráfico baseados exclusivamente em pagamentos relacionados.
- Validação server-side adicionada para impedir nova duplicidade da mesma recorrência no mesmo mês durante edição.

## Pendências de dados

Os 3 valores ausentes/zero e os 5 grupos duplicados exigem decisão do proprietário. Nenhum dado foi alterado durante esta auditoria.
