// Destinations are fixed: the model never supplies a URL or DOM selector.
const INTERVIEW_PREP_FUNCTION = {
  name: 'open_interview_prep',
  description: 'Open the Interview Prep tab and return its current bounded page context, keeping Nikki connected. Use for interview tab or interview preparation navigation. Does not select settings, start, resume or discard a session. Use configure_interview_prep for explicitly requested setup and start actions.',
  defer_until_eot: true,
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};
const HISTORY_FUNCTION = {
  name: 'open_practice_history',
  description: 'Open the student’s existing Practice History tab on the Dashboard, keeping this voice conversation connected. Use when they ask to see their practice history, previous sessions, or the History tab. This navigates the app; it does not display a scores workspace or change saved data. Wait for the result before saying History is open.',
  defer_until_eot: true,
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

const PROGRESS_FUNCTION = {
  name: 'open_my_progress',
  description: 'Open the student’s existing My Progress tab on the Dashboard, keeping this voice conversation connected, and return its bounded current page context when available. Use for requests to open My Progress, go to the progress tab, or see progress on the Dashboard. General questions about scores or improvement do not by themselves request navigation. This does not refresh the saved progress snapshot, open the results page, expand Score details, start practice, finish a confidence check or change data. Wait for the result before saying My Progress is open. Respect loading/error states and read_current_page before later explanations.',
  defer_until_eot: true,
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

const PRACTICE_AGAIN_FUNCTION = {
  name: 'open_practice_again',
  description: 'Open the student’s existing Practice Again tab on the Dashboard, keeping this voice conversation connected. Use when they ask to open Practice Again, visit the saved questions tab, or see their saved practice questions. This opens the tab and returns its bounded current page context when available; it does not start or restart practice, choose a question, change saved data, or display a drill workspace. A general wish to practise again does not by itself request this tab. Wait for the result before saying Practice Again is open. Respect loading or unavailable context and use read_current_page for later questions about its contents.',
  defer_until_eot: true,
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

const AI_COACH_FUNCTION = {
  name: 'open_ai_coach',
  description: 'Open the student’s existing AI Coach tab on the Dashboard, keeping this voice conversation connected. Use for clear requests to open AI Coach, visit the coach tab, or go to the Dashboard’s text coach. General requests for coaching or help can be answered in this conversation and do not by themselves request navigation. This only opens the tab; it does not send or reset a coach chat, type a message, read the tab’s contents, start practice, or change saved data. Wait for the result before saying AI Coach is open.',
  defer_until_eot: true,
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

const PLAYGROUND_FUNCTION = {
  name: 'return_to_playground',
  description: 'Return to Nikki’s voice conversation Playground while keeping the current microphone, audio and conversation connected. Use for clear requests to return to Nikki, the Playground, or the conversation screen. Resolve an ambiguous "go back" from conversation context, or ask one short clarification before calling. This does not end or restart the conversation, restart practice, or navigate to arbitrary previous pages. Wait for the result before claiming success.',
  defer_until_eot: true,
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

const SIGN_OUT_FUNCTION = {
  name: 'sign_out',
  description: 'Queue sign-out through the existing Dashboard Sign Out and confirmation controls. For a requested goodbye followed by sign-out, call this tool FIRST with no spoken preamble or farewell. After its scheduled result, speak the requested farewell exactly once in one or two sentences, then end your turn. The browser waits for that speech and local playback before clicking anything. A clear goodbye-then-sign-out request authorizes both clicks without another confirmation question. Goodbye alone or ending the voice conversation does not authorize signing out. Speaking, Stop or Escape before the final click cancels the action. Never claim success in advance or retry automatically.',
  defer_until_eot: true,
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

// This reply releases Deepgram's pending tool turn. The farewell belongs only
// to the response AFTER this result; asking for one before the tool as well
// gives the model two opportunities to deliver the same closing message.
const SIGN_OUT_ACCEPTED_RESULT = Object.freeze({
  ok: true,
  outcome: 'scheduled',
  instruction: 'Sign-out is queued, NOT completed. Now deliver the requested farewell exactly once in one or two short spoken sentences, addressing the requested audience. This is the only farewell step. End your turn immediately after it. Do not repeat the message, add another goodbye, narrate the sign-out clicks, claim success, or call sign_out again. The browser waits for your finished audio and local playback, then clicks Sign Out and confirms. The student can stop the queued action before the final click.',
});

module.exports = { INTERVIEW_PREP_FUNCTION, HISTORY_FUNCTION, PROGRESS_FUNCTION, PRACTICE_AGAIN_FUNCTION, AI_COACH_FUNCTION, PLAYGROUND_FUNCTION, SIGN_OUT_FUNCTION, SIGN_OUT_ACCEPTED_RESULT };
