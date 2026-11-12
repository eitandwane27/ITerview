// This runner accepts semantic values, never model-provided selectors or URLs.
export async function runInterviewPrep({ options, read, click, wait, signal, beforeHandoff, status, route }) {
  const initial = await wait(() => {
    const page = read();
    return page.page === 'interview_prep' && page.state !== 'loading' && page.rolesStatus !== 'loading' && page;
  }, signal);
  const fail = message => { throw new Error(message); };
  if (!['ready', 'onboarding'].includes(initial.state)) fail('Interview Prep could not load. Use its retry control first.');
  if (initial.modal && initial.modal !== 'briefing') fail('Close the current dialog before configuring Interview Prep.');
  const normalize = value => String(value).trim().toLocaleLowerCase();
  const choices = [];
  // Validate the entire request before changing any selection.
  for (const key of ['role', 'difficulty', 'focus']) {
    if (options[key] === undefined) continue;
    const field = initial[key];
    if (!field?.visible) fail(`${key} is not available in this setup stage.`);
    const matches = field.options.filter(item => normalize(item.value) === normalize(options[key]) || normalize(item.label) === normalize(options[key]));
    if (matches.length !== 1 || matches[0].disabled) fail(`The requested ${key} is unavailable or locked.`);
    if (field.value === matches[0].value && (field.disabled || initial.modal)) continue;
    if (field.disabled) fail(`The ${key} setting is locked. Saved work will not be discarded.`);
    choices.push({ key, value: matches[0].value });
  }
  if (options.action === 'resume' && !initial.session?.active && !initial.session?.resumable) fail('There is no saved session to resume.');
  if (options.action === 'start' && initial.session?.active) fail('A saved session is active. Ask to resume it; changing settings would require discarding work.');
  if (initial.modal === 'briefing' && choices.length) {
    status('Closing the briefing to update your setup…');
    await click(document.querySelector('.sb-close-btn'));
    await wait(() => read().modal === null, signal);
  }
  for (const { key, value } of choices) {
    status(`Selecting ${key}…`);
    await click(document.getElementById(`${key}-select`));
    const menu = await wait(() => {
      const trigger = document.getElementById(`${key}-select`);
      return trigger?.getAttribute('aria-expanded') === 'true' && document.getElementById(trigger.getAttribute('aria-controls'));
    }, signal);
    const option = [...menu.querySelectorAll('[role="option"]')].find(item => item.dataset.value === value);
    await click(option);
    await wait(() => read()[key]?.value === value, signal);
  }
  if (options.action === 'configure') return { outcome: 'configured' };
  let page = read();
  if (!page.modal) {
    if (page.start?.disabled) fail('Select an available role before starting.');
    status(page.start.label);
    beforeHandoff();
    await click(document.getElementById('btn-start-pretest'));
    await wait(() => route() !== '/dashboard' || read().modal === 'briefing' || read().errorMessage, signal, 20_000);
    if (route() !== '/dashboard') return { handoff: true };
    page = read();
    if (page.errorMessage) fail(page.errorMessage);
  }
  const briefing = await wait(() => read().briefing, signal);
  if (briefing.mode === 'drill') fail('This is a separate focus drill. Close it to start the main interview flow.');
  if (briefing.state === 'error') fail(briefing.errorMessage || 'The briefing could not prepare this session.');
  // STAR is not a selectable 3C briefing focus; never silently replace it.
  if (options.focus && options.focus !== 'auto' && briefing.focus !== options.focus) fail('The briefing does not support the requested focus. Review its focus choices.');
  await wait(() => {
    const current = read().briefing;
    if (!current) fail('The briefing was closed.');
    if (current.state === 'error') fail(current.errorMessage || 'The briefing could not load.');
    return current.state !== 'loading' && (!current.disabled || current.state === 'preparing');
  }, signal, 15_000);
  page = read();
  const preparingTitle = 'Preparing interview…';
  if (page.briefing?.state === 'idle') {
    status('Preparing your interview questions…', preparingTitle);
    await click(document.getElementById('btn-confirm-launch-practice'));
  }
  status('Waiting for your interview to be ready…', preparingTitle);
  await wait(() => {
    const current = read();
    if (!current.briefing) fail('The briefing was closed.');
    if (current.briefing.state === 'error') fail(current.briefing.errorMessage || 'Question preparation failed.');
    return current.briefing.state === 'ready' && !current.briefing.disabled;
  }, signal, 300_000);
  status('Entering your interview. Releasing Nikki’s microphone…');
  beforeHandoff();
  await click(document.getElementById('btn-confirm-launch-practice'));
  await wait(() => route() !== '/dashboard' || read().errorMessage, signal, 20_000);
  if (route() === '/dashboard') fail(read().errorMessage || 'The interview could not be opened.');
  return { handoff: true };
}
