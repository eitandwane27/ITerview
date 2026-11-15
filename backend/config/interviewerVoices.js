const DEFAULT_INTERVIEWER_VOICE = 'aura-2-luna-en';
const INTERVIEWER_VOICES = [
  'amalthea', 'andromeda', 'aries', 'asteria', 'athena', 'aurora', 'callista',
  'cordelia', 'delia', 'draco', 'electra', 'helena', 'hera', 'hermes', 'iris',
  'janus', 'juno', 'jupiter', 'luna', 'mars', 'minerva', 'neptune', 'odysseus',
  'saturn', 'thalia', 'zeus',
].map(name => `aura-2-${name}-en`);

function resolveInterviewerVoice(requested, saved) {
  if (INTERVIEWER_VOICES.includes(requested)) return requested;
  if (INTERVIEWER_VOICES.includes(saved)) return saved;
  return DEFAULT_INTERVIEWER_VOICE;
}

module.exports = { DEFAULT_INTERVIEWER_VOICE, INTERVIEWER_VOICES, resolveInterviewerVoice };
