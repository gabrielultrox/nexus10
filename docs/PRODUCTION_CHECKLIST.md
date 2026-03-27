# Nexus10 Production Checklist

## Segurança

- [ ] `FRONTEND_ORIGIN` configurado com a URL real do frontend
- [ ] `LOCAL_OPERATOR_PASSWORD` forte e não default
- [ ] `FIREBASE_ADMIN_PRIVATE_KEY` guardada em secret manager
- [ ] `firestore.rules` publicadas e revisadas
- [ ] `helmet`, rate limit e CORS estrito ativos
- [ ] autenticação Firebase obrigatória nas rotas protegidas
- [ ] Swagger não expõe segredos
- [ ] `legacy/` continua fora do deploy
- [ ] `.env` não está versionado
- [ ] Sentry DSN e Discord webhook configurados no ambiente correto

## Performance

- [ ] `npm run build` passou
- [ ] índices Firestore necessários publicados
- [ ] queries novas evitam collection scan
- [ ] paginação por cursor usada onde necessário
- [ ] Redis configurado se o ambiente exige menor latência
- [ ] p95 monitorado no dashboard/admin
- [ ] bundles críticos foram revisados após mudanças grandes

## Monitoring

- [ ] `GET /api/health` responde `200`
- [ ] Sentry está recebendo erros
- [ ] alertas Discord estão ativos
- [ ] dashboard `GET /api/admin/monitoring/dashboard` acessível para admin
- [ ] taxa de erro abaixo de `5%`
- [ ] latência p95 abaixo de `1s`
- [ ] webhook iFood sem falhas repetidas

## Compliance

- [ ] audit log ativo para operações críticas
- [ ] retenção de logs definida
- [ ] backup/export do Firestore programado
- [ ] acesso admin revisado
- [ ] credenciais antigas rotacionadas quando necessário
- [ ] documentação de deploy e rollback atualizada

## Release Gate

Publicar somente se todos os blocos acima estiverem completos ou se o risco residual estiver explícito e aprovado.
