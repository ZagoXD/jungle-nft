import { useId, useState, type ComponentProps, type ReactNode } from 'react'

export function Field({
  label,
  error,
  children,
  id: givenId,
  required,
  ...props
}: ComponentProps<'input'> & { label: string; error?: string; children?: ReactNode }) {
  const generated = useId(),
    id = givenId ?? generated,
    [visible, setVisible] = useState(false)
  const password = props.type === 'password'
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="required">
            *
          </span>
        )}
      </label>
      {children ?? (
        <div className={password ? 'password-input' : undefined}>
          <input
            {...props}
            id={id}
            aria-label={label}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : props['aria-describedby']}
            type={password && visible ? 'text' : props.type}
          />
          {password && (
            <button
              type="button"
              aria-label={
                visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`
              }
              aria-pressed={visible}
              onClick={() => setVisible((value) => !value)}
            >
              <img src="/images/vectors/iconly-curved-hide-99.svg" alt="" width="23" height="20" />
            </button>
          )}
        </div>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
