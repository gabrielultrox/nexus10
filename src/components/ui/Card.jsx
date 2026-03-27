function Card({ children, className = '', interactive = false, ...props }) {
  const classes = ['ui-card', interactive ? 'ui-card--interactive' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={classes} {...props}>
      {children}
    </section>
  )
}

function Header({ children, className = '' }) {
  return (
    <header className={['ui-card__header', className].filter(Boolean).join(' ')}>{children}</header>
  )
}

function Body({ children, className = '' }) {
  return <div className={['ui-card__body', className].filter(Boolean).join(' ')}>{children}</div>
}

function Footer({ children, className = '' }) {
  return (
    <footer className={['ui-card__footer', className].filter(Boolean).join(' ')}>{children}</footer>
  )
}

Card.Header = Header
Card.Body = Body
Card.Footer = Footer

export default Card
