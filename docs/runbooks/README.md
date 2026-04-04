# Runbooks Operacionais

Runbooks curtos para incidentes operacionais recorrentes do Nexus10.

## Lista

- [Falha de login](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\runbooks\login-failure.md)
- [Falha Firebase](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\runbooks\firebase-failure.md)
- [Falha scheduler Zé Delivery](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\runbooks\ze-delivery-scheduler-failure.md)
- [Falha webhook iFood](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\runbooks\ifood-webhook-failure.md)
- [Erro de deploy](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\runbooks\deploy-failure.md)
- [Erro de permissões](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\docs\runbooks\permissions-failure.md)

## Uso

1. Identifique o sintoma dominante.
2. Execute o bloco `Como diagnosticar` na ordem.
3. Aplique a `Ação imediata` mais curta que restaure o serviço.
4. Use `Rollback / mitigação` se a correção depender de deploy ou mudança de configuração.
5. Escale quando atingir o critério objetivo do runbook.
