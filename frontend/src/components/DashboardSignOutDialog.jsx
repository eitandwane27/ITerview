import { useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, LogOut, X } from 'lucide-react';
import { NikkiOverlayContext } from '../features/voice-agent/nikkiPageContext';
import './DashboardSignOutDialog.css';

export default function DashboardSignOutDialog({ pending, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const hostCompanion = useContext(NikkiOverlayContext);
  const [closing, setClosing] = useState(false);
  const disabled = pending || closing;

  const dismiss = () => {
    if (!disabled) setClosing(true);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    hostCompanion?.(dialog);
    cancelRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      hostCompanion?.(null);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [hostCompanion]);

  return (
    <dialog
      ref={dialogRef}
      className="db-signout-modal"
      data-closing={closing || undefined}
      aria-labelledby="db-signout-title"
      aria-describedby="db-signout-description"
      aria-busy={pending || undefined}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!first || (event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'db-signout-exit') onCancel();
      }}
      onClick={(event) => {
        if (disabled || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
      }}
    >
      <div className="db-signout-modal__header">
        <LogOut className="db-signout-modal__icon" size={28} strokeWidth={1.8} aria-hidden="true" />
        <button type="button" className="db-signout-modal__close" aria-label="Close confirmation" disabled={disabled} onClick={dismiss}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="db-signout-modal__copy">
        <h2 id="db-signout-title">Sign out of ITerview?</h2>
        <p id="db-signout-description">
          Are you sure you want to sign out? You’ll return to the home page.
        </p>
      </div>
      {error && <p className="db-signout-modal__error" role="alert"><AlertCircle size={16} aria-hidden="true" />{error}</p>}
      <div className="db-signout-modal__footer">
        <button ref={cancelRef} type="button" className="db-signout-modal__button db-signout-modal__button--cancel" disabled={disabled} onClick={dismiss}>
          Cancel
        </button>
        <button type="button" className="db-signout-modal__button db-signout-modal__button--confirm" disabled={disabled} onClick={onConfirm}>
          {pending && <LoaderCircle className="db-signout-modal__spinner" size={16} aria-hidden="true" />}
          {pending ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </dialog>
  );
}
