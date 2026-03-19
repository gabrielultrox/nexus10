function FormRow({ children, className = '' }) {
  return <div className={['form-row', className].filter(Boolean).join(' ')}>{children}</div>;
}

export default FormRow;

