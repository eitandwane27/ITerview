import { forwardRef, useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion as Motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowRight, LoaderCircle, RefreshCw, X } from 'lucide-react';
import './VoiceAgentWorkspace.css';

const METRICS = {
  clarity: ['Clarity', 'Lead with your main idea, then explain it in a clear sequence.'],
  correctness: ['Correctness', 'Check the concept, your reasoning, and one important edge case.'],
  completeness: ['Completeness', 'Cover the explanation, an example, and a relevant trade-off.'],
  problemSolving: ['Problem solving', 'Explain your approach and why you chose it.'],
  accuracy: ['Accuracy', 'Use precise technical terms and check the details of your explanation.'],
  depth: ['Depth', 'Explain why the approach works, including its limitations or trade-offs.'],
  situation: ['Situation', 'Give enough context for someone unfamiliar with your experience.'],
  action: ['Action', 'Describe what you personally did and why.'],
  result: ['Result', 'Explain the real outcome and what you learned.'],
};
const STORY = {
  situation: ['01', 'Situation', 'What was happening? Describe the setting and challenge.'],
  task: ['02', 'Task', 'What were you responsible for? Explain the goal you needed to achieve.'],
  action: ['03', 'Action', 'What did you personally do? Walk Nikki through your contribution.'],
  result: ['04', 'Result', 'What happened next? Share the real outcome or what you learned.'],
};
const VIEWS = [
  ['scores', 'Scores'],
  ['feedback', 'Feedback'],
  ['comparison', 'Compare'],
  ['star', 'STAR'],
  ['drill', 'Drill'],
];
const SETS = { set1: 'Set 1 · Foundations', set2: 'Set 2 · Technical', set3: 'Set 3 · Behavioral' };
const RESEARCH_ASSESSMENTS = {
  preTest: {
    subtitle: 'Pre-test · One-time research assessment',
    purpose:
      'Your starting point before practice. This baseline is kept for comparison with your post-test and also helps identify your practice focus.',
    scoreLabel: 'Original pre-test score',
  },
  postTest: {
    subtitle: 'Post-test · One-time research assessment',
    purpose:
      'Your follow-up after practice. This result is paired with your original pre-test to measure changes in interview quality.',
    scoreLabel: 'Post-test score',
  },
};
const EASE = [0.16, 1, 0.3, 1];
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const percent = (value) => (isNumber(value) ? `${value}%` : 'Not assessed');
const metricLabel = (key) => METRICS[key]?.[0] || key;
const signed = (value) => `${value > 0 ? '+' : ''}${Number(value.toFixed(1))}`;
const savedDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date)
    : null;
};

function Score({ value, label }) {
  return (
    <div className="va-workspace__score">
      <span>{label}</span>
      <strong>
        {isNumber(value) ? (
          <>
            {value}
            <small>%</small>
          </>
        ) : (
          <span className="va-workspace__missing">Not assessed</span>
        )}
      </strong>
    </div>
  );
}

function Metrics({ metrics, compact = false, showGuidance = true }) {
  const entries = Object.entries(metrics || {});
  return entries.length > 0 ? (
    <dl className="va-workspace__metrics" data-compact={compact}>
      {entries.map(([key, value]) => (
        <div key={key} data-metric={key}>
          <dt>{metricLabel(key)}</dt>
          <dd>
            {isNumber(value) ? (
              <>
                {value}
                <span> / 5</span>
              </>
            ) : (
              'Not assessed'
            )}
          </dd>
          {!compact && (
            <>
              <div className="va-workspace__track" aria-hidden="true">
                <div
                  style={{
                    transform: `scaleX(${isNumber(value) ? Math.max(0, Math.min(1, value / 5)) : 0})`,
                  }}
                />
              </div>
              {showGuidance && METRICS[key] && <p>{METRICS[key][1]}</p>}
            </>
          )}
        </div>
      ))}
    </dl>
  ) : (
    <p className="va-workspace__note">
      A detailed metric breakdown isn’t included in this saved result. The overall score is still
      available above.
    </p>
  );
}

function Focus({ metrics }) {
  const entries = Object.entries(metrics || {}).filter(([, value]) => isNumber(value));
  if (entries.length < 2) return null;
  const minimum = Math.min(...entries.map(([, value]) => value));
  const maximum = Math.max(...entries.map(([, value]) => value));
  const lowest = entries.filter(([, value]) => value === minimum);
  const highest = entries.filter(([, value]) => value === maximum);
  return (
    <section className="va-workspace__takeaway" aria-label="Coaching takeaway">
      <h3>{minimum === maximum ? 'Build on a balanced result' : 'Where to focus'}</h3>
      <p>
        {minimum === maximum ? (
          `Your saved dimensions are evenly scored at ${minimum} / 5.`
        ) : (
          <>
            <strong>{lowest.map(([key]) => metricLabel(key)).join(' and ')}</strong>{' '}
            {lowest.length === 1
              ? 'is your lowest saved dimension'
              : 'are your lowest saved dimensions'}{' '}
            at {minimum} / 5.
          </>
        )}
      </p>
      {minimum !== maximum && (
        <p className="va-workspace__note">
          Highest saved: {highest.map(([key]) => metricLabel(key)).join(', ')} · {maximum} / 5.
        </p>
      )}
      <p className="va-workspace__note">
        Use the guidance above as a practice prompt. Nikki can help you talk through a concrete
        example.
      </p>
    </section>
  );
}

