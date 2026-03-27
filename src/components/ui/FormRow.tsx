import type { IFormRowProps } from './types'

function FormRow({ children, className = '', ...props }: IFormRowProps) {
  return (
    <div className={['form-row', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  )
}

export default FormRow
