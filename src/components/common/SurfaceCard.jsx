function SurfaceCard({ title, children }) {
  return (
    <section className="surface-card">
      {title ? <h3 className="surface-card__title">{title}</h3> : null}
      <div className="surface-card__content">{children}</div>
    </section>
  );
}

export default SurfaceCard;
