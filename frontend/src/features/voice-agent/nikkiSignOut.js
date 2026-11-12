// Follow the existing confirmation flow after both server speech and local PCM
// playback finish. This runner never invokes Firebase or clears saved work.
export async function runSignOut({ isSpeechFinished, openDashboard, route, click, wait, signal, status, beforeConfirm }) {
  status('Finishing the goodbye before signing out…');
  await wait(isSpeechFinished, signal, 60_000);
  signal.throwIfAborted();
  openDashboard();
  await wait(() => route() === '/dashboard' && document.querySelector('.db-root'), signal);
  const review = document.querySelector('.pa-dialog[open]');
  if (review) {
    status('Closing your practice tip…');
    await click(review.querySelector('.pa-dialog__header button'));
    await wait(() => !document.querySelector('.pa-dialog[open]'), signal);
  }
  if (document.querySelector('dialog[open]:not(.db-signout-modal), .sb-overlay')) {
    throw new Error('Close the current dialog before asking Nikki to sign out.');
  }
  if (!document.querySelector('.db-signout-modal[open]')) {
    status('Selecting Sign Out…');
    const button = [...document.querySelectorAll('button[aria-label="Sign Out"]')]
      .find(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0);
    await click(button);
  }
  const dialog = await wait(() => document.querySelector('.db-signout-modal[open]'), signal);
  if (dialog.getAttribute('aria-busy') === 'true') throw new Error('Sign-out is already in progress.');
  status('Confirming your requested sign-out…');
  await click(dialog.querySelector('.db-signout-modal__button--confirm'), undefined, beforeConfirm);
  await wait(() => route() !== '/dashboard' || dialog.querySelector('.db-signout-modal__error'), signal, 20_000);
  if (route() === '/dashboard') throw new Error('Sign-out failed. You are still signed in; use the dialog to try again when ready.');
  return { outcome: 'signed_out' };
}
