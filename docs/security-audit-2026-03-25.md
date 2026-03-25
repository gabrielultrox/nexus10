# Security Audit - 2026-03-25

## Resumo Executivo

O backend e o acesso ao Firestore deixaram de ser publicamente abertos. O projeto agora exige autenticacao Firebase valida para a API protegida, usa claims por papel/loja, aplica regras mais restritivas no Firestore, adiciona `helmet`, rate limiting e CORS estrito.

Ainda existem pontos residuais relevantes:

1. A senha operacional ainda e compartilhada por ambiente, nao por usuario.
2. O PIN local continua existindo como camada de conveniencia no frontend e nao deve ser tratado como controle de seguranca principal.
3. O historico Git contem um commit de bypass temporario de autenticacao (`3a9c254`), que deve ser considerado ao revisar governanca de release.

## O que foi verificado

### Historico de segredos

- `.env` nao aparece versionado no historico atual do repositório.
- Nenhuma chave privada apareceu rastreada pelos arquivos inspecionados do historico recente.
- Houve presenca historica de commits relacionados a bypass/auth temporario:
  - `3a9c254` - `fix(auth): bypass pin and login temporarily`

Conclusao: nao encontrei evidência de `.env` com segredo rastreado no Git a partir desta varredura, mas houve risco de governanca por bypass temporario de auth.

### Scan dedicado com Gitleaks

Ferramenta usada:

- `gitleaks 8.30.1`

Resultado:

- `188 commits scanned`
- `2 leaks found`

Achados:

1. chave com padrao `gcp-api-key` em [legacy/index-legacy.html](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\legacy\index-legacy.html):43
2. chave com padrao `gcp-api-key` em [legacy/legacy-core.html](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\legacy\legacy-core.html):43

Contexto:

- ambos os achados apontam para o commit `3f13892`
- os arquivos estao em `legacy/`, que esta explicitamente marcado no projeto como area que nao deve ser modificada

Impacto:

- a chave tem formato real de Google API key e deve ser tratada como credencial exposta
- se ainda estiver ativa, precisa ser rotacionada e restringida no console do Google/Firebase

Acao recomendada:

1. verificar se a key ainda esta ativa
2. rotacionar a key
3. restringir por origem HTTP e por APIs necessarias
4. decidir se o conteudo de `legacy/` vai continuar distribuido; se sim, esse material precisa de saneamento fora do fluxo normal, porque a pasta esta protegida contra edicao neste projeto

### APIs chamadas pelo frontend

Chamadas para o backend protegidas por `requestBackend`:

- [src/contexts/AuthContext.jsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\contexts\AuthContext.jsx)
- [src/services/assistant.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\assistant.js)
- [src/services/orders.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\orders.js)
- [src/services/sales.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\sales.js)

Conclusao: nao encontrei um segundo cliente HTTP para o backend fora de `requestBackend`. O `httpClient` TypeScript novo existe, mas ainda nao substituiu a camada atual.

## Endurecimentos implementados

- API protegida por token Firebase nao anonimo
- claims com `role`, `tenantId`, `storeIds`, `defaultStoreId`
- autorizacao por permissao/loja no backend
- `firestore.rules` com controle por usuario, papel e loja
- `helmet`
- rate limiting de API e login
- CORS sem fallback aberto
- `.vscode/` removido do Git
- `LOCAL_OPERATOR_PASSWORD` obrigatoria em producao

## Proximos passos recomendados

1. Remover a senha operacional compartilhada e migrar para credencial por usuario.
2. Substituir o PIN local como mecanismo de acesso por um fluxo de sessao mais forte, ou tratá-lo apenas como atalho UX documentado.
3. Migrar `requestBackend` para usar a base de `httpClient` + `errorHandler` de forma centralizada.
4. Revisar historico Git completo com ferramenta especializada de secret scanning antes de qualquer compliance formal.
5. Avaliar se `OPENAI_API_KEY` realmente precisa ficar no backend desse projeto e restringir seu escopo de uso.
