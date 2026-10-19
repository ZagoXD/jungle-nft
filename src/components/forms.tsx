import { useId, useState, type ComponentProps, type ReactNode } from 'react'

export function Field({
  label,
  error,
  children,
  id: givenId,
  required,
  hiddenLabel = false,
  ens = false,
  ...props
}: ComponentProps<'input'> & {
  label: string
  error?: string
  children?: ReactNode
  hiddenLabel?: boolean
  ens?: boolean
}) {
  const generated = useId(),
    id = givenId ?? generated,
    [visible, setVisible] = useState(false)
  const password = props.type === 'password'
  return (
    <div className={`field ${hiddenLabel ? 'field-hidden-label' : ''}`}>
      <label htmlFor={id} className={hiddenLabel ? 'sr-only' : undefined}>
        {label}
        {required && (
          <span aria-hidden="true" className="required">
            *
          </span>
        )}
      </label>
      {children ?? (
        <div className={password ? 'password-input' : ens ? 'ens-input' : undefined}>
          {ens && (
            <select aria-label={`Domínio de ${label}`} defaultValue=".eth">
              <option>.eth</option>
            </select>
          )}
          <input
            {...props}
            id={id}
            aria-label={label}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : props['aria-describedby']}
            type={password && visible ? 'text' : props.type}
            {...(ens
              ? {
                  value: String(props.value ?? '').replace(/\.eth$/, ''),
                  onBlur: (event) => {
                    const value = event.target.value.replace(/\.eth$/, '')
                    props.onBlur?.({
                      ...event,
                      target: {
                        ...event.target,
                        name: props.name ?? '',
                        value: value ? `${value}.eth` : '',
                      },
                    })
                  },
                  onChange: (event) => {
                    const value = event.target.value.replace(/\.eth$/, '')
                    props.onChange?.({
                      ...event,
                      target: {
                        ...event.target,
                        name: props.name ?? '',
                        value: value ? `${value}.eth` : '',
                      },
                    })
                  },
                }
              : {})}
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
