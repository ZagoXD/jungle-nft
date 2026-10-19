import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

// shadcn/ui Button composition, adapted to the KURIO design tokens.
const buttonVariants = cva(
  'button inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: { default: 'button-primary', outline: 'button-outline', ghost: 'button-ghost' },
      size: { default: '', sm: 'button-small', icon: 'button-icon' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
