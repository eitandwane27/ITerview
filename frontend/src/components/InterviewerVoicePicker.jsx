import { useEffect, useId, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import DashboardRoleSelect from './DashboardRoleSelect';
import { DEFAULT_INTERVIEWER_VOICE, interviewerVoices } from '../utils/interviewerVoices';
import './InterviewerVoicePicker.css';

const voiceGroups = [
  { label: 'Feminine', options: interviewerVoices.filter(voice => !voice.masculine) },
  { label: 'Masculine', options: interviewerVoices.filter(voice => voice.masculine) },
];

export default function InterviewerVoicePicker({ value, onChange, disabled, labelledBy }) {
  const id = useId();
  const audioRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [failedVoice, setFailedVoice] = useState(null);
  const activePreview = useRef(null);
  const selected = interviewerVoices.find(voice => voice.value === value) ||
    interviewerVoices.find(voice => voice.value === DEFAULT_INTERVIEWER_VOICE);
  const isPlaying = !disabled && preview === selected.value;

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      activePreview.current = null;
      audio.pause();
    };
  }, [selected.value, disabled]);

  const stopPreview = () => {
    activePreview.current = null;
    audioRef.current.pause();
    setPreview(null);
  };

  const togglePreview = async () => {
    if (isPlaying) {
      stopPreview();
      return;
    }
    const audio = audioRef.current;
    const attempt = {};
    activePreview.current = attempt;
    setFailedVoice(null);
    setPreview(selected.value);
    try {
      if (audio.getAttribute('src') !== selected.url) audio.src = selected.url;
      audio.currentTime = 0;
      await audio.play();
    } catch {
      if (activePreview.current === attempt) {
        stopPreview();
        setFailedVoice(selected.value);
      }
    }
  };

  return (
    <div className="interviewer-voice">
      {!labelledBy && <label id={`${id}-label`} htmlFor={id}>Interviewer voice</label>}
      <div className="interviewer-voice__controls">
        <DashboardRoleSelect
          id={id}
          labelledBy={labelledBy || `${id}-label`}
          groups={voiceGroups}
          value={selected.value}
          onChange={nextVoice => {
            stopPreview();
            setFailedVoice(null);
            onChange(nextVoice);
          }}
          disabled={disabled}
          icon={null}
          menuClassName="interviewer-voice__menu"
        />
        <button className="interviewer-voice__sample" type="button" onClick={togglePreview} disabled={disabled}>
          {isPlaying ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {isPlaying ? 'Stop sample' : 'Hear sample'}
        </button>
      </div>
      <audio
        ref={audioRef}
        onEnded={stopPreview}
        onPause={event => { if (event.currentTarget.paused) setPreview(null); }}
        onError={() => {
          if (activePreview.current) {
            stopPreview();
            setFailedVoice(selected.value);
          }
        }}
      />
      {failedVoice === selected.value && (
        <p className="interviewer-voice__error" role="alert">Couldn’t play the sample. Try again.</p>
      )}
    </div>
  );
}
