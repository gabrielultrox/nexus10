# Form Components

## Objetivo

`src/components/ui/form` concentra a suite reutilizavel de formularios do Nexus10. A ideia e evitar markup repetido, padronizar estados de erro e manter o comportamento alinhado ao design system.

## Componentes

- `FormField`: wrapper com label, hint, erro e indicador de obrigatoriedade.
- `Input`: campos textuais com slots de icone e estado de erro.
- `Checkbox` e `CheckboxGroup`: uso unitario e grupos de checklist.
- `Radio` e `RadioGroup`: escolhas unicas.
- `Textarea`: suporte a contador e controle de resize.
- `Select`: nativo ou pesquisavel, com suporte a optgroups.
- `FileInput`: drag-and-drop, preview e limpeza de anexos.
- `DatePicker`: popup simples sem dependencia externa, com modo single e range.

## Uso basico

```tsx
import { FormField, Input, Select, Textarea } from '@/components/ui'

<FormField label="Cliente" required>
  <Input placeholder="Nome do cliente" />
</FormField>

<FormField label="Categoria">
  <Select
    placeholder="Selecione"
    options={[
      { label: 'Troco pendente', value: 'change' },
      { label: 'Estorno', value: 'refund' },
    ]}
  />
</FormField>

<FormField label="Descricao">
  <Textarea maxLength={280} showCounter />
</FormField>
```

## Padrao recomendado

1. Sempre encapsular controles dentro de `FormField`.
2. Usar `CheckboxGroup` e `RadioGroup` para listas em vez de montar repeticao manual.
3. Preferir `Select searchable` quando houver mais de 6-8 opcoes.
4. Usar `DatePicker range` apenas para janelas operacionais; para data simples, manter single.
5. Deixar validacao e mensagens de erro no container do formulario, passando o texto final para `FormField`.

## Exemplo completo

O componente [src/components/ui/form/CompleteFormExample.tsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\components\ui\form\CompleteFormExample.tsx) demonstra uma tela completa com todos os componentes principais.
