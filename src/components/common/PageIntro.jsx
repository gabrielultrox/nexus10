function PageIntro(props) {
  const { title, description } = props

  return (
    <div className="page-intro">
      <div className="page-intro__copy">
        <h1 className="page-intro__title">{title}</h1>
        {description ? <p className="page-intro__subtitle">{description}</p> : null}
      </div>
    </div>
  )
}

export default PageIntro
