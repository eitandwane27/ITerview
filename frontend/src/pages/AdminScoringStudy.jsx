import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, CircleCheck, FileText, RefreshCw, UserRound } from 'lucide-react';
import DashboardRoleSelect from '../components/DashboardRoleSelect';
import adminRequest from '../utils/adminRequest';

const criteria = [
  { key: 'clarity_score', label: 'Clarity', description: 'How understandable and organized the response is.' },
  { key: 'correctness_score', label: 'Correctness', description: 'How accurate and relevant the statements are.' },
  { key: 'completeness_score', label: 'Completeness', description: 'How fully the response covers what the question asked.' },
];
// Rater-facing wording for the entry-level evaluator rubric in backend/config/evaluatorRubrics.js.
const scoreAnchors = [
  { score: 1, label: 'No usable evidence', description: 'Nothing to credit for this criterion.' },
  { score: 2, label: 'Limited evidence', description: 'A little to credit, with major gaps or errors.' },
  { score: 3, label: 'Partly meets', description: 'Meets part of the requirement, with a gap or error that matters.' },
  { score: 4, label: 'Mostly meets', description: 'Meets the main requirement, with a small gap or error.' },
  { score: 5, label: 'Fully meets', description: 'A short answer can earn full marks.' },
];

function participantLabel(response) {
  return response.participantId ? `Participant ${response.participantId}` : `Participant ${response.participantKey}`;
}

function responsePath(response) {
  return `/scoring-study/${response.assessmentId}/${response.questionIndex}`;
}

function saveCsv(csv) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'iterview-scoring-study.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RatingRubric() {
  return (
    <details className="scoring-rubric">
      <summary><BookOpen size={17} aria-hidden="true" /> 3C scoring rubric <ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="scoring-rubric-content">
        <section>
          <h3>What to score</h3>
          <p>Use the standard for a fresh IT graduate. Score each criterion independently using the transcript.</p>
          <dl>
            {criteria.map(({ key, label, description }) => (
              <div key={key}><dt>{label}</dt><dd>{description}</dd></div>
            ))}
          </dl>
        </section>
        <section>
          <h3>Score levels</h3>
          <dl className="scoring-rubric-anchors">
            {scoreAnchors.map(({ score, label, description }) => (
              <div key={score}>
                <dt><span className="scoring-rubric-number">{score}</span><span>{label}</span></dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </details>
  );
}

function RatingTranscript({ transcript }) {
  const transcriptRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const box = transcriptRef.current;
    const updateClipping = () => {
      const resizing = box.getAnimations().some((animation) => animation.transitionProperty === 'max-height');
      if (!resizing && !box.hasAttribute('data-expanded')) setClipped(box.scrollHeight > box.clientHeight + 1);
    };
    const observer = new ResizeObserver(updateClipping);
    observer.observe(box);
    observer.observe(box.firstElementChild);
    box.addEventListener('transitionend', updateClipping);
    return () => {
      observer.disconnect();
      box.removeEventListener('transitionend', updateClipping);
    };
  }, []);

  return (
    <>
      <div className="scoring-transcript-heading">
        <h3 id="hr-rating-transcript">Student transcript</h3>
        {(clipped || expanded) && <button type="button" className="admin-action scoring-transcript-toggle"
          aria-controls="hr-rating-transcript-text" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
          {expanded ? 'Collapse transcript' : 'Expand transcript'}
          <ChevronDown size={15} aria-hidden="true" />
        </button>}
      </div>
      <blockquote ref={transcriptRef} id="hr-rating-transcript-text" tabIndex={0} aria-labelledby="hr-rating-transcript"
        data-expanded={expanded || undefined}>
        <div>{transcript}</div>
      </blockquote>
    </>
  );
}

