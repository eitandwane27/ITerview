const PREP_FUNCTION = {
  name: 'configure_interview_prep',
  description: 'Open Interview Prep and visibly operate its real controls. Supply only settings the student requested; omitted settings stay unchanged. role accepts an exact current catalogue id or display label. action configure changes settings only; start follows the existing setup/briefing/Enter Studio flow and hands the microphone to the interview; resume continues saved work. Use start only when explicitly requested, not merely when discussing practice. Cannot unlock difficulty, discard work, answer surveys, or bypass setup. A start request authorizes preparation and entry without repeated confirmation. Wait for the result; failures may leave already completed selections in place. Speaking or Stop interrupts remaining actions.',
  defer_until_eot: true,
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      role: { type: 'string', maxLength: 100, description: 'Requested available role id or exact display label.' },
      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
      focus: { type: 'string', enum: ['auto', 'clarity', 'correctness', 'completeness', 'star'] },
      action: { type: 'string', enum: ['configure', 'start', 'resume'], description: 'Defaults to configure. Start or resume requires the student to ask for that action.' },
    },
  },
};

function validatePrepArguments(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['role', 'difficulty', 'focus', 'action'].includes(key)) ||
      (input.role !== undefined && (typeof input.role !== 'string' || !input.role.trim() || input.role.length > 100)) ||
      (input.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(input.difficulty)) ||
      (input.focus !== undefined && !['auto', 'clarity', 'correctness', 'completeness', 'star'].includes(input.focus)) ||
      (input.action !== undefined && !['configure', 'start', 'resume'].includes(input.action))) throw new Error('Invalid Interview Prep request.');
  return { ...input, action: input.action || 'configure' };
}

module.exports = { PREP_FUNCTION, validatePrepArguments };
