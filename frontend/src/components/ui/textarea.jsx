import { clsx } from 'clsx';
import './ui.css';

export function Textarea({ className, ...props }) {
  return <textarea data-slot="textarea" className={clsx('ui-textarea', className)} {...props} />;
}
