const NEXT_QUESTION_TRANSITIONS = Object.freeze([
  "Alright, let's try another one.",
  "Okay, here's your next question.",
  "Let's keep going.",
  "Now, let's move on to this one.",
]);

// Keep variety local to this connection without changing saved coaching feedback.
function createNextQuestionTransition() {
  let previous = '';
  return () => {
    const choices = NEXT_QUESTION_TRANSITIONS.filter(text => text !== previous);
    previous = choices[Math.floor(Math.random() * choices.length)];
    return previous;
  };
}

module.exports = { NEXT_QUESTION_TRANSITIONS, createNextQuestionTransition };
