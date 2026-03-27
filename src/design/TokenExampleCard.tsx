export function TokenExampleCard() {
  return (
    <section
      style={{
        display: 'grid',
        gap: 'var(--token-spacing-scale-2)',
        padding:
          'var(--token-spacing-default-paddingBlock) var(--token-spacing-default-paddingInline)',
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--token-radius-lg)',
        boxShadow: 'var(--token-shadow-md)',
      }}
    >
      <span
        style={{
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--token-typography-fontSize-xs)',
          letterSpacing: 'var(--token-typography-letterSpacing-caps)',
          textTransform: 'uppercase',
        }}
      >
        Token example
      </span>
      <strong
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 'var(--token-typography-fontSize-xl)',
          lineHeight: 'var(--token-typography-lineHeight-tight)',
        }}
      >
        Fonte unica de verdade
      </strong>
      <span
        style={{
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--token-typography-fontSize-base)',
          lineHeight: 'var(--token-typography-lineHeight-normal)',
        }}
      >
        Este card usa somente tokens sem valores visuais hardcoded.
      </span>
    </section>
  )
}
