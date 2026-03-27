# Nexus10 Design System

## Objetivo

Formalizar a biblioteca base de interface do Nexus10 em cima das classes ja usadas no app. O objetivo aqui nao e criar um segundo sistema visual, e sim padronizar o que ja existe em `src/components/ui/`.

## Componentes base

### Button

- arquivo: `src/components/ui/Button.jsx`
- variantes:
  - `primary`
  - `secondary`
  - `danger`

Uso:

```jsx
import { Button } from '../components/ui';

<Button variant="primary">Salvar</Button>
```

### Card

- arquivo: `src/components/ui/Card.jsx`
- slots:
  - `Card.Header`
  - `Card.Body`
  - `Card.Footer`

Uso:

```jsx
<Card>
  <Card.Header>Resumo</Card.Header>
  <Card.Body>Conteudo</Card.Body>
  <Card.Footer>Acoes</Card.Footer>
</Card>
```

### Modal

- arquivo: `src/components/ui/Modal.jsx`
- comportamento:
  - renderiza em portal
  - fecha por backdrop
  - footer customizavel

### Table

- arquivo: `src/components/ui/Table.jsx`
- recursos:
  - ordenacao local por coluna
  - paginacao local
  - render custom de celula

## Storybook

Scripts:

- `npm run storybook`
- `npm run build-storybook`

Arquivos principais:

- `.storybook/main.js`
- `.storybook/preview.js`

## Tokens

Tokens formais em JSON:

- `src/design/tokens.json`

Os tokens sao espelhados dos valores base em `src/styles/tokens.css` e servem como referencia para documentacao, design handoff e futuras automacoes.

## Regra de uso

- use `Button` em acoes novas em vez de repetir `button.ui-button`
- use `Card` para containers novos com header/body/footer
- use `Modal` para fluxos curtos e formularios auxiliares
- use `Table` para listagens administrativas sem comportamento bespoke

Quando um fluxo precisar fugir do baseline, a excecao deve preservar os tokens e a linguagem visual base.
