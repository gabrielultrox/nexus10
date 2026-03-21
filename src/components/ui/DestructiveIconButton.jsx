import TrashIcon from './TrashIcon';

function DestructiveIconButton({
  className = '',
  label = 'Excluir',
  title,
  ...props
}) {
  return (
    <button
      type="button"
      className={`ui-destructive-button ${className}`.trim()}
      aria-label={label}
      title={title ?? label}
      {...props}
    >
      <TrashIcon className="ui-destructive-button__icon" title={title ?? label} />
    </button>
  );
}

export default DestructiveIconButton;
