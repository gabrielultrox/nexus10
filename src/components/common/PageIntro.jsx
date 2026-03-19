function PageIntro(props) {
  const { eyebrow, title, description, subtitle } = props
  const copy = description ?? subtitle

  return (
    <div className="page-intro">
      <div className="page-intro__copy">
        {eyebrow ? <p className="page-intro__eyebrow">{eyebrow}</p> : null}
        <h1 className="page-intro__title">{title}</h1>
        {copy ? <p className="page-intro__subtitle">{copy}</p> : null}
      </div>
    </div>
  )
}

export default PageIntro
