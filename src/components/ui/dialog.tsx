import { useRef, type ReactNode } from 'react'
import { Dialog as Primitive } from 'radix-ui'
import { Button } from './button'

// shadcn/ui Dialog structure: Radix supplies focus trap, Escape and focus return.
export function Dialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
  className = '',
  returnFocusId,
}: {
  trigger?: ReactNode
  title: string
  description?: string
  children: ReactNode
  open?: boolean
  onOpenChange?: (value: boolean) => void
  className?: string
  returnFocusId?: string
}) {
  const returnFocus = useRef<HTMLElement | null>(null)
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>}
      <Primitive.Portal>
        <Primitive.Overlay
          className={`dialog-overlay ${className ? `${className}-overlay` : ''}`}
        />
        <Primitive.Content
          className={`dialog-content ${className}`}
          onInteractOutside={(event) => {
            if ((event.detail.originalEvent.target as HTMLElement)?.closest('.toast'))
              event.preventDefault()
          }}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement
          }}
          onCloseAutoFocus={(event) => {
            const target =
              (returnFocusId && document.getElementById(returnFocusId)) ||
              (returnFocus.current?.isConnected
                ? returnFocus.current
                : document.getElementById('conteudo'))
            if (target) {
              event.preventDefault()
              target.focus({ preventScroll: true })
            }
          }}
        >
          <Primitive.Title className="dialog-title">{title}</Primitive.Title>
          <Primitive.Description className={description ? 'muted' : 'sr-only'}>
            {description ?? title}
          </Primitive.Description>
          {children}
          <Primitive.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="dialog-close"
              aria-label="Fechar diálogo"
            >
              ×
            </Button>
          </Primitive.Close>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
