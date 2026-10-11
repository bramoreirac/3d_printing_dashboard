import { useId, type ReactNode } from 'react'

interface FieldProps {
  label: string
  error?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode
}

/**
 * Labeled form field with inline error. The child is a render prop so any
 * input or select can be wired up with the same a11y attributes.
 * Uses useId so the id stays stable across re-renders (StrictMode-safe).
 */
export function Field({ label, error, children }: FieldProps) {
  const id = useId()
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': errorId })}
      {error && (
        <span className="error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
  step?: string
  min?: string
  placeholder?: string
  error?: string
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  step,
  min,
  placeholder,
  error,
}: TextFieldProps) {
  return (
    <Field label={label} error={error}>
      {(a11y) => (
        <input
          {...a11y}
          type={type}
          step={step}
          min={min}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  error?: string
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  error,
}: SelectFieldProps<T>) {
  return (
    <Field label={label} error={error}>
      {(a11y) => (
        <select {...a11y} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}
