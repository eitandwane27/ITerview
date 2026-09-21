// Browser-facing socket for the standalone Voice Agent feature.
// Binary frames are PCM16 16 kHz microphone audio in and PCM16 24 kHz TTS
// audio out. JSON frames are control messages and normalized UI state events.

const WebSocket = require('ws');
const { createVoiceAgentSession } = require('../services/voiceAgentService');
const { createVoiceAgentTelemetry } = require('../services/voiceAgentTelemetry');

function handleVoiceAgentSocket(ws) {
  const telemetry = createVoiceAgentTelemetry();
  console.log('[VoiceAgent] Browser connected');

  let currentState = 'connecting';
  let session;

  function sendJson(payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function setState(state, extra = {}) {
    if (currentState === state && Object.keys(extra).length === 0) return;
    currentState = state;
    sendJson({ type: 'voice_agent_state', state, ...extra });
  }

  function forwardEvent(event) {
    telemetry.event(event);
    sendJson({ type: 'voice_agent_event', event });

    switch (event.type) {
      case 'UserStartedSpeaking':
        setState('listening', { shouldClearPlayback: true });
        break;
      case 'AgentThinking':
        setState('thinking');
        break;
      case 'AgentAudioDone':
        // Deepgram has finished sending audio, but the browser may still have
        // PCM chunks queued. Let the client wait for audible playback to end.
        setState('listening', { waitForPlayback: true });
        break;
      case 'Error':
        setState('error');
        break;
      default:
        break;
    }
  }

  function sendSessionCommand(command) {
    if (session?.sendCommand(command)) return true;

    sendJson({
      type: 'voice_agent_error',
      message: 'The voice agent is not ready yet',
    });
    return false;
  }

  sendJson({ type: 'voice_agent_state', state: currentState });

  try {
    session = createVoiceAgentSession({
      onStatus(status) {
        sendJson({ type: 'voice_agent_status', status });
      },
      onReady() {
        setState('ready');
        sendJson({
          type: 'voice_agent_ready',
          inputAudio: { encoding: 'linear16', sampleRate: 16000 },
          outputAudio: { encoding: 'linear16', sampleRate: 24000 },
        });
      },
      onEvent: forwardEvent,
      onAudio(audio) {
        setState('speaking');
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(audio, { binary: true });
        }
      },
      onError(error) {
        telemetry.error(error);
        setState('error');
        sendJson({ type: 'voice_agent_error', message: error.message });
      },
      onClose({ code, reason, expected }) {
        sendJson({ type: 'voice_agent_closed', code, reason, expected });
        if (!expected) setState('error');
      },
    });
  } catch (error) {
    telemetry.error(error);
    setState('error');
    sendJson({ type: 'voice_agent_error', message: error.message });
  }

  ws.on('message', (data, isBinary) => {
    if (!session) return;

    if (isBinary) {
      session.sendAudio(data);
      return;
    }

    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      sendJson({ type: 'voice_agent_error', message: 'Invalid JSON control message' });
      return;
    }

    switch (message.type) {
      case 'start_session':
        sendJson({
          type: 'voice_agent_status',
          status: session.isReady() ? 'ready' : 'connecting',
        });
        break;

      case 'inject_user_message':
      case 'InjectUserMessage': {
        const content = message.content?.trim();
        if (!content) {
          sendJson({
            type: 'voice_agent_error',
            message: 'A non-empty content value is required',
          });
          break;
        }
        sendSessionCommand({ type: 'InjectUserMessage', content });
        break;
      }

      case 'force_end_turn':
      case 'ForceEndTurn':
        sendSessionCommand({ type: 'ForceEndTurn' });
        break;

      case 'keep_alive':
      case 'KeepAlive':
        sendSessionCommand({ type: 'KeepAlive' });
        break;

      case 'close_session':
        session.close();
        break;

      default:
        sendJson({
          type: 'voice_agent_error',
          message: `Unsupported control message: ${message.type || 'unknown'}`,
        });
    }
  });

  ws.on('close', () => {
    console.log('[VoiceAgent] Browser disconnected');
    session?.close();
  });

  ws.on('error', (error) => {
    telemetry.error(error);
    session?.close();
  });
}

module.exports = { handleVoiceAgentSocket };
