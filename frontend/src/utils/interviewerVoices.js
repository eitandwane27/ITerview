export const DEFAULT_INTERVIEWER_VOICE = 'aura-2-luna-en';

// Match the expressed gender listed in Deepgram's Aura-2 English voice catalog.
const masculineVoices = new Set(['aries', 'draco', 'hermes', 'jupiter', 'mars', 'neptune', 'odysseus', 'saturn', 'zeus']);
const samples = import.meta.glob('../assets/voice-samples/*.wav', {
  eager: true,
  import: 'default',
  query: '?url',
});

export const interviewerVoices = Object.entries(samples).map(([path, url]) => {
  const value = path.split('/').at(-1).slice(0, -4);
  const sampleName = value.slice('aura-2-'.length, -'-en'.length);
  const name = sampleName[0].toUpperCase() + sampleName.slice(1);
  const isDefault = value === DEFAULT_INTERVIEWER_VOICE;
  const label = name + (isDefault ? ' (Default)' : '');
  return { value, name, label, url, isDefault, masculine: masculineVoices.has(sampleName) };
}).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label));
