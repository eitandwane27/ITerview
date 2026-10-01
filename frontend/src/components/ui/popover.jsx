// Adapted from shadcn/ui's Radix Popover. The portal escapes landing-page transforms.
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { clsx } from 'clsx';
import './ui.css';

export function Popover(props) {
  return <PopoverPrimitive.Root {...props} />;
}

export function PopoverTrigger(props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

export function PopoverClose(props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

export function PopoverContent({ className, align = 'center', sideOffset = 4, ...props }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={clsx('ui-popover-content', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
