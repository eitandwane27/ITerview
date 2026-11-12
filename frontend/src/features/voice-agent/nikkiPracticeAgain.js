const normalize = value => String(value).trim().toLocaleLowerCase();

// Semantic values only. Selectors stay local, and question identity never crosses
// into the model: a unique phrase must resolve against the current rendered list.
export async function runPracticeAgain({ options, read, click, wait, signal, status, beforeHandoff, route }) {
  const fail = message => { throw new Error(message); };
  const page = await wait(() => {
    const current = read();
    return current.page === 'practice_again' && current.state !== 'loading' && current;
  }, signal);
  const panel = document.getElementById('tabpanel-practice-again');
  const find = selector => panel?.querySelector(selector);
  // Filtered rows exit asynchronously. Let them leave before scrolling to the
  // next control; otherwise scroll anchoring can move a mobile target mid-flight.
  const settleQuestions = () => wait(() => panel.querySelectorAll('.pa-question__select').length === read().displayedQuestions, signal);
  if ([...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')].some(dialog => !dialog.matches('.pa-dialog'))) fail('Close the current dialog before operating Practice Again.');
  if (page.updating) fail('A saved-question update is in progress. Wait for it to finish.');
  if (options.action === 'close_dialog') {
    if (!page.dialog) fail('There is no practice dialog to close.');
    status('Closing the practice dialog…');
    await click(find('.pa-dialog__header button'));
    await wait(() => !read().dialog && !find('.pa-dialog[open]'), signal);
    return { outcome: 'dialog_closed' };
  }
  if (page.state === 'error') fail('Saved questions could not load. Use Try again before requesting an action.');
  if (page.state === 'empty') fail('There are no saved questions yet. Save a question during an interview first.');
  if (!['ready', 'no_matches'].includes(page.state)) fail('Practice Again is unavailable.');
  if (page.dialog && (['role', 'search', 'set'].some(key => options[key] !== undefined) || !['start', 'open_practice'].includes(options.action))) fail('Close the practice dialog before changing filters or selecting another question.');

  // Prevalidate the role before applying any filter, so invalid requests do not
  // silently clear a search or select a different role.
  const roleControl = find('select[aria-label="Filter saved questions by role"]');
  let role;
  if (options.role !== undefined) {
    const matches = [...roleControl.options].filter(option => normalize(option.value) === normalize(options.role) ||
      normalize(option.textContent.replace(/ \(\d+\)$/, '')) === normalize(options.role));
    if (matches.length !== 1 || matches[0].disabled) fail('The requested saved-question role is unavailable or ambiguous.');
    role = matches[0].value;
  }
  if (role !== undefined && roleControl.value !== role) {
    status('Selecting the saved-question role…');
    await click(roleControl, role);
    await wait(() => roleControl.value === role, signal);
    await settleQuestions();
  }
  const search = find('input[type="search"]');
  if (options.search !== undefined && search.value !== options.search) {
    status('Searching your saved questions…');
    await click(search, options.search);
    await wait(() => read().filters?.search === options.search, signal);
    await settleQuestions();
  }
  if (options.set !== undefined) {
    const set = find(`[data-practice-set="${options.set}"]`);
    if (set?.getAttribute('aria-pressed') !== 'true') {
      status(options.set === 'all' ? 'Showing all interview sets…' : `Selecting Set ${options.set}…`);
      await click(set);
      await wait(() => set.getAttribute('aria-pressed') === 'true', signal);
      await settleQuestions();
    }
  }
  if (options.action === 'filter') return { outcome: 'filtered' };
  await settleQuestions();
  if (options.action === 'next_question') {
    if (read().displayedQuestions < 2) fail('There is no other question in the current filtered list.');
    if (!read().tipPanel?.contentVisible) {
      status('Expanding your question tip…');
      await click(find('.pa-focus__toggle'));
    }
    const previous = find('.pa-question__select[aria-pressed="true"]');
    status('Showing the next saved question…');
    await click(find('.pa-next-button'));
    await wait(() => previous?.getAttribute('aria-pressed') === 'false', signal);
    return { outcome: 'tip_shown' };
  }
  let row;
  if (options.question !== undefined) {
    const query = normalize(options.question);
    const questions = [...panel.querySelectorAll('.pa-question__select')];
    // Match all rendered questions, including those beyond the context excerpt.
    const exact = questions.filter(button => normalize(button.textContent) === query);
    const matches = exact.length ? exact : questions.filter(button => normalize(button.textContent).includes(query));
    if (matches.length !== 1) fail(matches.length ? 'Several saved questions match. Ask which question the student means.' : 'No question matches in the current filters. Ask for a different question or filter.');
    row = matches[0].closest('.pa-question');
    if (page.dialog && normalize(page.dialog.text) !== normalize(matches[0].textContent)) fail('A different question is open. Close that dialog before selecting another question.');
  } else if (!page.dialog) fail('Choose a saved question first. Read the page and ask which question the student means.');
  if (options.action === 'show_tip') {
    status('Showing your question and its tip…');
    await click(row.querySelector('.pa-question__select'));
    await wait(() => read().tipPanel?.contentVisible && row.querySelector('.pa-question__select')?.getAttribute('aria-pressed') === 'true', signal);
    return { outcome: 'tip_shown' };
  }
  if (!read().dialog) {
    status('Opening your practice tip…');
    await click(row.querySelector('.pa-row-practice'));
    await wait(() => read().dialog && find('.pa-dialog[open]'), signal);
  }
  if (options.action === 'open_practice') return { outcome: 'dialog_opened' };
  if (options.action !== 'start') fail('This Practice Again action is unavailable.');
  status('Starting one-question practice. Releasing Nikki’s microphone…');
  beforeHandoff();
  await click(find('.pa-dialog__action button'));
  await wait(() => route() !== '/dashboard', signal);
  return { handoff: true };
}
