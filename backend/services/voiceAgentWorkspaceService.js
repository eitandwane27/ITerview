const { getRoleCatalogue } = require('./chatbotKnowledgeService');
const { containsSensitiveContent, isInstructionOverride } = require('./chatbotGuardrails');

const SECTIONS = { preTest: 'Starting check', set1: 'Set 1 · Foundations', set2: 'Set 2 · Technical', set3: 'Set 3 · Behavioral', postTest: 'Progress check' };
const FOCUS = ['clarity', 'correctness', 'completeness', 'star'];

const WORKSPACE_FUNCTION = {
  name: 'show_workspace',
  description: 'Display saved scores, feedback, two comparable attempts, a STAR draft, or a suggested drill beside Nikki. Interpret natural requests, not just the words "show me". Call only after the view and relevant assessment, role and comparison difficulty are clear from the student or established conversation context. Ask one short spoken clarification first when needed. Never invent grades. If the result needsClarification, ask its question and wait for the student; nothing was displayed.',
  defer_until_eot: true,
  parameters: {
    type: 'object',
    properties: {
      view: { type: 'string', enum: ['scores', 'feedback', 'comparison', 'star', 'drill', 'dismiss'] },
      section: { type: 'string', enum: Object.keys(SECTIONS), description: 'Required for scores and feedback. Written feedback is only available for practice set1, set2 and set3. Pre-test and post-test have scores only; use the scores view for them. Resolve from the request or established conversation context. No default; ask which assessment if unclear.' },
      role: { type: 'string', description: 'Exact catalogue role ID resolved from the request or established context. "My selected role" means the snapshot role. If multiple saved roles are possible and none is established, ask which. Pre-test and post-test are account assessments and need no role.' },
      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'For comparison: difficulty established by the student or conversation. Ask which if multiple saved difficulty levels are possible. Do not silently choose the latest difficulty.' },
      focus: { type: 'string', enum: FOCUS, description: 'Requested practice focus, or the known saved weakness for the selected role. If neither is available, ask rather than defaulting to completeness.' },
      outline: {
        type: 'object', additionalProperties: false,
        description: 'Only for star: a concise draft from facts the student actually shared in this conversation. Omit unknown parts; never invent projects, actions, numbers or outcomes.',
        properties: { situation: { type: 'string', maxLength: 350 }, task: { type: 'string', maxLength: 350 }, action: { type: 'string', maxLength: 350 }, result: { type: 'string', maxLength: 350 } },
      },
    },
    required: ['view'], additionalProperties: false,
  },
};

function safeDraft(value) {
  if (typeof value !== 'string' || containsSensitiveContent(value) || isInstructionOverride(value)) return '';
  return value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 350);
}

function clarification(field, question, choices) {
  return {
    needsClarification: true, missingField: field, question, choices,
    instruction: 'Nothing was displayed. Ask this one question naturally, wait for the student to answer, then call show_workspace with the resolved request. Do not guess or change the previous workspace.',
  };
}

