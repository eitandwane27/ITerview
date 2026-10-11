const { BEHAVIORAL_QUESTION_ANGLES } = require('../config/behavioralQuestionAngles');

// Bounded, process-local practice variety. No student data or database reads.
// Each worker owns its own cycle; restarting resets it. This is not permanent
// per-student history and cannot guarantee unlimited semantic uniqueness.
function createBehavioralQuestionVariety(random = Math.random) {
  const states = new Map();
  return {
    select(index) {
      let state = states.get(index);
      if (!state) {
        state = { remaining: [], lastAngleId: null, recentQuestions: [] };
        states.set(index, state);
      }
      if (state.remaining.length === 0) {
        state.remaining = [...BEHAVIORAL_QUESTION_ANGLES[index]];
        for (let i = state.remaining.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [state.remaining[i], state.remaining[j]] = [state.remaining[j], state.remaining[i]];
        }
        // Avoid the same angle at the boundary between cycles.
        if (state.remaining[0].id === state.lastAngleId) {
          [state.remaining[0], state.remaining[1]] = [state.remaining[1], state.remaining[0]];
        }
      }
      const angle = state.remaining.shift();
      state.lastAngleId = angle.id;
      return { angle, recentQuestions: [...state.recentQuestions] };
    },
    remember(index, question) {
      const state = states.get(index);
      if (!state) return;
      state.recentQuestions.push(question);
      if (state.recentQuestions.length > 8) state.recentQuestions.shift();
    },
  };
}

const behavioralQuestionVariety = createBehavioralQuestionVariety();
module.exports = { createBehavioralQuestionVariety, behavioralQuestionVariety };
