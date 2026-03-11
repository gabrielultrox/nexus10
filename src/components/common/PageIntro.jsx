function PageIntro({ eyebrow, title, description }) {
  return (
    <section className="page-intro">
      <p className="page-intro__eyebrow">{eyebrow}</p>
      <h2 className="page-intro__title">{title}</h2>
      <p className="page-intro__description">{description}</p>
    </section>
  );
}

export default PageIntro;
