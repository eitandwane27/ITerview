// shadcn/ui's Radix composition and variant API, styled with the project's CSS.
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import './ui.css';

const buttonVariants = cva('ui-button', {
  variants: {
    variant: {
      default: 'ui-button--primary',
      outline: 'ui-button--outline',
      ghost: 'ui-button--ghost',
    },
    size: { default: 'ui-button--default', icon: 'ui-button--icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...(!asChild && { type: 'button' })}
      {...props}
    />
  );
}
