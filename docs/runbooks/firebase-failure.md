# Runbook: Falha Firebase

## Sintoma

- Leituras ou escritas falham no frontend ou backend.
- Erros de Firestore/Auth aparecem em logs ou Sentry.
- Regras ou indices recentes quebraram consultas.

## Como diagnosticar

1. Validar variaveis de ambiente do Firebase:

- frontend: `VITE_FIREBASE_*`
- backend: `FIREBASE_ADMIN_*`

2. Rodar validacoes de configuracao e backend:

```bash
npm run type-check
npm run type-check:backend
npm run test:backend
```

3. Verificar regras e indices versionados:

```bash
git diff -- firestore.rules firestore.indexes.json
```

4. Se o problema estiver em regras/indices, revisar os deploys recentes:

```bash
npm run firebase:deploy:rules
npm run firebase:deploy:indexes
```

5. Conferir se o backend continua saudavel:

```bash
curl http://127.0.0.1:8787/api/health
```

## Ação imediata

- Se for credencial invalida, restaurar `FIREBASE_ADMIN_*` e reiniciar o backend.
- Se for quebra de regra, reaplicar a ultima versao valida de `firestore.rules`.
- Se for indice faltando, publicar `firestore.indexes.json` e aguardar conclusao do build do indice.
- Se for erro so em dev, validar se o projeto aponta para producao ou emulator conforme esperado.

## Rollback / mitigação

- Fazer rollback de `firestore.rules` ou `firestore.indexes.json` para o ultimo commit estavel.
- Desabilitar temporariamente o fluxo afetado se a consulta nova for opcional.
- Manter leitura backward-compatible quando houver mudanca de shape de documento.

## Quando escalar

- Escalar se houver erro generalizado de leitura/escrita em mais de um modulo.
- Escalar se o Admin SDK falhar em inicializacao apos restaurar credenciais.
- Escalar se um indice critico nao concluir e bloquear operacao em producao.
