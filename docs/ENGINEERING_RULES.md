# Engineering Rules

## Objetivo

Este documento define o padrão mínimo para qualquer mudança no projeto.

## Ordem obrigatória

1. Analisar primeiro e identificar a causa raiz
2. Implementar a correção com o menor risco possível
3. Preservar compatibilidade com o restante do sistema
4. Validar com:
   - `npm run type-check`
   - testes aplicáveis
   - `npm run build`
5. Fazer commit e push automáticos ao final

## Restrições permanentes

- Nunca incluir `.env.local` ou arquivos locais de ambiente em commit
- Não alterar runtime fora do escopo sem necessidade
- Preferir correção pontual antes de refatorar estruturas amplas
- Quando houver risco de regressão, medir antes e depois

## Formato padrão de entrega

- o que foi alterado
- validação executada
- riscos residuais
- próximo passo recomendado

## Prompt curto reutilizável

```text
Faça a análise primeiro, identifique a causa raiz e depois implemente a correção com o menor risco possível.

Regras:
- preserve compatibilidade com o restante do sistema
- valide com type-check, testes e build
- faça commit e push automáticos ao final
- não inclua .env.local nem arquivos locais de ambiente
- entregue:
  - o que foi alterado
  - validação executada
  - riscos residuais
  - próximo passo recomendado
```