function RatingForm({ busy, rating, draft, focusAfterReopen, saving, error, hasNextQuestion, onCancel, onSave, onReset }) {
  const canAdvance = !rating && hasNextQuestion;
  const [scores, setScores] = useState(rating ?? draft ?? {});
  const firstOption = useRef(null);
  const focusAfterReset = useRef(focusAfterReopen);
  const hasSavedScores = Boolean(rating || criteria.some(({ key }) => draft?.[key]));

  useEffect(() => {
    if (!busy && focusAfterReset.current) {
      firstOption.current?.focus();
      focusAfterReset.current = false;
    }
  }, [busy, scores]);

  function resetRating() {
    if (hasSavedScores) {
      onReset();
      return;
    }
    focusAfterReset.current = true;
    setScores({});
  }

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      scores: Object.fromEntries(criteria.map(({ key }) => [key, Number(form.get(key))])),
    }, event.nativeEvent.submitter?.value === 'next');
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="scoring-fields">
        <legend>{rating ? 'Correct HR rating' : draft ? 'Reopened HR rating' : 'HR rating'}</legend>
        {draft && <p className="admin-muted" role="status">Fill in any missing scores and save to mark this response as rated again.</p>}
        <p className="admin-muted">Score each criterion from 1 (no usable evidence) to 5 (fully meets).</p>
        <div className="scoring-criteria">
          {criteria.map(({ key, label, description }) => (
            <div className="scoring-criterion" role="radiogroup" aria-labelledby={`scoring-${key}-label`}
              aria-describedby={`scoring-${key}-description`} key={key}>
              <div className="scoring-criterion-label">
                <span id={`scoring-${key}-label`}>{label}</span>
                <p id={`scoring-${key}-description`} className="admin-muted">{description}</p>
              </div>
              <div className="scoring-options">
                {scoreAnchors.map(({ score, label: anchor }) => (
                  <label key={score} title={anchor}>
                    <input type="radio" name={key} value={score} required checked={scores[key] === score}
                      onChange={() => setScores((current) => ({ ...current, [key]: score }))}
                      ref={key === criteria[0].key && score === 1 ? firstOption : undefined}
                      autoFocus={key === criteria[0].key && rating?.[key] === score}
                      aria-label={`${score} · ${anchor}`} />
                    <span aria-hidden="true">{score}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="scoring-rating-actions">
          {canAdvance && (
            <button type="submit" value="next" className="rs-btn-primary research-export">
              {saving ? 'Saving…' : 'Save & next'} <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
          <button type="submit" className={`${canAdvance ? 'rs-btn-secondary' : 'rs-btn-primary'} research-export`}>
            {saving && !canAdvance ? 'Saving…' : rating ? 'Save correction' : 'Save HR rating'}
          </button>
          {rating && <button type="button" className="rs-btn-secondary research-export" onClick={onCancel}>Cancel</button>}
          <button type="button" className="admin-action scoring-reset-link" aria-haspopup={hasSavedScores ? 'dialog' : undefined}
            disabled={!hasSavedScores && !criteria.some(({ key }) => scores[key])} onClick={resetRating}>Reset rating</button>
        </div>
      </fieldset>
    </form>
  );
}

function ScoreTable({ id, trials, rating, trialCount = 0, showAverage = false }) {
  const label = showAverage ? 'HR and AI average scores out of five'
    : trialCount ? (rating ? 'AI trials and HR scores out of five' : 'AI trial scores out of five') : 'HR scores out of five';
  return (
    <table id={id} className="scoring-results" aria-label={label}>
      <thead>
        <tr>
          <th scope="col">Criterion</th>
          {Array.from({ length: trialCount }, (_, index) => <th key={index} scope="col">Trial {index + 1}</th>)}
          {rating && <th scope="col">{trialCount || showAverage ? 'HR' : 'Score / 5'}</th>}
          {showAverage && <th scope="col" className="scoring-ai-average">AI average</th>}
        </tr>
      </thead>
      <tbody>
        {criteria.map(({ key, label }) => (
          <tr key={key}>
            <th scope="row">{label}</th>
            {Array.from({ length: trialCount }, (_, index) => (
              <td key={index}>{trials[index]?.[key] ?? '—'}</td>
            ))}
            {rating && <td>{rating[key]}</td>}
            {showAverage && <td className="scoring-ai-average">{(trials.reduce((sum, trial) => sum + trial[key], 0) / trials.length).toFixed(1)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SavedHrRating({ response, busy, headingRef, showAverage, onToggleComparison, onNext, onCorrect, onReset }) {
  const { rating, ratingRevision, trials } = response;

  return (
    <>
      <div className="scoring-saved-header">
        <div role="status">
          <h3 tabIndex={-1} ref={headingRef}>Saved HR rating</h3>
          {ratingRevision > 0 && <p className="admin-muted">Prior ratings are kept in the study record.</p>}
        </div>
        {trials.length > 0 && (
          <button type="button" className="admin-action scoring-compare" disabled={busy}
            aria-expanded={showAverage} aria-controls="saved-hr-scores" onClick={onToggleComparison}>
            Compare with AI <ChevronDown size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <ScoreTable id="saved-hr-scores" rating={rating} trials={trials} showAverage={showAverage} />
      {showAverage && <p className="admin-muted scoring-ai-note">Average of {trials.length} saved AI {trials.length === 1 ? 'trial' : 'trials'}.</p>}
      <div className="scoring-rating-actions">
        {onNext && (
          <button type="button" className="rs-btn-primary research-export" disabled={busy} onClick={onNext}>
            Next question <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="admin-action" disabled={busy} onClick={onCorrect}>Correct HR rating</button>
        <button type="button" className="admin-action scoring-reset-link" aria-haspopup="dialog" disabled={busy} onClick={onReset}>
          Reset rating
        </button>
      </div>
      {trials.length === 0 && <p className="admin-muted scoring-ai-empty">No AI scores are saved for this response yet.</p>}
    </>
  );
}

export function AdminHrRatings({ user }) {
  return <AdminScoringStudy user={user} hrOnly />;
}

export default function AdminScoringStudy({ user, hrOnly = false }) {
  const [cohort, setCohort] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [ratingEdit, setRatingEdit] = useState(null);
  const [focusAfterReopen, setFocusAfterReopen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showHrComparison, setShowHrComparison] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [pending, setPending] = useState('');
  const action = useRef(null);
  const resetDialog = useRef(null);
  const focusQuestionAfterLoad = useRef(false);
  const focusSavedRatingAfterSave = useRef(false);
  const responses = cohort?.responses ?? [];
  const selected = responses.find(({ id }) => id === selectedId);
  const path = selected ? responsePath(selected) : '';
  const response = detail?.id === selected?.id ? detail : null;
  const ratingFormOpen = hrOnly && response && (!response.rating || ratingEdit);
  const showingUnratedTrials = !response?.rating && Boolean(response?.trials.length);
  const responsesByParticipant = new Map();
  for (const item of responses) {
    if (!responsesByParticipant.has(item.participantKey)) responsesByParticipant.set(item.participantKey, []);
    responsesByParticipant.get(item.participantKey).push(item);
  }
  const questionOptions = responsesByParticipant.get(selected?.participantKey) ?? [];
  const nextQuestion = selected && questionOptions[questionOptions.indexOf(selected) + 1];
  const progressResponses = selected ? questionOptions : responses;
  const ratedCount = progressResponses.filter(({ rated }) => rated).length;
  const aiReady = responses.filter((item) => item.trialsSaved === cohort.trialCount).length;
  const paired = responses.filter((item) => item.rated && item.trialsSaved > 0).length;
  const busy = refreshing || Boolean(pending);
  const savingRating = pending === 'Saving correction…' || pending === 'Saving HR rating…';
  const resettingRating = pending === 'Resetting rating…';

  useEffect(() => {
    const controller = new AbortController();
    adminRequest(user, '/scoring-study', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then((data) => { if (!controller.signal.aborted) setCohort(data); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setRefreshing(false); });
    return () => controller.abort();
  }, [user, refresh]);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    adminRequest(user, path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(({ response: result }) => {
        if (!controller.signal.aborted && result.id === selectedId) setDetail(result);
        else if (!controller.signal.aborted) setError('The response changed. Refresh the study and select it again.');
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [user, path, refresh, selectedId]);

  useEffect(() => () => action.current?.abort(), []);

  useLayoutEffect(() => {
    if (confirmReset) resetDialog.current?.showModal();
  }, [confirmReset]);

  function choose(id, focusQuestion = false) {
    if (id === selectedId) return;
    focusQuestionAfterLoad.current = focusQuestion;
    setSelectedId(id);
    setDetail(null);
    setRatingEdit(null);
    setFocusAfterReopen(false);
    setShowHrComparison(false);
    setError('');
  }

  function refreshStudy() {
    setError('');
    setDetail(null);
    setRatingEdit(null);
    setFocusAfterReopen(false);
    setShowHrComparison(false);
    setRefreshing(true);
    setRefresh((value) => value + 1);
  }

  async function perform(label, work) {
    if (action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setPending(label);
    setError('');
    const request = (endpoint, options) => adminRequest(user, endpoint, {
      ...options, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(27000)]),
    });
    try {
      await work(request, controller.signal);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.name === 'TimeoutError'
        ? 'The request timed out. Refresh the study to check what was saved.' : failure.message);
    } finally {
      if (!controller.signal.aborted) setPending('');
      action.current = null;
    }
  }

  async function saveResponse(kind, values, request, signal, method = 'POST') {
    const query = kind === 'trial' && showingUnratedTrials ? '?showTrials=1' : '';
    const { response: saved } = await request(`${path}/${kind}${query}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: response.id, ...values }),
    });
    if (!signal.aborted) {
      setDetail(saved);
      setCohort((current) => ({
        ...current,
        responses: current.responses.map((item) => item.id === saved.id
          ? { ...item, trialsSaved: saved.trialsSaved, rated: saved.rated } : item),
      }));
    }
    return saved;
  }

  function saveHrRating(values, advance) {
    const revision = ratingEdit?.revision ?? (response.ratingDraft ? response.ratingRevision : null);
    const data = revision === null ? values : { ...values, revision };
    perform(ratingEdit ? 'Saving correction…' : 'Saving HR rating…', async (request, signal) => {
      focusSavedRatingAfterSave.current = !(advance && nextQuestion);
      try {
        const saved = await saveResponse('rating', data, request, signal, revision === null ? 'POST' : 'PATCH');
        if (signal.aborted) return;
        if (ratingEdit) {
          setShowHrComparison(saved.trials.length > 0);
          setRatingEdit(null);
        }
      } catch (failure) {
        focusSavedRatingAfterSave.current = false;
        throw failure;
      }
      if (advance && nextQuestion) choose(nextQuestion.id, true);
    });
  }

  function openResetConfirmation() {
    setError('');
    setConfirmReset(true);
  }

  function closeResetConfirmation() {
    resetDialog.current.close();
    setConfirmReset(false);
    setError('');
  }

  function resetHrRating() {
    perform('Resetting rating…', async (request, signal) => {
      await saveResponse('rating/reset', { revision: response.ratingRevision }, request, signal);
      if (signal.aborted) return;
      closeResetConfirmation();
      setFocusAfterReopen(true);
      setRatingEdit(null);
      setShowHrComparison(false);
    });
  }

  function toggleTrialResults() {
    if (showingUnratedTrials) {
      setDetail({ ...response, trials: [] });
      return;
    }
    perform('Loading AI results…', async (request, signal) => {
      const { response: loaded } = await request(`${path}?showTrials=1`);
      if (loaded.id !== response.id) throw new Error('The response changed. Refresh the study and select it again.');
      if (!signal.aborted) setDetail(loaded);
    });
  }

  const refreshButton = (
    <button type="button" className="admin-action scoring-refresh" aria-label={hrOnly && !refreshing ? 'Refresh responses' : undefined}
      data-refreshing={hrOnly && refreshing || undefined} disabled={busy} onClick={refreshStudy}>
      {hrOnly && <RefreshCw size={15} aria-hidden="true" />}
      {refreshing ? 'Refreshing…' : hrOnly ? 'Refresh' : 'Refresh study'}
    </button>
  );

  return (
    <section className={`admin-roster scoring-study${hrOnly ? ' scoring-study--ratings' : ''}`}
      aria-label={hrOnly ? 'HR rating workspace' : '3C scoring study'}>
      {!hrOnly && <div className="admin-toolbar research-toolbar">
        <p className="admin-count" role="status">
          {cohort && `AI trials complete for ${aiReady} of ${responses.length} responses · ${paired} AI–HR pairs`}
        </p>
        <div className="research-export-actions">
          {refreshButton}
          <button type="button" className="rs-btn-secondary research-export"
            disabled={busy || !responses.some((item) => item.rated || item.trialsSaved)}
            onClick={() => perform('Exporting CSV…', async (request, signal) => {
              const { csv } = await request('/scoring-study/export');
              if (!signal.aborted) saveCsv(csv);
            })}>Export scores CSV</button>
        </div>
      </div>}
      <div className="scoring-body">
        {(responses.length > 0 || (hrOnly && (cohort || error))) && (
          <div className="scoring-toolbar">
            {!!responses.length && <div className="scoring-selection">
              <div className="scoring-field">
                <label id="scoring-participant-label" htmlFor="scoring-participant">Participant</label>
                <DashboardRoleSelect id="scoring-participant" labelledBy="scoring-participant-label"
                  icon={UserRound} value={selected?.participantKey ?? ''} disabled={busy}
                  menuClassName={hrOnly ? 'scoring-participants-menu' : undefined}
                  options={[
                    selected ? { value: 'clear', label: 'Clear participant' }
                      : { value: '', label: 'Choose a participant', disabled: true },
                    ...Array.from(responsesByParticipant, ([value, items]) => {
                      const ratedQuestions = new Set(items.filter(({ rated }) => rated).map(({ questionIndex }) => questionIndex));
                      return {
                        value, label: participantLabel(items[0]),
                        status: hrOnly && ratedQuestions.size === 5 ? (
                          <span className="scoring-participant-completed"><CircleCheck size={14} aria-hidden="true" /> Completed</span>
                        ) : undefined,
                      };
                    }),
                  ]}
                  onChange={(value) => {
                    if (value === selected?.participantKey) return;
                    const items = responsesByParticipant.get(value) ?? [];
                    const firstUnrated = hrOnly ? items.find(({ rated }) => !rated) : undefined;
                    choose((firstUnrated ?? items[0])?.id ?? '');
                  }} />
              </div>
              <div className="scoring-field">
                <label id="scoring-response-label" htmlFor="scoring-response">{hrOnly ? 'Question' : 'Saved response'}</label>
                <DashboardRoleSelect id="scoring-response" labelledBy="scoring-response-label"
                  icon={FileText} value={selected?.id ?? ''} disabled={!selected || busy}
                  options={selected ? questionOptions.map((item) => ({
                    value: item.id,
                    label: hrOnly ? `Question ${item.questionIndex + 1} · ${item.rated ? 'Rated' : 'To rate'}`
                      : `Question ${item.questionIndex + 1} · AI ${item.trialsSaved}/${cohort.trialCount}${item.rated ? ' · HR rated' : ''}`,
                  })) : [{ value: '', label: 'Choose a participant first', disabled: true }]}
                  onChange={choose} />
              </div>
            </div>}
            {hrOnly && <div className="scoring-queue-meta">
              {progressResponses.length > 0 && <div className="scoring-progress">
                <p role="status"><strong>{ratedCount} of {progressResponses.length}</strong> responses rated{selected ? '' : ' overall'}</p>
                <div className="scoring-progress-track">
                  <progress max={progressResponses.length} value={ratedCount} aria-label={selected ? 'Participant rating progress' : 'Overall rating progress'} />
                  <span key={selected?.participantKey ?? 'overall'} aria-hidden="true"
                    style={{ '--scoring-progress': ratedCount / progressResponses.length }} />
                </div>
              </div>}
              {refreshButton}
            </div>}
          </div>
        )}
        {error && !confirmReset && !ratingFormOpen && <p className="admin-error" role="alert">{error}</p>}
        {!cohort && !error && <p role="status" className="admin-muted">Loading completed pre-test responses…</p>}
        {cohort && !responses.length && <p className="admin-muted">Saved answers appear here after a student completes the pre-test.</p>}
        {selected && !response && !error && <p role="status" className="admin-muted">Loading saved response…</p>}
        {hrOnly && cohort && !selected && !!responses.length && <p className="admin-muted">Choose a participant to start rating.</p>}
        <div className="scoring-response">
          {response && (
            <div className="scoring-evidence">
              <div className="scoring-question" key={response.id}>
                <h2 tabIndex={hrOnly ? -1 : undefined} ref={(heading) => {
                  if (heading && focusQuestionAfterLoad.current) {
                    focusQuestionAfterLoad.current = false;
                    heading.focus();
                  }
                }}>Question {response.questionIndex + 1}</h2>
                <p>{response.question}</p>
                {hrOnly ? <RatingTranscript transcript={response.transcript} /> : <>
                  <h3>Student transcript</h3>
                  <blockquote>{response.transcript}</blockquote>
                </>}
              </div>
            </div>
          )}
          {response && (hrOnly ? (
              <div className="scoring-task scoring-rating" key={response.id}>
                {response.rating && !ratingEdit ? (
                  <SavedHrRating response={response} busy={busy} showAverage={showHrComparison}
                    onToggleComparison={() => setShowHrComparison((visible) => !visible)}
                    headingRef={(heading) => {
                      if (heading && focusSavedRatingAfterSave.current) {
                        focusSavedRatingAfterSave.current = false;
                        heading.focus();
                      }
                    }} onNext={nextQuestion ? () => choose(nextQuestion.id, true) : undefined} onReset={openResetConfirmation} onCorrect={() => {
                      setError('');
                      setFocusAfterReopen(false);
                      setRatingEdit({ rating: response.rating, revision: response.ratingRevision });
                    }} />
                ) : <RatingForm key={response.ratingRevision} busy={busy} rating={ratingEdit?.rating} draft={response.ratingDraft}
                  focusAfterReopen={focusAfterReopen} saving={savingRating} error={confirmReset ? '' : error} onReset={openResetConfirmation}
                  hasNextQuestion={Boolean(nextQuestion)} onCancel={() => {
                    focusSavedRatingAfterSave.current = true;
                    setRatingEdit(null);
                    setError('');
                  }} onSave={saveHrRating} />}
              </div>
            ) : (
              <div className="scoring-trials scoring-task">
                <h3>AI repeat scoring</h3>
                <p className="admin-muted">Each trial scores this exact question and transcript using the same entry-level rubric.</p>
                {response.trialsSaved < cohort.trialCount && (
                  <button type="button" className="rs-btn-secondary research-export"
                    disabled={busy}
                    onClick={() => perform('Running AI trials…', async (request, signal) => {
                      let saved = response;
                      while (!signal.aborted && saved.trialsSaved < cohort.trialCount) {
                        saved = await saveResponse('trial', { trial: saved.trialsSaved + 1 }, request, signal);
                      }
                    })}>{response.trialsSaved ? 'Run remaining AI trials' : 'Run AI trials'}</button>
                )}
                <p role="status" className="admin-muted">{response.trialsSaved} of {cohort.trialCount} AI trials saved. {pending}</p>
                {!response.rating && response.trialsSaved > 0 && (
                  <button type="button" className="admin-action" disabled={busy}
                    aria-expanded={showingUnratedTrials} onClick={toggleTrialResults}>
                    {showingUnratedTrials ? 'Hide AI results' : 'Show AI results'}
                  </button>
                )}
                {(response.rating || response.trials.length > 0) && <ScoreTable trials={response.trials}
                  rating={response.rating} trialCount={cohort.trialCount} />}
              </div>
          ))}
          {hrOnly && <RatingRubric />}
        </div>
      </div>
      {hrOnly && response && <dialog ref={resetDialog} className="admin-dialog scoring-reset-dialog" inert={!confirmReset}
        aria-labelledby="scoring-reset-title" aria-describedby="scoring-reset-description" aria-busy={resettingRating || undefined}
        onCancel={(event) => {
          event.preventDefault();
          if (!resettingRating) closeResetConfirmation();
        }}>
        <form onSubmit={(event) => {
          event.preventDefault();
          resetHrRating();
        }}>
          <h2 id="scoring-reset-title">Reset this rating?</h2>
          <p className="scoring-reset-context">{participantLabel(response)} · Question {response.questionIndex + 1}</p>
          <p id="scoring-reset-description">All three scores will be cleared, and the response will return to <strong>To rate</strong>. Its HR scores will be left out of exports until it’s rated again.</p>
          {confirmReset && error && <p className="admin-error" role="alert">{error}</p>}
          <div className="admin-dialog-actions">
            <button type="button" className="rs-btn-secondary" disabled={resettingRating} onClick={closeResetConfirmation}>Keep rating</button>
            <button type="submit" className="rs-btn-primary scoring-danger" aria-disabled={resettingRating || undefined}>
              {resettingRating ? 'Resetting…' : 'Reset rating'}
            </button>
          </div>
        </form>
      </dialog>}
    </section>
  );
}
