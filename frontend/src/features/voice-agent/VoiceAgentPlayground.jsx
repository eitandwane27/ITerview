import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Captions,
  ChevronDown,
  LoaderCircle,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AIOrb } from '../../components/AIOrb';
import logoSrc from '../../assets/logo';
import VoiceAgentBackdrop from './VoiceAgentBackdrop';
import { useVoiceAgentSession } from './useVoiceAgentSession';
import { getAudioInputLabel } from '../../utils/audioInputDevices';
import './VoiceAgentPlayground.css';

const STATE_COPY = {
  connecting: {
    title: 'Getting things ready',
    detail: 'Connecting your microphone and voice companion.',
    ariaLabel: 'Voice coach is connecting',
  },
  ready: {
    title: 'Ready when you are',
    detail: 'Say whatever is on your mind.',
    ariaLabel: 'Voice coach is ready',
  },
  listening: {
    title: 'Listening to you',
    detail: 'Take your time — I’m right here.',
    ariaLabel: 'Voice coach is listening',
  },
  thinking: {
    title: 'Thinking with you',
    detail: 'Give me a moment to consider that.',
    ariaLabel: 'Voice coach is thinking',
  },
  speaking: {
    title: 'Speaking with you',
    detail: 'You can interrupt me at any time.',
    ariaLabel: 'Voice coach is speaking',
  },
  interrupted: {
    title: 'I’m listening',
    detail: 'Go ahead — I stopped for you.',
    ariaLabel: 'Voice coach stopped speaking and is listening',
  },
  error: {
    title: 'We lost the connection',
    detail: 'Your conversation is safe. Try again when you’re ready.',
    ariaLabel: 'Voice coach connection error',
  },
};

function formatSessionTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function VoiceAgentPlayground() {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
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
    isLive,
    isConnecting,
    stopSession,
    toggleMic,
    selectMicrophone,
    toggleAudio,
    toggleCaptions,
  } = useVoiceAgentSession();

  const energy = agentState === 'speaking' ? voiceLevel / 100 : 0;
  const copy = STATE_COPY[agentState] || STATE_COPY.ready;
  const sessionStarted = isLive || isConnecting;
  const showHeaderStatus = sessionStarted || connectionStatus === 'error';
  const liveLabel =
    connectionStatus === 'connecting'
      ? 'CONNECTING'
      : connectionStatus === 'error'
        ? 'OFFLINE'
        : isLive
          ? 'LIVE'
          : 'READY';
  const statusDetail =
    errorMessage ||
    (!isLive && connectionStatus === 'idle'
      ? 'Start a conversation when you’re ready.'
      : captionsEnabled && caption
        ? caption
        : !micEnabled && isLive
          ? 'Your microphone is muted.'
          : copy.detail);

  const orbStateProps = useMemo(
    () => ({
      isSpeaking: agentState === 'speaking',
      isListening: agentState === 'listening' || agentState === 'interrupted',
      isEvaluating: agentState === 'thinking' || agentState === 'connecting',
      hasError: agentState === 'error',
    }),
    [agentState]
  );

  const handleEndSession = () => {
    stopSession();
    navigate('/dashboard');
  };

  const handleMicControl = () => {
    if (!sessionStarted) {
      setSettingsOpen(false);
    }
    toggleMic();
  };

  const micLabel =
    connectionStatus === 'error'
      ? 'Try voice session again'
      : connectionStatus === 'idle'
        ? 'Start voice session'
        : isConnecting
          ? 'Starting voice session'
          : micEnabled
            ? 'Mute microphone'
            : 'Unmute microphone';

  const micControlCopy =
    connectionStatus === 'error'
      ? { title: 'Try again', detail: 'Reconnect your voice session' }
      : connectionStatus === 'idle'
        ? { title: 'Start conversation', detail: 'Your browser will ask for microphone access' }
        : isConnecting
          ? { title: 'Connecting…', detail: 'Preparing your private voice session' }
          : micEnabled
            ? { title: 'Mute microphone', detail: 'The coach can hear you' }
            : { title: 'Unmute microphone', detail: 'Continue when you’re ready' };

  const leaveLabel = sessionStarted ? 'End session' : 'Back to dashboard';

  const secondaryControls = (
    <div className="va-session-controls__secondary">
      <button
        type="button"
        className="va-session-control va-session-control--secondary"
        data-active={captionsEnabled}
        onClick={toggleCaptions}
        aria-pressed={captionsEnabled}
        aria-label={captionsEnabled ? 'Hide captions' : 'Show captions'}
      >
        <Captions size={20} aria-hidden="true" />
        <span>{captionsEnabled ? 'Captions on' : 'Captions'}</span>
      </button>
      <button
        type="button"
        className="va-session-control va-session-control--secondary"
        data-active={audioEnabled}
        onClick={toggleAudio}
        aria-pressed={audioEnabled}
        aria-label={audioEnabled ? 'Mute voice audio' : 'Unmute voice audio'}
      >
        {audioEnabled ? (
          <Volume2 size={20} aria-hidden="true" />
        ) : (
          <VolumeX size={20} aria-hidden="true" />
        )}
        <span>{audioEnabled ? 'Sound on' : 'Sound off'}</span>
      </button>
    </div>
  );

  return (
    <main className="voice-agent-playground" data-state={agentState}>
      <VoiceAgentBackdrop />

      <header className="va-topbar">
        <button
          type="button"
          className="va-brand"
          onClick={() => navigate('/dashboard')}
          aria-label="Return to the ITerview dashboard"
        >
          <img src={logoSrc} alt="" />
          <span className="va-brand__wordmark">ITerview</span>
        </button>

        <div className="va-topbar__status-slot">
          {showHeaderStatus && (
            <div
              className="va-live-pill"
              data-status={connectionStatus}
              role="status"
              aria-label={`Voice session is ${liveLabel.toLowerCase()}`}
            >
              <span className="va-live-pill__dot" />
              <strong>{liveLabel}</strong>
              <span className="va-live-pill__meta">
                {isLive
                  ? formatSessionTime(elapsedSeconds)
                  : connectionStatus === 'connecting'
                    ? 'One moment'
                    : 'Reconnect'}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="va-end-button"
          data-live={sessionStarted}
          onClick={handleEndSession}
          aria-label={leaveLabel}
        >
          {sessionStarted ? <PhoneOff size={17} /> : <ArrowLeft size={17} />}
          <span>{leaveLabel}</span>
        </button>
      </header>

      <section
        className="va-stage"
        aria-labelledby="voice-agent-status"
        style={{ '--va-energy': energy.toFixed(3) }}
      >
        <div className="va-orb-field">
          <span className="va-orb-field__halo" aria-hidden="true" />
          <AIOrb
            {...orbStateProps}
            volume={voiceLevel}
            ariaLabel={copy.ariaLabel}
            expressiveMotion
            expressionState={agentState}
          />
        </div>

        <div className="va-status" aria-live="polite" aria-atomic="true">
          {sessionStarted && (
            <span className="va-status__wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
          <h1 id="voice-agent-status">{copy.title}</h1>
          <p>{statusDetail}</p>
        </div>

        <div
          className="va-session-controls"
          data-session-started={sessionStarted}
          aria-label="Voice session controls"
        >
          <button
            type="button"
            className="va-session-control va-session-control--primary"
            data-active={micEnabled && connectionStatus !== 'error'}
            onClick={handleMicControl}
            disabled={isConnecting}
            aria-pressed={isLive ? micEnabled : undefined}
            aria-label={micLabel}
          >
            <span className="va-session-control__icon" aria-hidden="true">
              {connectionStatus === 'error' ? (
                <RotateCcw size={21} />
              ) : isConnecting ? (
                <LoaderCircle size={22} className="va-control-spinner" />
              ) : micEnabled ? (
                <Mic size={22} />
              ) : (
                <MicOff size={22} />
              )}
            </span>
            <span className="va-session-control__copy">
              <strong>{micControlCopy.title}</strong>
              <small>{micControlCopy.detail}</small>
            </span>
          </button>

          <div className="va-session-controls__toolbar" data-session-started={sessionStarted}>
            {sessionStarted && secondaryControls}
            <button
              type="button"
              className="va-audio-settings-trigger"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-expanded={settingsOpen}
              aria-controls="voice-agent-audio-settings"
            >
              <Settings2 size={17} aria-hidden="true" />
              <span>Audio settings</span>
              <ChevronDown
                size={15}
                className="va-audio-settings-trigger__chevron"
                aria-hidden="true"
              />
            </button>
          </div>

          {settingsOpen && (
            <div
              id="voice-agent-audio-settings"
              className="va-audio-settings-panel"
              aria-label="Audio settings"
            >
              <div className="va-device-picker" data-switching={isSwitchingMicrophone}>
                <Mic size={17} className="va-device-picker__icon" aria-hidden="true" />
                <label className="va-sr-only" htmlFor="voice-agent-microphone">
                  Microphone input
                </label>
                <select
                  id="voice-agent-microphone"
                  value={selectedMicrophoneId}
                  onChange={(event) => selectMicrophone(event.target.value)}
                  disabled={isConnecting || isSwitchingMicrophone}
                  aria-describedby={microphoneError ? 'voice-agent-microphone-error' : undefined}
                >
                  <option value="">System default microphone</option>
                  {microphones.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {getAudioInputLabel(device, index)}
                    </option>
                  ))}
                </select>
                {isSwitchingMicrophone ? (
                  <LoaderCircle
                    size={17}
                    className="va-device-picker__chevron va-control-spinner"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronDown size={17} className="va-device-picker__chevron" aria-hidden="true" />
                )}
              </div>
              {microphoneError && (
                <p
                  id="voice-agent-microphone-error"
                  className="va-device-picker__error"
                  role="alert"
                >
                  {microphoneError}
                </p>
              )}
              {!sessionStarted && secondaryControls}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