function buildVoiceWorkspace(input, progress) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid workspace request.');
  const { section } = input;
  const scoresOnly = ['preTest', 'postTest'].includes(section);
  const feedbackRedirected = input.view === 'feedback' && scoresOnly;
  const view = feedbackRedirected ? 'scores' : input.view;
  if (!WORKSPACE_FUNCTION.parameters.properties.view.enum.includes(view) || (section !== undefined && !Object.hasOwn(SECTIONS, section))) {
    throw new Error('That workspace view is unavailable.');
  }
  if (view === 'dismiss') return null;
  if (input.focus !== undefined && !FOCUS.includes(input.focus)) throw new Error('That practice focus is unavailable.');
  if (input.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(input.difficulty)) throw new Error('That difficulty is unavailable.');
  const catalogue = getRoleCatalogue();
  if (input.role !== undefined && !catalogue.some(item => item.id === input.role)) throw new Error('That practice role is unavailable.');
  const availableRoles = [...new Set([
    progress?.role,
    ...Object.values(progress?.assessments || {}).map(item => item.role),
    ...(progress?.recentAttempts || []).map(item => item.role),
  ])].filter(id => catalogue.some(item => item.id === id));
  const roleId = input.role || (availableRoles.length === 1 ? availableRoles[0] : progress?.role);
  const role = catalogue.find(item => item.id === roleId);
  const base = { view, role: role?.label || 'Your practice', roleId: role?.id || null, fetchedAt: progress?.fetchedAt || null,
    ...(['scores', 'feedback'].includes(view) && section ? { section } : {}),
  };

  if (view === 'star') {
    const outline = input.outline || {};
    if (typeof outline !== 'object' || Array.isArray(outline)) throw new Error('Invalid STAR outline.');
    return { ...base, title: 'Give your story a shape', subtitle: 'STAR · Situation, Task, Action, Result',
      source: 'Conversation draft · not graded',
      steps: ['situation', 'task', 'action', 'result'].map(key => ({ key, text: safeDraft(outline[key]) })),
    };
  }

  if (!progress) return { ...base, title: 'Your progress isn’t available yet', subtitle: 'We can still talk it through.',
    empty: 'Start another conversation with Nikki to reload your saved results, or check your dashboard. Your saved progress stays unchanged.', source: 'Saved progress unavailable' };
  if (progress.hasAssessmentData === false && ['scores', 'feedback', 'comparison'].includes(view)) return {
    ...base, title: 'No saved results yet', subtitle: 'We can still work through an example together.',
    empty: scoresOnly
      ? 'No completed research assessment is available yet. Continue your assessment journey from the dashboard; any saved assessment answers are kept.'
      : 'No saved result is available yet. Complete some practice, then start another conversation with Nikki to refresh this view.', source: 'No saved assessment',
  };

  if (['scores', 'feedback'].includes(view) && !section) {
    if (view === 'feedback') return clarification('section', 'Which practice set would you like feedback on: Set 1, Set 2, or Set 3?', Object.entries(SECTIONS).filter(([key]) => ['set1', 'set2', 'set3'].includes(key)).map(([value, label]) => ({ value, label })));
    return clarification('section', 'Which assessment would you like to see: your pre-test, a practice set, or your post-test?', Object.entries(SECTIONS).map(([value, label]) => ({ value, label })));
  }
  const accountAssessment = ['scores', 'feedback'].includes(view) && ['preTest', 'postTest'].includes(section);
  if (!accountAssessment && !input.role && availableRoles.length !== 1) {
    const choices = (availableRoles.length ? catalogue.filter(item => availableRoles.includes(item.id)) : catalogue).map(item => ({ value: item.id, label: item.label }));
    return clarification('role', 'Which practice role would you like to use?', choices);
  }

  const attempts = (progress.recentAttempts || []).filter(item => item.role === roleId);
  const latest = attempts.at(-1);
  if (view === 'comparison') {
    const difficulties = [...new Set(attempts.map(item => item.difficulty).filter(Boolean))];
    if (!input.difficulty && difficulties.length > 1) return clarification('difficulty', `Which saved difficulty would you like to compare: ${difficulties.join(' or ')}?`, difficulties.map(value => ({ value, label: value })));
    const difficulty = input.difficulty || difficulties[0];
    const comparable = attempts.filter(item => item.difficulty && item.difficulty === difficulty).slice(-2);
    const valid = comparable.length === 2 && comparable.every(item => typeof item.scorePercentage === 'number');
    return { ...base, difficulty: difficulty || null, title: 'Two attempts. One perspective.', subtitle: `${role?.label || 'Your role'} · ${difficulty || 'difficulty unavailable'}`,
      source: 'Two latest retained attempts at the same role and difficulty',
      ...(valid ? { attempts: comparable, change: Number((comparable[1].scorePercentage - comparable[0].scorePercentage).toFixed(1)) }
        : { empty: 'There aren’t two saved attempts at the same role and difficulty in your five recent attempts yet.' }),
    };
  }

  const requestedFocus = input.focus || (roleId === progress.role && FOCUS.includes(progress.weakestMetric) ? progress.weakestMetric : null);
  if (view === 'drill') {
    if (!requestedFocus) return clarification('focus', 'What would you like to practise: clarity, correctness, completeness, or storytelling?', FOCUS.map(value => ({ value, label: value === 'star' ? 'Storytelling' : value })));
    const advice = {
      clarity: ['Lead with the main idea.', 'Explain it in two or three steps.', 'Finish with one concrete example.'],
      correctness: ['State the concept precisely.', 'Explain why it works.', 'Check one edge case or limitation.'],
      completeness: ['Answer the question directly.', 'Explain how or why.', 'Add an example and a trade-off.'],
      star: ['Set the scene briefly.', 'Describe what you personally did.', 'Explain the outcome honestly.'],
    };
    return { ...base, title: `A little practice in ${requestedFocus === 'star' ? 'storytelling' : requestedFocus}`,
      subtitle: 'One focused rehearsal', source: 'Practice suggestion · does not change your grades',
      focus: requestedFocus, checklist: advice[requestedFocus],
      // Route selection is application-owned; the LLM cannot supply navigation URLs.
      practiceUrl: roleId === progress.role ? `/interview?set=1&mode=drill&focusArea=${requestedFocus}` : null,
    };
  }

  const assessment = progress.assessments?.[section];
  const matching = assessment && (assessment.role === roleId || ['preTest', 'postTest'].includes(section));
  const setScore = latest?.setScores?.[section];
  const hasArchivedScore = typeof setScore === 'number' && setScore >= 1 && setScore <= 5;
  const percentage = matching ? assessment.scorePercentage : null;
  const useCurrent = matching && (typeof percentage === 'number' || assessment.questions?.length > 0);
  const source = useCurrent ? 'Saved assessment at voice-session start' : hasArchivedScore ? `Completed attempt ${latest?.attemptNumber || ''}`.trim() : 'No saved assessment';
  const questions = useCurrent ? assessment.questions || [] : [];
  return { ...base, title: SECTIONS[section], subtitle: scoresOnly ? 'One-time research assessment' : `${role?.label || 'Your role'} · ${useCurrent ? assessment.difficulty || 'difficulty unavailable' : latest?.difficulty || 'difficulty unavailable'}`,
    section, difficulty: ['preTest', 'postTest'].includes(section) ? null : useCurrent ? assessment.difficulty || null : hasArchivedScore ? latest?.difficulty || null : null,
    attemptNumber: !useCurrent && hasArchivedScore ? latest?.attemptNumber || null : null,
    sourceKind: useCurrent ? 'assessment' : hasArchivedScore ? 'archived-attempt' : 'unavailable',
    source, scorePercentage: useCurrent ? percentage : hasArchivedScore ? Number((setScore * 20).toFixed(1)) : null,
    metrics: useCurrent ? assessment.metrics || {} : {},
    ...(feedbackRedirected ? { note: 'Written feedback is available for practice Sets 1–3. This assessment includes scores only.' } : {}),
    questions: view === 'feedback' ? questions : [],
    ...(!useCurrent && !hasArchivedScore ? { empty: scoresOnly
      ? 'No completed result for this research assessment yet. Continue your assessment journey from the dashboard; any saved assessment answers are kept.'
      : 'No saved result for this assessment and role yet. Complete some practice, then start another conversation with Nikki to refresh this view.' }
      : view === 'feedback' && questions.length === 0 ? { note: 'This archived attempt has a score summary. Detailed question feedback is not retained here.' } : {}),
  };
}

module.exports = { WORKSPACE_FUNCTION, buildVoiceWorkspace };
