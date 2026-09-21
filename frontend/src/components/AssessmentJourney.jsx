import { AudioLines, Check, Flag, Mic } from 'lucide-react';
import './AssessmentJourney.css';

const STEPS = ['Starting check', 'Practice', 'Progress check'];
const STEP_ICONS = [Mic, AudioLines, Flag];

export default function AssessmentJourney({
  current = 0,
  complete = false,
  appearance = 'compact',
}) {
  const playful = appearance === 'playful';
  return (
    <ol
      className={`assessment-journey${playful ? ' assessment-journey--playful' : ''}`}
      aria-label="Your interview practice journey"
    >
      {STEPS.map((label, index) => {
        const done = complete || index < current;
        const StepIcon = STEP_ICONS[index];
        return (
          <li
            key={label}
            className={`${index === current ? 'is-current' : ''} ${done ? 'is-done' : ''}`}
            aria-current={!complete && index === current ? 'step' : undefined}
          >
            <span className="assessment-journey-mark" aria-hidden="true">
              {done ? <Check size={14} strokeWidth={2.5} /> : playful ? <StepIcon /> : index + 1}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
