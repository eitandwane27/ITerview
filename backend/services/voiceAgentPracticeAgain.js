const ACTIONS = ['filter', 'show_tip', 'next_question', 'open_practice', 'close_dialog', 'start'];
const PRACTICE_ACTION_FUNCTION = {
  name: 'operate_practice_again',
  description: 'Open Practice Again and visibly operate its existing controls. Optional role (exact available label or id, or all), search and set change only requested filters. action defaults to filter; show_tip selects a question and expands its tip; next_question cycles the filtered list; open_practice opens the tip dialog; close_dialog dismisses it; start opens that dialog and starts one-question voice practice, handing off the microphone. question is exact question text or a unique literal phrase, never an id, selector or URL. Ask which question when several match. Without question, open_practice/start require an already open dialog. Use start only when the student explicitly asks to begin. Reading or discussing a question is not permission to start. Close an open dialog before changing filters or selecting another question. Does not remove/restore saved questions, change grades, generate questions or bypass setup. Wait for acknowledged outcome. Speaking or Stop interrupts remaining actions; earlier filter changes may remain. Never retry a start automatically.',
  defer_until_eot: true,
  parameters: { type: 'object', additionalProperties: false, properties: {
    role: { type: 'string', maxLength: 100 },
    search: { type: 'string', maxLength: 200, description: 'Literal search text. Empty string clears the search.' },
    set: { type: 'string', enum: ['all', '1', '2', '3'] },
    question: { type: 'string', maxLength: 1000, description: 'Exact displayed question text or a unique literal phrase. Never guess between matches.' },
    action: { type: 'string', enum: ACTIONS },
  } },
};

function validatePracticeArguments(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['role', 'search', 'set', 'question', 'action'].includes(key)) ||
      ['role', 'search', 'question'].some(key => input[key] !== undefined &&
        (typeof input[key] !== 'string' || input[key].length > ({ role: 100, search: 200, question: 1000 })[key] ||
          /[\u0000-\u001f\u007f]/.test(input[key]) || (key !== 'search' && !input[key].trim()))) ||
      (input.set !== undefined && !['all', '1', '2', '3'].includes(input.set)) ||
      (input.action !== undefined && !ACTIONS.includes(input.action))) throw new Error('Invalid Practice Again request.');
  const action = input.action || 'filter';
  if ((['close_dialog', 'next_question'].includes(action) && Object.keys(input).some(key => key !== 'action')) ||
      (['filter'].includes(action) && input.question !== undefined) ||
      (action === 'show_tip' && input.question === undefined)) throw new Error('Invalid Practice Again action options.');
  return { ...input, action };
}

module.exports = { PRACTICE_ACTION_FUNCTION, validatePracticeArguments };
