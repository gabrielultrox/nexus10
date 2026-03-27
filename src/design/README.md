# Nexus10 Design Tokens

Os arquivos desta pasta definem a base visual do Nexus10.

## Arquivos

- `tokens.json`: fonte unica de verdade em formato de design tokens
- `tokens.css`: variaveis CSS geradas automaticamente a partir do JSON

## Fluxo correto

1. Edite `tokens.json`
2. Rode `npm run tokens:build`
3. Valide com `npm run tokens:check`

## Categorias cobertas

- cores de palette e semantica
- backgrounds, texto e bordas
- tipografia
- espacamento
- border radius
- shadows
- breakpoints
- mapeamento de temas `dark`, `light` e `amber`

## Exemplo de uso em componente

```tsx
export function TokenExampleCard() {
  return (
    <section
      style={{
        padding:
          'var(--token-spacing-default-paddingBlock) var(--token-spacing-default-paddingInline)',
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--token-radius-lg)',
        boxShadow: 'var(--token-shadow-md)',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontFamily: 'var(--font-title)',
          fontSize: 'var(--token-typography-fontSize-xl)',
          lineHeight: 'var(--token-typography-lineHeight-tight)',
        }}
      >
        Exemplo com tokens
      </h3>
    </section>
  )
}
```

## Observacao

`src/styles/tokens.css` continua contendo aliases e tokens operacionais do app, mas os valores-base agora devem nascer em `src/design/tokens.json`.
