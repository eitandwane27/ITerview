export const AUDIO_INPUT_STORAGE_KEY = 'iterview.preferredAudioInput';

export function readPreferredAudioInput() {
  try {
    return window.localStorage.getItem(AUDIO_INPUT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function rememberPreferredAudioInput(deviceId) {
  try {
    if (deviceId) {
      window.localStorage.setItem(AUDIO_INPUT_STORAGE_KEY, deviceId);
    } else {
      window.localStorage.removeItem(AUDIO_INPUT_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function buildAudioInputConstraints(deviceId, overrides = {}) {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...overrides,
  };
}

export function getAudioInputLabel(device, index) {
  return device.label || `Microphone ${index + 1}`;
}
