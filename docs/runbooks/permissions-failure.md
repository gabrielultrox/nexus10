# Runbook: Erro de Permissões

## Sintoma

- Usuario autenticado recebe `403`, `401` ou mensagem de acesso negado.
- Tela carrega, mas acao sensivel falha.
- Rota admin, finance, audit ou integration bloqueia usuarios esperados.

## Como diagnosticar

1. Identificar a rota/endereco que falhou e o usuario afetado.

2. Validar se o backend continua saudavel:

```bash
curl http://127.0.0.1:8787/api/health
```

3. Rodar testes backend para autorizacao:

```bash
npm run test:backend
```

4. Revisar a protecao da rota no backend:

- `requireAuth`
- `requirePermission(...)`
- `requireRole('admin')`
- escopo por `storeId`

5. Conferir se a falha e de tela ou de API:

- frontend esconde acao por UX
- backend decide autorizacao real

## Ação imediata

- Se o usuario deveria ter acesso, corrigir a role/permissao no cadastro/claims e testar novamente.
- Se a rota exige escopo por loja, validar se `storeId` enviado corresponde a loja autorizada.
- Se a tela estiver bloqueando indevidamente, confirmar primeiro se a API aceita a operacao antes de corrigir a UI.

## Rollback / mitigação

- Reverter a ultima mudanca de autorizacao se ela removeu acesso valido.
- Manter bloqueio no frontend apenas como mitigacao visual; a protecao real precisa permanecer no backend.
- Se a permissao nova ainda nao estiver pronta, desabilitar a acao no fluxo afetado ate corrigir backend e UI juntos.

## Quando escalar

- Escalar se usuarios admin perderem acesso a rotas admin/audit/monitoring.
- Escalar se houver indicio de acesso cruzado entre lojas.
- Escalar se a rota responder dados sensiveis para usuario sem permissao.
