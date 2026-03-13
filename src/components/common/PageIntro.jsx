function PageIntro(props) {
  const { eyebrow, title } = props

  return (
    <div className="page-intro">
      <span className="page-intro__eyebrow">{eyebrow}</span>
      <h1 className="page-intro__title">{title}</h1>
    </div>
  )
}

export default PageIntro
