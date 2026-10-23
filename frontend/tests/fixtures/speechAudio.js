// A modulated test tone exercises actual playback and the audio analyser.
export function speechAudioBase64(seconds = 4) {
  const sampleRate = 16000;
  const length = Math.round(sampleRate * seconds);
  const wav = Buffer.alloc(44 + length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(length * 2, 40);
  for (let index = 0; index < length; index++) {
    const time = index / sampleRate;
    const envelope = Math.min(1, time * 15, (seconds - time) * 15) * (0.25 + 0.75 * Math.abs(Math.sin(time * 8)));
    wav.writeInt16LE(Math.round(Math.sin(time * Math.PI * 440) * envelope * 9000), 44 + index * 2);
  }
  return wav.toString('base64');
}
