function Button({
  children,
  className = '',
  variant = 'primary',
  type = 'button',
  disabled = false,
  ...props
}) {
  const classes = ['ui-button', `ui-button--${variant}`, className].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  );
}

export default Button;
