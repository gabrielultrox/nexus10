# UI TypeScript Migration

## Escopo desta fase

Componentes migrados para TypeScript:

- `src/components/ui/Button.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/Table.tsx`
- `src/components/ui/Select.tsx`
- `src/components/ui/FormRow.tsx`

Tipos compartilhados:

- `src/components/ui/types.ts`

Barrel de import:

- `src/components/ui/index.ts`

## Padrao adotado

- props compartilhadas ficam em `types.ts`
- componentes simples usam props tipadas diretamente
- componentes com estado interno ou refs usam `forwardRef`
- `Table` usa generic para tipar colunas e linhas
- `Card` usa compound component com `Header`, `Body` e `Footer`

## Compatibilidade

- imports sem extensao continuam funcionando
- a API publica foi preservada
- `Button` continua aceitando variantes usadas hoje no app, incluindo `ghost`

## Exemplo de consumo

Modulo atualizado:

- `src/modules/audit/components/AuditLogModule.jsx`

Import recomendado:

```tsx
import { Button, Table, Select } from '../../../components/ui'
```

## Proximo passo recomendado

Migrar em seguida:

1. `ConfirmDialog.jsx`
2. `StatusBadge.jsx`
3. `Toast.jsx`
4. `Toggle.jsx`
5. modulos com maior reutilizacao de `Table` e `Select`
