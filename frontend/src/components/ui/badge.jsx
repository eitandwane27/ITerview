import { cva } from 'class-variance-authority';
import './ui.css';

const badgeVariants = cva('ui-badge', {
  variants: {
    variant: { default: 'ui-badge--primary', secondary: 'ui-badge--secondary' },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }) {
  return <span data-slot="badge" className={badgeVariants({ variant, className })} {...props} />;
}
