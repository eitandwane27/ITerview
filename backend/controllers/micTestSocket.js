// Authenticated microphone check: reuse the demo/interview STT service while
// keeping the Deepgram API key on the server. No scoring or database writes.
const { createDeepgramLiveSession } = require('../services/sttService');

function handleMicTestSocket(ws) {
  let recording = null;

  function send(message) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  }

  function stopRecording() {
    const previous = recording;
    recording = null;
    previous?.session?.finish();
  }

  function failRecording() {
    stopRecording();
    send({ type: 'error', message: 'Could not connect to speech service. Please try again.' });
  }

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      recording?.session?.sendAudio(data);
      return;
    }

    let message;
    try { message = JSON.parse(data.toString()); } catch { return; }
    if (!message || typeof message !== 'object' || Array.isArray(message)) return;

    if (message.type === 'stop_recording') {
      stopRecording();
      send({ type: 'status', message: 'Stopped.' });
    } else if (message.type === 'start_recording' && !recording) {
      const current = { session: null };
      recording = current;
      try {
        const session = createDeepgramLiveSession(
          (text, isFinal) => {
            if (recording === current) send({ type: 'transcript', text, isFinal });
          },
          () => {
            if (recording === current) failRecording();
          },
        );
        // Missing configuration can call onError synchronously, before return.
        if (recording !== current) {
          session?.finish();
          return;
        }
        if (!session) {
          failRecording();
          return;
        }
        current.session = session;
        send({ type: 'status', message: 'Listening...' });
      } catch {
        if (recording === current) failRecording();
      }
    }
  });

  ws.on('close', stopRecording);
  ws.on('error', stopRecording);
}

module.exports = { handleMicTestSocket };
