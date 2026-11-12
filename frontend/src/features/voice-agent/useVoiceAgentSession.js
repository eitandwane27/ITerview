import { schoolSocketProtocols } from '../../utils/authenticatedApi';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceAgentAudioPlayer } from './VoiceAgentAudioPlayer';
import { buildAudioInputConstraints } from '../../utils/audioInputDevices';
import { productionBackendUrl } from '../../utils/backendUrl';

const INPUT_SAMPLE_RATE = 16_000;
const PROCESSOR_BUFFER_SIZE = 2048;
const CONNECT_TIMEOUT_MS = 15_000;

function getVoiceAgentSocketUrl() {
  if (import.meta.env.VITE_VOICE_AGENT_WS_URL) {
    return import.meta.env.VITE_VOICE_AGENT_WS_URL;
  }
  if (productionBackendUrl) {
    return `${productionBackendUrl.replace(/^http/, 'ws')}/ws/voice-agent`;
  }

  const { hostname, host, protocol } = window.location;
  const isLocalFrontend =
    (hostname === 'localhost' || hostname === '127.0.0.1') && window.location.port !== '5000';
  const socketHost = isLocalFrontend ? `${hostname}:5000` : host;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${socketHost}/ws/voice-agent`;
}

function resampleToPcm16(input, inputSampleRate) {
  const ratio = inputSampleRate / INPUT_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Int16Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const inputStart = Math.floor(outputIndex * ratio);
    const inputEnd = Math.min(input.length, Math.floor((outputIndex + 1) * ratio));
    let sum = 0;
    let samples = 0;

    for (let inputIndex = inputStart; inputIndex < inputEnd; inputIndex += 1) {
      sum += input[inputIndex];
      samples += 1;
    }

    const sample = Math.max(-1, Math.min(1, samples > 0 ? sum / samples : input[inputStart] || 0));
    output[outputIndex] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}

function getMicrophoneErrorMessage(error) {
  if (error?.name === 'NotAllowedError') {
    return 'Microphone access is blocked. Allow it in your browser, then try again.';
  }
  if (error?.name === 'NotFoundError') {
    return 'No microphone was found. Connect one, then try again.';
  }
  if (error?.name === 'NotReadableError') {
    return 'Your microphone is being used by another app. Close it there, then try again.';
  }
  return 'The microphone could not start. Check your audio settings, then try again.';
}

async function requestMicrophoneStream(deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support microphone access.');
  }

  const supportedConstraints = navigator.mediaDevices.getSupportedConstraints?.() || {};
  const canRequestVoiceIsolation = supportedConstraints.voiceIsolation === true;

  const openStream = async (targetDeviceId, requestVoiceIsolation = canRequestVoiceIsolation) => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: buildAudioInputConstraints(targetDeviceId, {
          ...(requestVoiceIsolation ? { voiceIsolation: true } : {}),
        }),
      });
    } catch (error) {
      if (requestVoiceIsolation && error?.name === 'OverconstrainedError') {
        return navigator.mediaDevices.getUserMedia({
          audio: buildAudioInputConstraints(targetDeviceId),
        });
      }
      throw error;
    }
  };

  const reportProcessingSettings = (stream) => {
    const settings = stream.getAudioTracks()[0]?.getSettings?.() || {};
    console.info('[VoiceAgent] Microphone processing settings', {
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      autoGainControl: settings.autoGainControl,
      voiceIsolation: settings.voiceIsolation,
      voiceIsolationRequested: canRequestVoiceIsolation,
    });
    return stream;
  };

  try {
    const stream = await openStream(deviceId);
    return { stream: reportProcessingSettings(stream), fellBackToDefault: false };
  } catch (error) {
    if (deviceId && ['NotFoundError', 'OverconstrainedError'].includes(error?.name)) {
      const stream = await openStream('');
      return { stream: reportProcessingSettings(stream), fellBackToDefault: true };
    }
    throw error;
  }
}

export function useVoiceAgentSession({ readPageContext } = {}) {
  const [agentState, setAgentState] = useState('ready');
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [microphones, setMicrophones] = useState([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState('');
  const [isSwitchingMicrophone, setIsSwitchingMicrophone] = useState(false);
  const [microphoneError, setMicrophoneError] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [caption, setCaption] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [workspace, setWorkspace] = useState(null);
  const [workspacePending, setWorkspacePending] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceClarification, setWorkspaceClarification] = useState('');
  const [uiAction, setUiAction] = useState(null);
  const pendingUiActionRef = useRef(null);
  const sessionGenerationRef = useRef(0);
  const lastWorkspacePromptRef = useRef('Show me my technical scores');
  const pendingWorkspaceIdRef = useRef(null);
  const dismissedWorkspaceIdsRef = useRef(new Set());
  const dismissNextWorkspaceRef = useRef(false);
  const queuedPromptRef = useRef('');
  const queuedPromptExpectsWorkspaceRef = useRef(true);

  const mountedRef = useRef(true);
  const socketRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const closingRef = useRef(false);
  const mediaStreamRef = useRef(null);
  const inputContextRef = useRef(null);
  const inputSourceRef = useRef(null);
  const inputProcessorRef = useRef(null);
  const inputSilencerRef = useRef(null);
  const outputPlayerRef = useRef(null);
  const pendingPlaybackStateRef = useRef(null);
  const startedAtRef = useRef(0);
  const selectedMicrophoneIdRef = useRef(selectedMicrophoneId);
  const micEnabledRef = useRef(true);
  const greetingMuteRef = useRef(false);
  const speechFinishedRef = useRef(false);
  // AgentAudioDone marks the server stream; the browser queue can outlast it.
  const isSpeechFinished = useCallback(() => speechFinishedRef.current && !outputPlayerRef.current?.hasPlayback, []);

  const setMicrophoneEnabled = useCallback((enabled) => {
    micEnabledRef.current = enabled;
    mediaStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = enabled; });
    if (mountedRef.current) setMicEnabled(enabled);
  }, []);

  const releaseGreetingMute = useCallback(() => {
    if (!greetingMuteRef.current) return;
    greetingMuteRef.current = false;
    setMicrophoneEnabled(true);
  }, [setMicrophoneEnabled]);

  const updateSelectedMicrophone = useCallback((deviceId) => {
    selectedMicrophoneIdRef.current = deviceId;
    setSelectedMicrophoneId(deviceId);
  }, []);

  const refreshMicrophones = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMicrophones([]);
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === 'audioinput');
      setMicrophones(audioInputs);
      return audioInputs;
    } catch {
      setMicrophones([]);
      return [];
    }
  }, []);

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const stopInput = useCallback(() => {
    if (inputProcessorRef.current) {
      inputProcessorRef.current.onaudioprocess = null;
      inputProcessorRef.current.disconnect();
      inputProcessorRef.current = null;
    }
    inputSourceRef.current?.disconnect();
    inputSourceRef.current = null;
    inputSilencerRef.current?.disconnect();
    inputSilencerRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    if (inputContextRef.current && inputContextRef.current.state !== 'closed') {
      inputContextRef.current.close().catch(() => {});
    }
    inputContextRef.current = null;
  }, []);

  const clearPlayback = useCallback(() => {
    pendingPlaybackStateRef.current = null;
    outputPlayerRef.current?.interrupt();
    if (mountedRef.current) setVoiceLevel(0);
  }, []);

  const completePendingPlaybackState = useCallback(() => {
    if (outputPlayerRef.current?.hasPlayback) return;

    const pendingState = pendingPlaybackStateRef.current;
    if (!pendingState) return;

    pendingPlaybackStateRef.current = null;
    // Only the opening greeting is protected. A server audio-done event alone
    // is insufficient: wait until the local output queue has actually drained.
    if (pendingState === 'listening') releaseGreetingMute();
    if (mountedRef.current) {
      setAgentState(pendingState);
      setVoiceLevel(0);
    }
  }, [releaseGreetingMute]);

  const closeOutput = useCallback(() => {
    clearPlayback();
    outputPlayerRef.current?.dispose();
    outputPlayerRef.current = null;
  }, [clearPlayback]);

  const stopSession = useCallback(
    ({ keepUi = false } = {}) => {
      closingRef.current = true;
      sessionGenerationRef.current += 1;
      greetingMuteRef.current = false;
      speechFinishedRef.current = false;
      pendingUiActionRef.current = null;
      queuedPromptRef.current = '';
      pendingWorkspaceIdRef.current = null;
      dismissedWorkspaceIdsRef.current.clear();
      dismissNextWorkspaceRef.current = false;
      if (mountedRef.current) {
        setWorkspace(null);
        setUiAction(null);
        setWorkspacePending(false);
        setWorkspaceError('');
        setWorkspaceClarification('');
      }
      clearConnectTimeout();
      stopInput();
      closeOutput();

      const socket = socketRef.current;
      socketRef.current = null;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'close_session' }));
        socket.close(1000, 'Voice session ended');
      } else if (socket?.readyState === WebSocket.CONNECTING) {
        socket.close();
      }

      startedAtRef.current = 0;
      if (!keepUi && mountedRef.current) {
        updateSelectedMicrophone('');
        setConnectionStatus('idle');
        setAgentState('ready');
        setElapsedSeconds(0);
        setCaption('');
        setVoiceLevel(0);
      }
    },
    [clearConnectTimeout, closeOutput, stopInput, updateSelectedMicrophone]
  );

  const failSession = useCallback(
    (message) => {
      if (!mountedRef.current) return;
      setErrorMessage(message);
      setConnectionStatus('error');
      setAgentState('error');
      stopSession({ keepUi: true });
    },
    [stopSession]
  );

  const ensureOutputContext = useCallback(async () => {
    if (!outputPlayerRef.current) {
      const player = new VoiceAgentAudioPlayer({
        onLevel: level => { if (mountedRef.current) setVoiceLevel(level); },
        onDrain: completePendingPlaybackState,
        onError: error => {
          if (outputPlayerRef.current === player) failSession(error.message);
        },
      });
      player.setVolume(audioEnabled ? 1 : 0);
      outputPlayerRef.current = player;
    }
    await outputPlayerRef.current.resume();
  }, [audioEnabled, completePendingPlaybackState, failSession]);

  const enqueueOutputAudio = useCallback(
    (arrayBuffer) => {
      speechFinishedRef.current = false;
      try { outputPlayerRef.current?.queue(arrayBuffer); }
      catch (error) { failSession(error.message); }
    },
    [failSession]
  );

  const startInput = useCallback(() => {
    if (inputProcessorRef.current || !mediaStreamRef.current) return;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      failSession('This browser does not support microphone streaming.');
      return;
    }

    const context = new AudioContextCtor({ latencyHint: 'interactive' });
    const source = context.createMediaStreamSource(mediaStreamRef.current);
    const processor = context.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
    const silencer = context.createGain();
    silencer.gain.value = 0;

    source.connect(processor);
    processor.connect(silencer);
    silencer.connect(context.destination);

    processor.onaudioprocess = (event) => {
      const socket = socketRef.current;
      if (socket?.readyState !== WebSocket.OPEN || !mediaStreamRef.current) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = resampleToPcm16(input, context.sampleRate);
      socket.send(pcm.buffer);
    };

    inputContextRef.current = context;
    inputSourceRef.current = source;
    inputProcessorRef.current = processor;
    inputSilencerRef.current = silencer;
    context.resume().catch(() => {});
  }, [failSession]);

  const handleControlMessage = useCallback(
    (message) => {
      if (message.type === 'voice_agent_read_page') {
        if (typeof message.id === 'string' && socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'page_context_result', id: message.id, context: readPageContext?.() ?? null,
          }));
        }
        return;
      }
      if (message.type === 'voice_agent_ui_action') {
        if (!['open_practice_history', 'open_my_progress', 'open_practice_again', 'operate_practice_again', 'open_ai_coach', 'open_interview_prep', 'configure_interview_prep', 'return_to_playground', 'sign_out'].includes(message.name) || typeof message.id !== 'string') return;
        if (pendingUiActionRef.current) return;
        pendingUiActionRef.current = message.id;
        if (message.name === 'sign_out') {
          // Let Deepgram finish the tool turn before waiting for AudioDone;
          // this is acceptance only, never a claim that logout has succeeded.
          speechFinishedRef.current = false;
          socketRef.current?.send(JSON.stringify({ type: 'ui_action_accepted', id: message.id }));
        }
        setWorkspacePending(false);
        setUiAction({ id: message.id, name: message.name, options: message.options });
        return;
      }
      if (message.type === 'voice_agent_ui_cancel') {
        if (pendingUiActionRef.current !== message.id) return;
        pendingUiActionRef.current = null;
        setUiAction(null);
        return;
      }
      if (message.type === 'voice_agent_state') {
        if (message.state === 'thinking' || message.shouldClearPlayback) speechFinishedRef.current = false;
        if (message.shouldClearPlayback) {
          if (outputPlayerRef.current?.hasPlayback) {
            console.info('[VoiceAgent] Speech interrupted by microphone speech detection', {
              bufferedAudioMs: Math.round(outputPlayerRef.current.remainingSeconds * 1000),
            });
          }
          clearPlayback();
        }
        if (message.state === 'error') {
          pendingPlaybackStateRef.current = null;
          setAgentState('error');
          return;
        }

        if (message.waitForPlayback) {
          speechFinishedRef.current = true;
          outputPlayerRef.current?.finishStream();
          pendingPlaybackStateRef.current = message.state;
          completePendingPlaybackState();
          return;
        }

        pendingPlaybackStateRef.current = null;
        setAgentState(message.state);
        if (message.state !== 'speaking') setVoiceLevel(0);
        return;
      }

      if (message.type === 'voice_agent_ready') {
        clearConnectTimeout();
        setConnectionStatus('live');
        setAgentState('ready');
        setErrorMessage('');
        startedAtRef.current = Date.now();
        startInput();
        if (queuedPromptRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({ type: 'inject_user_message', content: queuedPromptRef.current })
          );
          queuedPromptRef.current = '';
          setWorkspacePending(queuedPromptExpectsWorkspaceRef.current);
        }
        return;
      }

      if (message.type === 'voice_agent_workspace_pending') {
        pendingWorkspaceIdRef.current = message.id;
        if (dismissNextWorkspaceRef.current) {
          dismissedWorkspaceIdsRef.current.add(message.id);
          dismissNextWorkspaceRef.current = false;
          return;
        }
        setWorkspacePending(true);
        setWorkspaceError('');
        return;
      }
      if (message.type === 'voice_agent_workspace_error') {
        if (dismissedWorkspaceIdsRef.current.delete(message.id)) return;
        setWorkspacePending(false);
        setWorkspaceError(
          message.message || 'The workspace could not be updated. Please try again.'
        );
        return;
      }
      if (message.type === 'voice_agent_workspace_clarification') {
        if (dismissedWorkspaceIdsRef.current.delete(message.id)) return;
        pendingWorkspaceIdRef.current = null;
        setWorkspacePending(false);
        setWorkspaceError('');
        setWorkspaceClarification(message.question || 'Which result would you like to see?');
        return;
      }
      if (message.type === 'voice_agent_workspace') {
        if (dismissedWorkspaceIdsRef.current.delete(message.workspace?.id)) return;
        pendingWorkspaceIdRef.current = null;
        setWorkspace(message.workspace || null);
        setWorkspacePending(false);
        setWorkspaceError('');
        setWorkspaceClarification('');
        return;
      }
      if (message.type === 'voice_agent_workspace_cancel') {
        setWorkspace((current) => (current?.id === message.id ? null : current));
        setWorkspacePending(false);
        return;
      }

      if (message.type === 'voice_agent_event') {
        const event = message.event;
        if (event?.type === 'ConversationText') {
          if (event.role === 'assistant') setWorkspacePending(false);
          const content = (event.content || event.text || '').trim();
          if (event.role === 'user' && content) {
            speechFinishedRef.current = false;
            setWorkspaceClarification('');
          }
          if (content) {
            setCaption(`${event.role === 'user' ? 'You' : 'Coach'}: ${content}`);
          }
        }
        return;
      }

      if (message.type === 'voice_agent_error') {
        failSession(message.message || 'The voice session could not continue. Please try again.');
        return;
      }

      if (message.type === 'voice_agent_closed' && !message.expected && !closingRef.current) {
        failSession('The voice connection ended unexpectedly. Please try again.');
      }
    },
    [clearConnectTimeout, clearPlayback, completePendingPlaybackState, failSession, readPageContext, startInput]
  );

  const startSession = useCallback(async () => {
    if (connectionStatus === 'connecting' || connectionStatus === 'live') return;

    closingRef.current = false;
    const generation = ++sessionGenerationRef.current;
    setConnectionStatus('connecting');
    setAgentState('connecting');
    setErrorMessage('');
    setCaption('');
    setWorkspace(null);
    setWorkspacePending(false);
    setWorkspaceError('');
    setWorkspaceClarification('');
    setElapsedSeconds(0);
    greetingMuteRef.current = !queuedPromptRef.current;
    setMicrophoneEnabled(!greetingMuteRef.current);

    try {
      await ensureOutputContext();
      if (!mountedRef.current || generation !== sessionGenerationRef.current) return;
      const { stream, fellBackToDefault } = await requestMicrophoneStream(
        selectedMicrophoneIdRef.current
      );

      if (!mountedRef.current || generation !== sessionGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (fellBackToDefault) updateSelectedMicrophone('');

      mediaStreamRef.current = stream;
      stream.getAudioTracks().forEach(track => { track.enabled = micEnabledRef.current; });
      await refreshMicrophones();
      const protocols = await schoolSocketProtocols();
      if (!mountedRef.current || generation !== sessionGenerationRef.current) return;
      const socket = new WebSocket(getVoiceAgentSocketUrl(), protocols);
      socket.binaryType = 'arraybuffer';
      socketRef.current = socket;

      connectTimeoutRef.current = window.setTimeout(() => {
        failSession('The voice service took too long to respond. Check the backend and try again.');
      }, CONNECT_TIMEOUT_MS);

      socket.onopen = () => {
        if (socketRef.current !== socket || generation !== sessionGenerationRef.current) return;
        socket.send(JSON.stringify({ type: 'start_session' }));
      };
      socket.onmessage = (event) => {
        if (socketRef.current !== socket || generation !== sessionGenerationRef.current) return;
        if (typeof event.data === 'string') {
          try {
            handleControlMessage(JSON.parse(event.data));
          } catch {
            failSession('The voice service returned an unreadable message. Please try again.');
          }
          return;
        }

        if (event.data instanceof ArrayBuffer) {
          enqueueOutputAudio(event.data);
        }
      };
      socket.onerror = () => {
        if (socketRef.current !== socket) return;
        failSession('Could not reach the voice service. Make sure the backend is running.');
      };
      socket.onclose = (event) => {
        if (socketRef.current !== socket) return;
        clearConnectTimeout();
        if (!closingRef.current && event.code !== 1000) {
          failSession('The voice connection ended unexpectedly. Please try again.');
        }
      };
    } catch (error) {
      if (generation !== sessionGenerationRef.current || !mountedRef.current) return;
      const isMicrophoneError = [
        'NotAllowedError',
        'NotFoundError',
        'NotReadableError',
        'OverconstrainedError',
      ].includes(error?.name);
      failSession(
        isMicrophoneError
          ? getMicrophoneErrorMessage(error)
          : error?.message || 'The voice session could not start. Please try again.'
      );
    }
  }, [
    clearConnectTimeout,
    connectionStatus,
    enqueueOutputAudio,
    ensureOutputContext,
    failSession,
    handleControlMessage,
    refreshMicrophones,
    setMicrophoneEnabled,
    updateSelectedMicrophone,
  ]);

  const selectMicrophone = useCallback(
    async (deviceId) => {
      const nextDeviceId = deviceId || '';
      setMicrophoneError('');

      if (connectionStatus !== 'live') {
        updateSelectedMicrophone(nextDeviceId);
        return;
      }

      setIsSwitchingMicrophone(true);
      const generation = sessionGenerationRef.current;
      try {
        const { stream, fellBackToDefault } = await requestMicrophoneStream(nextDeviceId);
        if (!mountedRef.current || generation !== sessionGenerationRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream.getAudioTracks().forEach((track) => {
          track.enabled = micEnabledRef.current;
        });

        stopInput();
        mediaStreamRef.current = stream;
        updateSelectedMicrophone(fellBackToDefault ? '' : nextDeviceId);
        startInput();
        await refreshMicrophones();
      } catch (error) {
        setMicrophoneError(
          error?.name === 'NotAllowedError'
            ? 'Microphone access was blocked. Allow it in your browser, then try again.'
            : 'That microphone could not be opened. Your current microphone is still active.'
        );
      } finally {
        if (mountedRef.current) setIsSwitchingMicrophone(false);
      }
    },
    [connectionStatus, refreshMicrophones, startInput, stopInput, updateSelectedMicrophone]
  );

  const toggleMic = useCallback(() => {
    if (connectionStatus === 'idle' || connectionStatus === 'error') {
      startSession();
      return;
    }
    if (connectionStatus !== 'live') return;

    // A manual choice takes ownership, including staying muted after greeting.
    greetingMuteRef.current = false;
    setMicrophoneEnabled(!micEnabledRef.current);
  }, [connectionStatus, setMicrophoneEnabled, startSession]);

  const toggleAudio = useCallback(() => {
    const nextEnabled = !audioEnabled;
    setAudioEnabled(nextEnabled);
    outputPlayerRef.current?.setVolume(nextEnabled ? 1 : 0);
  }, [audioEnabled]);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return undefined;

    let cancelled = false;
    const syncDevices = async () => {
      const devices = await refreshMicrophones();
      if (cancelled) return;

      const selectedId = selectedMicrophoneIdRef.current;
      if (selectedId && !devices.some((device) => device.deviceId === selectedId)) {
        await selectMicrophone('');
      }
    };

    syncDevices();
    mediaDevices.addEventListener?.('devicechange', syncDevices);
    return () => {
      cancelled = true;
      mediaDevices.removeEventListener?.('devicechange', syncDevices);
    };
  }, [refreshMicrophones, selectMicrophone]);

  useEffect(() => {
    if (connectionStatus !== 'live') return undefined;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [connectionStatus]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopSession({ keepUi: true });
      closeOutput();
    };
  }, [closeOutput, stopSession]);

  const askNikki = useCallback(
    async (content, { expectWorkspace = true } = {}) => {
      if (!content || connectionStatus === 'connecting') return;
      speechFinishedRef.current = false;
      // An explicit new prompt replaces the greeting; do not carry its mute
      // into a later answer or a workspace-only response.
      releaseGreetingMute();
      setWorkspaceClarification('');
      if (expectWorkspace) {
        lastWorkspacePromptRef.current = content;
        dismissNextWorkspaceRef.current = false;
        pendingWorkspaceIdRef.current = null;
        setWorkspaceError('');
      }
      clearPlayback();
      if (socketRef.current?.readyState === WebSocket.OPEN && connectionStatus === 'live') {
        if (expectWorkspace) setWorkspacePending(true);
        socketRef.current.send(JSON.stringify({ type: 'inject_user_message', content }));
      } else {
        queuedPromptRef.current = content;
        queuedPromptExpectsWorkspaceRef.current = expectWorkspace;
        await startSession();
      }
    },
    [clearPlayback, connectionStatus, releaseGreetingMute, startSession]
  );

  useEffect(() => {
    if (!workspacePending) return undefined;
    const timeout = window.setTimeout(() => {
      setWorkspacePending(false);
      setWorkspaceError('This is taking longer than expected. Try asking for the view again.');
    }, 20_000);
    return () => window.clearTimeout(timeout);
  }, [workspacePending]);

  const completeUiAction = useCallback((id, result) => {
    if (pendingUiActionRef.current !== id) return;
    pendingUiActionRef.current = null;
    setUiAction(null);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'ui_action_result', id, result,
        context: readPageContext?.() ?? null,
      }));
    }
  }, [readPageContext]);

  return {
    isSpeechFinished,
    uiAction,
    completeUiAction,
    workspace,
    workspacePending,
    workspaceError,
    workspaceClarification,
    retryWorkspace: () => askNikki(lastWorkspacePromptRef.current),
    askNikki,
    dismissWorkspace: () => {
      if (workspacePending) {
        if (pendingWorkspaceIdRef.current) {
          dismissedWorkspaceIdsRef.current.add(pendingWorkspaceIdRef.current);
          if (dismissedWorkspaceIdsRef.current.size > 16)
            dismissedWorkspaceIdsRef.current.delete(
              dismissedWorkspaceIdsRef.current.values().next().value
            );
        } else dismissNextWorkspaceRef.current = true;
      }
      setWorkspace(null);
      setWorkspacePending(false);
      setWorkspaceError('');
      setWorkspaceClarification('');
    },
    agentState,
    connectionStatus,
    elapsedSeconds,
    micEnabled,
    microphones,
    selectedMicrophoneId,
    isSwitchingMicrophone,
    microphoneError,
    audioEnabled,
    captionsEnabled,
    caption,
    errorMessage,
    voiceLevel,
    isLive: connectionStatus === 'live',
    isConnecting: connectionStatus === 'connecting',
    startSession,
    stopSession,
    toggleMic,
    selectMicrophone,
    toggleAudio,
    toggleCaptions: () => setCaptionsEnabled((enabled) => !enabled),
  };
}

export default useVoiceAgentSession;
