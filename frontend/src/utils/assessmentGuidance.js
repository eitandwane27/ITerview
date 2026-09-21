export const PRACTICE_FOCUS = {
  clarity: {
    label: 'Clarity',
    starting: "Let's practise explaining your answers more clearly.",
    next: 'Practise explaining one idea at a time, then add a short example.',
  },
  correctness: {
    label: 'Correctness',
    starting: "Let's practise giving accurate technical explanations.",
    next: 'Practise explaining a technical concept and checking the key facts.',
  },
  completeness: {
    label: 'Completeness',
    starting: "Let's practise covering the important parts of each answer.",
    next: 'Practise answering every part of a question, then add an example or outcome.',
  },
};

export const isValidScore = (value) => typeof value === 'number' && Number.isFinite(value);

export function getPracticeFocus(tag) {
  const key = typeof tag === 'string' ? tag.toLowerCase().replace(/^focus_/, '') : '';
  return PRACTICE_FOCUS[key] ? { key, ...PRACTICE_FOCUS[key] } : null;
}

export function getScoreComparison(before, after) {
  if (!isValidScore(before) || !isValidScore(after)) return null;
  const delta = Math.round((after - before) * 10) / 10;
  return {
    delta,
    label: `${delta > 0 ? '+' : ''}${delta} ${Math.abs(delta) === 1 ? 'point' : 'points'}`,
    heading:
      delta > 0
        ? 'Your answers scored higher'
        : delta < 0
          ? 'Your score was lower this time'
          : 'Your score stayed the same',
    description:
      delta > 0
        ? 'Your progress-check answers scored higher than your starting answers.'
        : delta < 0
          ? 'This attempt scored below your starting answers. Use the feedback to choose what to practise next.'
          : 'Both attempts received the same overall score. Your answer feedback can still show what changed.',
  };
}

export function averageThreeCs(questions = []) {
  return Object.fromEntries(
    Object.keys(PRACTICE_FOCUS).map((key) => {
      const values = questions.map((question) => question.metrics?.[key]).filter(isValidScore);
      return [
        key,
        values.length
          ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
          : null,
      ];
    })
  );
}

export function lowestThreeC(scores) {
  return (
    Object.entries(scores)
      .filter(([, value]) => isValidScore(value))
      .sort(([, left], [, right]) => left - right)[0]?.[0] || null
  );
}
