import type {
  ChangeEvent,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export type UIFormInputType = 'text' | 'password' | 'email' | 'number' | 'tel'
export type UIFormResize = 'none' | 'vertical' | 'horizontal' | 'both'
export type UIDatePickerValue = string | { start?: string; end?: string }

export interface IFormFieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  htmlFor?: string
  children: ReactNode
  inline?: boolean
}

export interface IInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'children'> {
  type?: UIFormInputType
  error?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export interface ICheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'children'> {
  label?: ReactNode
  indeterminate?: boolean
  description?: ReactNode
}

export interface ICheckboxOption {
  label: ReactNode
  value: string
  description?: ReactNode
  disabled?: boolean
}

export interface ICheckboxGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  name: string
  options: ICheckboxOption[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}

export interface IRadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children' | 'size'> {
  label?: ReactNode
  description?: ReactNode
}

export interface IRadioOption {
  label: ReactNode
  value: string
  description?: ReactNode
  disabled?: boolean
}

export interface IRadioGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  name: string
  value?: string
  onChange: (value: string) => void
  options: IRadioOption[]
  disabled?: boolean
}

export interface ITextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> {
  error?: boolean
  resize?: UIFormResize
  showCounter?: boolean
}

export interface ISelectOption {
  label: ReactNode
  value: string
  disabled?: boolean
  keywords?: string[]
}

export interface ISelectOptionGroup {
  label: ReactNode
  options: ISelectOption[]
}

export interface IFormSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'size'> {
  options?: Array<ISelectOption | ISelectOptionGroup>
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
  error?: boolean
  children?: ReactNode
  onValueChange?: (value: string) => void
}

export interface IFileInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: File[] | null
  onChange?: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  error?: boolean
  label?: ReactNode
  hint?: ReactNode
  preview?: boolean
  emptyLabel?: ReactNode
}

export interface IDatePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: UIDatePickerValue
  onChange?: (value: UIDatePickerValue) => void
  range?: boolean
  disabled?: boolean
  error?: boolean
  min?: string
  max?: string
  placeholder?: string
}

export interface ICompleteFormExampleValues {
  fullName: string
  email: string
  phone: string
  category: string
  urgency: string
  tags: string[]
  description: string
  dueDate: string
  resolutionWindow: { start?: string; end?: string }
  attachments: File[]
}

export interface IFormSelectSyntheticEvent {
  target: { value: string; name?: string }
}

export type TInputChangeHandler = (event: ChangeEvent<HTMLInputElement>) => void
export type TTextareaChangeHandler = (event: ChangeEvent<HTMLTextAreaElement>) => void
