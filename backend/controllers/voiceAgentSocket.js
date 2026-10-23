// Browser-facing socket for the standalone Voice Agent feature.
// Binary frames are PCM16 16 kHz microphone audio in and PCM16 24 kHz TTS
// audio out. JSON frames are control messages and normalized UI state events.

const WebSocket = require('ws');
const { createVoiceAgentSession } = require('../services/voiceAgentService');
const { createVoiceAgentTelemetry } = require('../services/voiceAgentTelemetry');
const { loadVoiceAgentProgress } = require('../services/voiceAgentProgressService');
const { buildVoiceWorkspace } = require('../services/voiceAgentWorkspaceService');

function handleVoiceAgentSocket(ws, request, {
  loadProgress = loadVoiceAgentProgress,
  createSession = createVoiceAgentSession,
  progressTimeoutMs = 3_000,
} = {}) {
  const telemetry = createVoiceAgentTelemetry();
  console.log('[VoiceAgent] Browser connected');

  let currentState = 'connecting';
  let session;
  let closed = false;
  const completedCalls = new Map();
  const cancelledCalls = new Set();

  function sendJson(payload) {
    if (!closed && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function setState(state, extra = {}) {
    if (currentState === state && Object.keys(extra).length === 0) return;
    currentState = state;
    sendJson({ type: 'voice_agent_state', state, ...extra });
  }

  function forwardEvent(event, progressContext) {
    if (closed) return;
    if (event.type === 'FunctionCallRequest') {
      for (const call of Array.isArray(event.functions) ? event.functions.slice(0, 8) : []) {
        if (call.client_side !== true || typeof call.id !== 'string') continue;
        if (cancelledCalls.has(call.id)) continue;
        if (completedCalls.has(call.id)) {
          sendSessionCommand(completedCalls.get(call.id));
          continue;
        }
        let result;
        try {
          if (call.name !== 'show_workspace') throw new Error('Unsupported display action.');
          if (typeof call.arguments !== 'string' || call.arguments.length > 4000) throw new Error('Invalid display request.');
          sendJson({ type: 'voice_agent_workspace_pending', id: call.id });
          const workspace = buildVoiceWorkspace(JSON.parse(call.arguments), progressContext);
          if (workspace?.needsClarification) {
            sendJson({ type: 'voice_agent_workspace_clarification', id: call.id, question: workspace.question });
            result = { ok: false, ...workspace };
          } else {
            sendJson({ type: 'voice_agent_workspace', workspace: workspace ? { ...workspace, id: call.id } : null });
            result = { ok: true, displayed: workspace };
          }
        } catch {
          result = { ok: false, error: 'That view could not be displayed. Try a supported view and available saved results.' };
          if (call.name === 'show_workspace') sendJson({ type: 'voice_agent_workspace_error', id: call.id, message: result.error });
        }
        const response = { type: 'FunctionCallResponse', id: call.id, name: call.name, content: JSON.stringify(result) };
        if (call.thought_signature) response.thought_signature = call.thought_signature;
        completedCalls.set(call.id, response);
        if (completedCalls.size > 32) completedCalls.delete(completedCalls.keys().next().value);
        sendSessionCommand(response);
      }
      return;
    }
    if (event.type === 'FunctionCallCancelled') {
      for (const call of Array.isArray(event.functions) ? event.functions : []) {
        completedCalls.delete(call.id);
        cancelledCalls.add(call.id);
        if (cancelledCalls.size > 32) cancelledCalls.delete(cancelledCalls.values().next().value);
        sendJson({ type: 'voice_agent_workspace_cancel', id: call.id });
      }
      return;
    }
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

  async function startSession() {
    const uid = request?.auth?.uid;
    if (typeof uid !== 'string' || !uid) {
      setState('error');
      sendJson({ type: 'voice_agent_error', message: 'Please sign in to start a voice session.' });
      ws.close(1008, 'Authentication required');
      return;
    }

    let progressContext = null;
    let timeout;
    try {
      // Account selection comes only from the verified WebSocket identity. A
      // bounded one-time read avoids adding a database lookup to each voice turn.
      progressContext = await Promise.race([
        loadProgress(uid),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Progress timed out')), progressTimeoutMs);
        }),
      ]);
    } catch {
      telemetry.error(new Error('Saved progress unavailable; continuing with general voice help.'));
    } finally {
      clearTimeout(timeout);
    }

    if (closed || ws.readyState !== WebSocket.OPEN) return;

    try {
      session = createSession({
        progressContext,
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
        onEvent: event => forwardEvent(event, progressContext),
        onAudio(audio) {
          setState('speaking');
          if (!closed && ws.readyState === WebSocket.OPEN) {
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
  }

  ws.on('message', (data, isBinary) => {
    if (closed) return;

    if (isBinary) {
      session?.sendAudio(data);
      return;
    }

    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      sendJson({ type: 'voice_agent_error', message: 'Invalid JSON control message' });
      return;
    }

    if (!message || typeof message !== 'object' || Array.isArray(message)) return;
    if (message.type === 'close_session') {
      closed = true;
      session?.close();
      return;
    }
    if (!session) return;

    switch (message.type) {
      case 'start_session':
        sendJson({
          type: 'voice_agent_status',
          status: session.isReady() ? 'ready' : 'connecting',
        });
        break;

      case 'inject_user_message':
      case 'InjectUserMessage': {
        const content = typeof message.content === 'string' ? message.content.trim() : '';
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

      default:
        sendJson({
          type: 'voice_agent_error',
          message: `Unsupported control message: ${message.type || 'unknown'}`,
        });
    }
  });

  ws.on('close', () => {
    closed = true;
    console.log('[VoiceAgent] Browser disconnected');
    session?.close();
  });

  ws.on('error', (error) => {
    closed = true;
    telemetry.error(error);
    session?.close();
  });

  return startSession();
}

module.exports = { handleVoiceAgentSocket };
