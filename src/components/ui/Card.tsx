import { forwardRef } from 'react'

import type { ICardProps, ICardSectionProps } from './types'

function Header({ children, className = '', ...props }: ICardSectionProps) {
  return (
    <header className={['ui-card__header', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </header>
  )
}

function Body({ children, className = '', ...props }: ICardSectionProps) {
  return (
    <div className={['ui-card__body', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  )
}

function Footer({ children, className = '', ...props }: ICardSectionProps) {
  return (
    <footer className={['ui-card__footer', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </footer>
  )
}

type CardComponent = React.ForwardRefExoticComponent<
  ICardProps & React.RefAttributes<HTMLElement>
> & {
  Header: typeof Header
  Body: typeof Body
  Footer: typeof Footer
}

const Card = Object.assign(
  forwardRef<HTMLElement, ICardProps>(function Card(
    { children, className = '', interactive = false, ...props },
    ref,
  ) {
    const classes = ['ui-card', interactive ? 'ui-card--interactive' : '', className]
      .filter(Boolean)
      .join(' ')

    return (
      <section ref={ref} className={classes} {...props}>
        {children}
      </section>
    )
  }),
  {
    Header,
    Body,
    Footer,
  },
) as CardComponent

export default Card
