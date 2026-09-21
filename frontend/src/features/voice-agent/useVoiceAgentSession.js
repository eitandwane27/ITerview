import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildAudioInputConstraints,
  readPreferredAudioInput,
  rememberPreferredAudioInput,
} from '../../utils/audioInputDevices';

const INPUT_SAMPLE_RATE = 16_000;
const OUTPUT_SAMPLE_RATE = 24_000;
const PROCESSOR_BUFFER_SIZE = 2048;
const CONNECT_TIMEOUT_MS = 15_000;

function getVoiceAgentSocketUrl() {
  if (import.meta.env.VITE_VOICE_AGENT_WS_URL) {
    return import.meta.env.VITE_VOICE_AGENT_WS_URL;
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

export function useVoiceAgentSession() {
  const [agentState, setAgentState] = useState('ready');
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [microphones, setMicrophones] = useState([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState(readPreferredAudioInput);
  const [isSwitchingMicrophone, setIsSwitchingMicrophone] = useState(false);
  const [microphoneError, setMicrophoneError] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [caption, setCaption] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [voiceLevel, setVoiceLevel] = useState(0);

  const mountedRef = useRef(true);
  const socketRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const closingRef = useRef(false);
  const mediaStreamRef = useRef(null);
  const inputContextRef = useRef(null);
  const inputSourceRef = useRef(null);
  const inputProcessorRef = useRef(null);
  const inputSilencerRef = useRef(null);
  const outputContextRef = useRef(null);
  const outputGainRef = useRef(null);
  const outputSourcesRef = useRef(new Set());
  const nextPlaybackTimeRef = useRef(0);
  const pendingPlaybackStateRef = useRef(null);
  const pendingAudioEnqueuesRef = useRef(0);
  const playbackGenerationRef = useRef(0);
  const lastLevelPublishedAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const selectedMicrophoneIdRef = useRef(selectedMicrophoneId);

  const rememberMicrophone = useCallback((deviceId) => {
    const nextDeviceId = deviceId || '';
    selectedMicrophoneIdRef.current = nextDeviceId;
    setSelectedMicrophoneId(nextDeviceId);
    rememberPreferredAudioInput(nextDeviceId);
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
    playbackGenerationRef.current += 1;
    pendingPlaybackStateRef.current = null;
    for (const source of outputSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // The source may already have ended between the event and this cleanup.
      }
    }
    outputSourcesRef.current.clear();
    nextPlaybackTimeRef.current = outputContextRef.current?.currentTime || 0;
    if (mountedRef.current) setVoiceLevel(0);
  }, []);

  const completePendingPlaybackState = useCallback(() => {
    if (pendingAudioEnqueuesRef.current > 0 || outputSourcesRef.current.size > 0) return;

    const pendingState = pendingPlaybackStateRef.current;
    if (!pendingState) return;

    pendingPlaybackStateRef.current = null;
    if (mountedRef.current) {
      setAgentState(pendingState);
      setVoiceLevel(0);
    }
  }, []);

  const closeOutput = useCallback(() => {
    clearPlayback();
    outputGainRef.current?.disconnect();
    outputGainRef.current = null;

    if (outputContextRef.current && outputContextRef.current.state !== 'closed') {
      outputContextRef.current.close().catch(() => {});
    }
    outputContextRef.current = null;
  }, [clearPlayback]);

  const stopSession = useCallback(
    ({ keepUi = false } = {}) => {
      closingRef.current = true;
      clearConnectTimeout();
      stopInput();
      clearPlayback();

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
        setConnectionStatus('idle');
        setAgentState('ready');
        setElapsedSeconds(0);
        setCaption('');
        setVoiceLevel(0);
      }
    },
    [clearConnectTimeout, clearPlayback, stopInput]
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
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('This browser does not support live voice playback.');
    }

    if (!outputContextRef.current || outputContextRef.current.state === 'closed') {
      const context = new AudioContextCtor({ latencyHint: 'interactive' });
      const gain = context.createGain();
      gain.gain.value = audioEnabled ? 1 : 0;
      gain.connect(context.destination);
      outputContextRef.current = context;
      outputGainRef.current = gain;
      nextPlaybackTimeRef.current = context.currentTime;
    }

    if (outputContextRef.current.state === 'suspended') {
      await outputContextRef.current.resume();
    }
  }, [audioEnabled]);

  const publishVoiceLevel = useCallback((samples) => {
    const now = performance.now();
    if (now - lastLevelPublishedAtRef.current < 48) return;

    let sumSquares = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const normalized = samples[index] / 0x8000;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, samples.length));
    const level = Math.max(8, Math.min(100, Math.round(rms * 440)));
    setVoiceLevel(level);
    lastLevelPublishedAtRef.current = now;
  }, []);

  const enqueueOutputAudio = useCallback(
    async (arrayBuffer) => {
      const playbackGeneration = playbackGenerationRef.current;
      pendingAudioEnqueuesRef.current += 1;

      try {
        await ensureOutputContext();
      } catch (error) {
        failSession(error.message);
        return;
      } finally {
        pendingAudioEnqueuesRef.current -= 1;
      }

      if (playbackGeneration !== playbackGenerationRef.current) {
        completePendingPlaybackState();
        return;
      }

      const context = outputContextRef.current;
      const gain = outputGainRef.current;
      if (!context || !gain || !arrayBuffer.byteLength) {
        completePendingPlaybackState();
        return;
      }

      const samples = new Int16Array(arrayBuffer);
      const audioBuffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
      const channel = audioBuffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) {
        channel[index] = samples[index] / 0x8000;
      }

      publishVoiceLevel(samples);

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gain);
      outputSourcesRef.current.add(source);

      const startAt = Math.max(context.currentTime + 0.025, nextPlaybackTimeRef.current);
      nextPlaybackTimeRef.current = startAt + audioBuffer.duration;
      source.onended = () => {
        outputSourcesRef.current.delete(source);
        source.disconnect();
        completePendingPlaybackState();
      };
      source.start(startAt);
      completePendingPlaybackState();
    },
    [completePendingPlaybackState, ensureOutputContext, failSession, publishVoiceLevel]
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
      if (message.type === 'voice_agent_state') {
        if (message.shouldClearPlayback) clearPlayback();
        if (message.state === 'error') {
          pendingPlaybackStateRef.current = null;
          setAgentState('error');
          return;
        }

        if (message.waitForPlayback) {
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
        return;
      }

      if (message.type === 'voice_agent_event') {
        const event = message.event;
        if (event?.type === 'ConversationText') {
          const content = (event.content || event.text || '').trim();
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
    [clearConnectTimeout, clearPlayback, completePendingPlaybackState, failSession, startInput]
  );

  const startSession = useCallback(async () => {
    if (connectionStatus === 'connecting' || connectionStatus === 'live') return;

    closingRef.current = false;
    setConnectionStatus('connecting');
    setAgentState('connecting');
    setErrorMessage('');
    setCaption('');
    setElapsedSeconds(0);
    setMicEnabled(true);

    try {
      await ensureOutputContext();
      const { stream, fellBackToDefault } = await requestMicrophoneStream(
        selectedMicrophoneIdRef.current
      );

      if (fellBackToDefault) rememberMicrophone('');

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      mediaStreamRef.current = stream;
      await refreshMicrophones();
      const socket = new WebSocket(getVoiceAgentSocketUrl());
      socket.binaryType = 'arraybuffer';
      socketRef.current = socket;

      connectTimeoutRef.current = window.setTimeout(() => {
        failSession('The voice service took too long to respond. Check the backend and try again.');
      }, CONNECT_TIMEOUT_MS);

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'start_session' }));
      };
      socket.onmessage = (event) => {
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
        failSession('Could not reach the voice service. Make sure the backend is running.');
      };
      socket.onclose = (event) => {
        clearConnectTimeout();
        if (!closingRef.current && event.code !== 1000) {
          failSession('The voice connection ended unexpectedly. Please try again.');
        }
      };
    } catch (error) {
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
    rememberMicrophone,
  ]);

  const selectMicrophone = useCallback(
    async (deviceId) => {
      const nextDeviceId = deviceId || '';
      setMicrophoneError('');

      if (connectionStatus !== 'live') {
        rememberMicrophone(nextDeviceId);
        return;
      }

      setIsSwitchingMicrophone(true);
      try {
        const { stream, fellBackToDefault } = await requestMicrophoneStream(nextDeviceId);
        if (!mountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream.getAudioTracks().forEach((track) => {
          track.enabled = micEnabled;
        });

        stopInput();
        mediaStreamRef.current = stream;
        rememberMicrophone(fellBackToDefault ? '' : nextDeviceId);
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
    [connectionStatus, micEnabled, refreshMicrophones, rememberMicrophone, startInput, stopInput]
  );

  const toggleMic = useCallback(() => {
    if (connectionStatus === 'idle' || connectionStatus === 'error') {
      startSession();
      return;
    }
    if (connectionStatus !== 'live') return;

    const nextEnabled = !micEnabled;
    mediaStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setMicEnabled(nextEnabled);
  }, [connectionStatus, micEnabled, startSession]);

  const toggleAudio = useCallback(() => {
    const nextEnabled = !audioEnabled;
    setAudioEnabled(nextEnabled);
    if (outputGainRef.current && outputContextRef.current) {
      outputGainRef.current.gain.setTargetAtTime(
        nextEnabled ? 1 : 0,
        outputContextRef.current.currentTime,
        0.015
      );
    }
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

  return {
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