function Comparison({ workspace }) {
  const attempts = workspace.attempts || [];
  const [earlier, latest] = attempts;
  const rows = Object.keys(SETS).map((key) => [
    SETS[key],
    earlier?.setScores?.[key],
    latest?.setScores?.[key],
  ]);
  const change = workspace.change;
  return (
    <>
      <div className="va-workspace__comparison">
        {attempts.map((attempt) => (
          <div key={attempt.attemptNumber}>
            <Score value={attempt.scorePercentage} label={`Attempt ${attempt.attemptNumber}`} />
            {savedDate(attempt.completedAt) && (
              <time dateTime={attempt.completedAt}>{savedDate(attempt.completedAt)}</time>
            )}
          </div>
        ))}
      </div>
      {isNumber(change) && (
        <p
          className="va-workspace__difference"
          data-direction={change > 0 ? 'up' : change < 0 ? 'down' : 'same'}
        >
          <strong>{signed(change)}</strong> percentage points ·{' '}
          {change > 0
            ? 'Higher overall score'
            : change < 0
              ? 'Lower overall score'
              : 'Same overall score'}
        </p>
      )}
      <table className="va-workspace__comparison-table">
        <caption>Practice breakdown · scores out of 5</caption>
        <thead>
          <tr>
            <th scope="col">Assessment</th>
            <th scope="col">Earlier</th>
            <th scope="col">Latest</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, before, after]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{isNumber(before) ? before : '—'}</td>
              <td>{isNumber(after) ? after : '—'}</td>
              <td>{isNumber(before) && isNumber(after) ? signed(after - before) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="va-workspace__note">
        These attempts share the same role and difficulty. Their question sets may differ; a score
        change alone doesn’t explain why. These are repeatable practice attempts; your research
        pre-test and post-test stay saved separately.
      </p>
    </>
  );
}

