# Nexus10 Architecture

## Visão Geral

Nexus10 é um ERP operacional com frontend React e backend Express, usando Firebase/Firestore como persistência principal e integração com iFood no backend.

## Diagrama Simplificado

```text
┌─────────────────────────────┐
│          Usuário            │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Frontend React + Vite       │
│ - páginas operacionais      │
│ - TanStack Query            │
│ - auth/context              │
│ - services                  │
└───────┬───────────────┬─────┘
        │               │
        │               └──────────────────────────────┐
        ▼                                              ▼
┌───────────────────────┐                     ┌───────────────────────┐
│ Firebase Client SDK   │                     │ Backend Express       │
│ - auth                │                     │ - authz               │
│ - firestore client    │                     │ - validação Zod       │
│ - cache local         │                     │ - iFood integration   │
└──────────┬────────────┘                     │ - audit/admin APIs    │
           │                                  │ - swagger /api-docs   │
           ▼                                  └───────┬───────────────┘
┌─────────────────────────────┐                      │
│ Firestore                   │◄─────────────────────┘
│ - dados operacionais        │
│ - audit logs                │
│ - merchants / catálogo      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Redis (opcional)            │
│ - sessão autenticada        │
│ - merchants iFood           │
│ - catálogo de produtos      │
└─────────────────────────────┘
```

## Estrutura de Pastas

```text
src/              frontend React
src/services/     acesso a dados e integrações client-side
src/modules/      módulos operacionais/comerciais
src/components/   componentes reutilizáveis e UI
backend/          servidor Express, integrações e auth
backend/modules/  controllers por domínio
backend/types/    tipos do backend
docs/             documentação técnica
```

## Decisões Arquiteturais

### 1. Frontend e backend separados, mas no mesmo repositório

Motivo:

- deploy simples no estágio atual
- menor custo de coordenação
- facilita evoluir backend e frontend juntos

Tradeoff:

- precisa disciplina para não acoplar demais o frontend ao formato interno do backend

### 2. Firestore como persistência principal

Motivo:

- baixa fricção operacional
- bom encaixe com dados semi-estruturados
- integração natural com Firebase Auth e client SDK

Tradeoff:

- exige cuidado com índices
- collection scans custam caro se a modelagem sair do padrão

### 3. Backend Express para regras sensíveis e integrações externas

Motivo:

- iFood exige segredos e fluxo server-side
- auditoria, validação e autorização precisam de camada confiável
- reduz exposição de lógica sensível no client

### 4. Redis opcional como cache de aceleração

Motivo:

- reduz latência em sessão autenticada e leituras repetidas
- melhora chamadas frequentes de merchants e catálogo

Tradeoff:

- adiciona uma dependência operacional a mais
- por isso o sistema mantém fallback para Firestore

### 5. Migração gradual para TypeScript

Motivo:

- repositório histórico é majoritariamente JavaScript
- migração em fatias reduz risco
- backend já iniciou com entrypoint e tipos base em `.ts`

## Fluxo de Dados

## Fluxo 1: autenticação operacional

1. usuário informa operador + PIN
2. frontend chama `POST /api/auth/session`
3. backend valida operador local e gera sessão Firebase/custom token
4. frontend autentica no Firebase
5. requests seguintes carregam `Authorization: Bearer <idToken>`

## Fluxo 2: pedidos e vendas

1. frontend envia request para backend ou lê dados do Firestore conforme o módulo
2. backend valida input com Zod
3. backend aplica auth e escopo de loja
4. operação persiste no Firestore
5. evento relevante entra em audit log
6. frontend invalida cache e refaz query

## Fluxo 3: integração iFood

1. backend consulta merchants configurados
2. polling ou sync chama APIs do iFood
3. payload é transformado para modelo interno
4. dados são persistidos no Firestore
5. webhooks externos podem alimentar o mesmo pipeline

## Fluxo 4: auditoria

1. ação operacional/comercial gera evento
2. evento é salvo em audit log por loja
3. tela administrativa consulta `GET /api/admin/audit-logs`
4. admin filtra e exporta CSV

## Convenções Operacionais

- rotas protegidas ficam sob `/api`
- `request.validated` carrega payload validado por middleware
- `request.authUser` carrega identidade autenticada
- `request.log` carrega logger contextual da requisição

## Riscos e Pontos de Atenção

- Firestore exige índices alinhados às queries reais
- novas rotas precisam entrar no Swagger
- qualquer mutação relevante deve produzir audit log
- integrações iFood precisam de timeout, retry e tratamento idempotente
- módulos antigos ainda podem ter partes fora da camada centralizada de query/cache

## Próximos Passos Arquiteturais Recomendados

1. ampliar TypeScript no backend central
2. migrar mais telas para TanStack Query
3. reduzir listas full-scan do Firestore em módulos legados
4. consolidar componentes do design system nas telas principais
