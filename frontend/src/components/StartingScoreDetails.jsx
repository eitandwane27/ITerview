import { isValidScore } from '../utils/assessmentGuidance';
import './StartingScoreDetails.css';

const SCORE_MAX = 5;
const PERCENT_MAX = 100;

export default function StartingScoreDetails({ score, sourceScale = 'percentage' }) {
  const scoreOutOfFive =
    sourceScale === 'out-of-five' && isValidScore(score)
      ? score
      : isValidScore(score) && score >= 0 && score <= PERCENT_MAX
        ? Math.round((score / 20) * 10) / 10
        : null;
  const hasValidScore =
    isValidScore(scoreOutOfFive) && scoreOutOfFive >= 1 && scoreOutOfFive <= SCORE_MAX;

  return (
    <details className="starting-score-details">
      <summary>Score details</summary>
      <div className="starting-score-details-content">
        <p>
          Starting check <span className="starting-score-details-secondary">(pre-test)</span>
        </p>
        <p className="starting-score-details-value">
          {hasValidScore ? scoreOutOfFive.toFixed(1) : 'Unavailable'}
          {hasValidScore && <small> / 5.0</small>}
        </p>
        <p className="starting-score-details-secondary">
          Based on your five starting answers. We’ll compare this with your progress check after
          practice.
        </p>
      </div>
    </details>
  );
}