const VoiceAgentWorkspace = forwardRef(function VoiceAgentWorkspace(
  { workspace, pending = false, error = '', onDismiss, onPractice, onRequest, onAsk, onRetry },
  ref
) {
  const reduced = useReducedMotion();
  const indicatorId = useId();
  const bodyRef = useRef(null);
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
      bodyRef.current.parentElement.scrollTop = 0;
    }
  }, [workspace?.id]);
  const isAssessment = ['scores', 'feedback'].includes(workspace?.view);
  const isAccountAssessment = isAssessment && ['preTest', 'postTest'].includes(workspace.section);
  const researchAssessment = isAccountAssessment ? RESEARCH_ASSESSMENTS[workspace.section] : null;
  const hasPracticeFeedback = isAssessment && Object.hasOwn(SETS, workspace.section);
  const activeView = isAccountAssessment ? 'scores' : workspace?.view;
  const steps = workspace?.steps || [];
  const filled = steps.filter((step) => step.text).length;
  const sourceDate = savedDate(workspace?.fetchedAt);
  const questions = workspace?.questions || [];
  return (
    <Motion.aside
      ref={ref}
      className="va-workspace"
      aria-label="Nikki workspace"
      aria-busy={pending}
      initial={
        reduced ? { opacity: 0 } : { opacity: 0, x: 16, clipPath: 'inset(0 6% 0 0 round 26px)' }
      }
      animate={
        reduced
          ? { opacity: 1, x: 0 }
          : { opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0 round 26px)' }
      }
      exit={{ opacity: 0, x: reduced ? 0 : 8, transition: { duration: reduced ? 0.1 : 0.16 } }}
      transition={{ duration: reduced ? 0.1 : 0.32, ease: EASE }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onDismiss();
        }
      }}
    >
      <header className="va-workspace__header">
        <span>
          <i aria-hidden="true" /> Nikki’s workspace
        </span>
        <button type="button" onClick={onDismiss} aria-label="Close workspace">
          <X size={18} />
        </button>
      </header>
      <Motion.nav
        className="va-workspace__views"
        aria-label="Workspace views"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { delayChildren: reduced ? 0 : 0.04, staggerChildren: reduced ? 0 : 0.025 },
          },
        }}
      >
        {VIEWS.map(([view, label]) => (
          <Motion.button
            type="button"
            key={view}
            aria-pressed={activeView === view}
            disabled={pending}
            onClick={() => onRequest(view)}
            variants={{ hidden: { opacity: 0, y: reduced ? 0 : 5 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: reduced ? 0.1 : 0.2, ease: EASE }}
          >
            {activeView === view && (
              <Motion.span
                className="va-workspace__view-indicator"
                layoutId={reduced ? undefined : `${indicatorId}-view`}
                transition={{ duration: 0.24, ease: EASE }}
                aria-hidden="true"
              />
            )}
            <span className="va-workspace__view-label">{label}</span>
          </Motion.button>
        ))}
      </Motion.nav>
      {pending && (
        <div className="va-workspace__updating" role="status">
          <LoaderCircle size={15} className="va-control-spinner" aria-hidden="true" />
          {workspace ? 'Updating your workspace…' : 'Putting your workspace together…'}
        </div>
      )}
      {error && (
        <div className="va-workspace__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={onRetry} disabled={pending}>
            <RefreshCw size={15} aria-hidden="true" /> Try again
          </button>
        </div>
      )}
      <div ref={bodyRef} className="va-workspace__body" tabIndex={0} aria-label="Workspace content">
        <AnimatePresence mode="wait" initial={false}>
          {workspace ? (
            <Motion.div
              key={workspace.id}
              className="va-workspace__page"
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ duration: reduced ? 0.1 : 0.2, ease: EASE }}
            >
              <h2>{workspace.title}</h2>
              <p className="va-workspace__subtitle">
                {researchAssessment?.subtitle || workspace.subtitle}
              </p>
              {researchAssessment && (
                <section
                  className="va-workspace__research"
                  aria-label="Research assessment purpose"
                >
                  <p>{researchAssessment.purpose}</p>
                  <p>
                    <strong>Fresh practice restarts only Sets 1–3.</strong> Your research scores and
                    confidence surveys stay saved, even if the post-test is unfinished. Unfinished
                    assessments resume from their saved answers.
                  </p>
                </section>
              )}
              {isAssessment && !isAccountAssessment && (
                <dl className="va-workspace__context">
                  <div>
                    <dt>Role</dt>
                    <dd>
                      {['preTest', 'postTest'].includes(workspace.section)
                        ? 'Not recorded for this assessment'
                        : workspace.role}
                    </dd>
                  </div>
                  <div>
                    <dt>Difficulty</dt>
                    <dd>{workspace.difficulty || 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt>Record</dt>
                    <dd>
                      {workspace.sourceKind === 'archived-attempt'
                        ? `Archived attempt ${workspace.attemptNumber ?? '—'}`
                        : workspace.sourceKind === 'assessment'
                          ? 'Saved assessment'
                          : 'Unavailable'}
                    </dd>
                  </div>
                </dl>
              )}
              {workspace.empty ? (
                <div className="va-workspace__empty">
                  <h3>No result to show yet</h3>
                  <p>{workspace.empty}</p>
                  <span>You can keep talking with Nikki or choose another workspace view.</span>
                </div>
              ) : (
                <>
                  {isAssessment && (
                    <>
                      <Score
                        value={workspace.scorePercentage}
                        label={researchAssessment?.scoreLabel || 'Saved practice score'}
                      />
                      <div className="va-workspace__section-heading">
                        <h3>Score breakdown</h3>
                        <span>Dimensions out of 5</span>
                      </div>
                      <Metrics metrics={workspace.metrics} showGuidance={!isAccountAssessment} />
                      {workspace.note && <p className="va-workspace__note">{workspace.note}</p>}
                      {hasPracticeFeedback && <Focus metrics={workspace.metrics} />}
                      {workspace.view === 'scores' && hasPracticeFeedback && (
                        <div className="va-workspace__actions">
                          <button
                            type="button"
                            onClick={() => onRequest('feedback')}
                            disabled={pending}
                          >
                            Review question feedback <ArrowRight size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequest('drill')}
                            disabled={pending}
                          >
                            Find a focused drill
                          </button>
                        </div>
                      )}
                      {workspace.view === 'feedback' && hasPracticeFeedback && (
                        <section aria-label="Question feedback">
                          <div className="va-workspace__section-heading">
                            <h3>Question feedback</h3>
                            <span>{questions.length} saved</span>
                          </div>
                          {questions.length ? (
                            <ol className="va-workspace__feedback">
                              {questions.map((question, index) => (
                                <li key={question.questionNumber ?? index}>
                                  <div>
                                    <h4>Question {question.questionNumber ?? index + 1}</h4>
                                    <strong>{percent(question.scorePercentage)}</strong>
                                  </div>
                                  <p>
                                    {question.feedback ||
                                      'No written feedback was saved for this question.'}
                                  </p>
                                  {Object.keys(question.metrics || {}).length > 0 && (
                                    <Metrics metrics={question.metrics} compact />
                                  )}
                                  <button
                                    className="va-workspace__text-action"
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                      onAsk(
                                        `Help me understand my saved feedback for Question ${question.questionNumber ?? index + 1} in ${workspace.title} for ${workspace.role}.`,
                                        { expectWorkspace: false }
                                      )
                                    }
                                  >
                                    Discuss this with Nikki{' '}
                                    <ArrowUpRight size={14} aria-hidden="true" />
                                  </button>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="va-workspace__note">
                              Question-level feedback isn’t available in this saved result. Nikki
                              can still explain the score summary.
                            </p>
                          )}
                        </section>
                      )}
                    </>
                  )}
                  {workspace.view === 'comparison' && <Comparison workspace={workspace} />}
                  {workspace.view === 'star' && (
                    <>
                      <div className="va-workspace__draft-status">
                        <strong>
                          {filled} of {steps.length} parts drafted
                        </strong>
                        <span>Conversation draft · not graded</span>
                      </div>
                      <p className="va-workspace__note">
                        Tell your story out loud. Nikki will use the details you share to build each
                        part; this draft won’t change your saved scores.
                      </p>
                      <ol className="va-workspace__story">
                        {steps.map(({ key, text }) => (
                          <li key={key} data-filled={Boolean(text)}>
                            <span>{STORY[key]?.[0]}</span>
                            <div>
                              <h3>{STORY[key]?.[1] || key}</h3>
                              <p>{text || STORY[key]?.[2]}</p>
                              {!text && <small>Tell Nikki this part</small>}
                            </div>
                          </li>
                        ))}
                      </ol>
                      <div className="va-workspace__actions">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            onAsk(
                              'Help me continue my STAR outline. Ask about the next missing part and show the updated draft using only the facts I share.'
                            )
                          }
                        >
                          Continue my story <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </>
                  )}
                  {workspace.view === 'drill' && (
                    <>
                      <div className="va-workspace__draft-status">
                        <strong>Focus: {metricLabel(workspace.focus)}</strong>
                        <span>Suggested rehearsal · not graded here</span>
                      </div>
                      <div className="va-workspace__section-heading">
                        <h3>Try this in your next answer</h3>
                      </div>
                      <ol className="va-workspace__checklist">
                        {workspace.checklist?.map((item, index) => (
                          <li key={item}>
                            <span>{index + 1}</span>
                            <p>{item}</p>
                          </li>
                        ))}
                      </ol>
                      <p className="va-workspace__note">
                        Rehearse aloud with Nikki, or open the practice studio to work on this
                        focus.
                      </p>
                      {workspace.practiceUrl ? (
                        <button
                          type="button"
                          className="va-workspace__practice"
                          onClick={() => onPractice(workspace.practiceUrl)}
                        >
                          Start practice <ArrowUpRight size={18} aria-hidden="true" />
                        </button>
                      ) : (
                        <p className="va-workspace__note">
                          Select this role in your dashboard before starting its practice.
                        </p>
                      )}
                      <p className="va-workspace__note">
                        Starting practice ends this voice conversation.
                      </p>
                    </>
                  )}
                </>
              )}
              {researchAssessment && (
                <details className="va-workspace__research-details">
                  <summary>Why these assessments are taken once</summary>
                  <div>
                    <h3>Interview quality · H₀₁</h3>
                    <p>
                      The pre-test and post-test measure Clarity, Correctness, and Completeness
                      before and after ITerview practice. The null hypothesis states that there is
                      no significant improvement in interview response quality.
                    </p>
                    <h3>Confidence · H₀₂</h3>
                    <p>
                      The separate before-and-after confidence surveys support testing whether
                      confidence improves. The null hypothesis states that there is no significant
                      improvement in confidence.
                    </p>
                    <p>
                      Keeping your original baseline preserves the starting point for the study.
                      Practice Sets 1–3 can be repeated. Your individual scores alone do not
                      establish statistical significance.
                    </p>
                  </div>
                </details>
              )}
            </Motion.div>
          ) : pending ? (
            <Motion.div
              key="loading"
              className="va-workspace__skeleton"
              aria-hidden="true"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <div />
              <div />
              <div />
              <div />
            </Motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <footer className="va-workspace__footer">
        <span>{workspace?.source || 'Your conversation with Nikki'}</span>
        <small>
          {workspace?.fetchedAt && workspace.view !== 'star'
            ? `Snapshot when this conversation started${sourceDate ? ` · ${sourceDate}` : ''}. Start another conversation with Nikki to refresh this view. Your saved progress stays unchanged.`
            : 'Keep talking. We’ll shape it together.'}
        </small>
      </footer>
    </Motion.aside>
  );
});

export default VoiceAgentWorkspace;
