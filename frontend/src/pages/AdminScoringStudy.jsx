import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, CircleCheck, FileText, UserRound } from 'lucide-react';
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

function RatingForm({ busy, rating, saving, error, hasNextQuestion, onCancel, onSave }) {
  const canAdvance = !rating && hasNextQuestion;

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
        <legend>{rating ? 'Correct HR rating' : 'HR rating'}</legend>
        <p className="admin-muted">1 · No usable evidence <span aria-hidden="true">/</span> 5 · Fully meets</p>
        <div className="scoring-criteria">
          {criteria.map(({ key, label }) => (
            <div className="scoring-criterion" role="radiogroup" aria-labelledby={`scoring-${key}-label`} key={key}>
              <span id={`scoring-${key}-label`}>{label}</span>
              <div className="scoring-options">
                {scoreAnchors.map(({ score, label: anchor }) => (
                  <label key={score} title={anchor}>
                    <input type="radio" name={key} value={score} required defaultChecked={rating?.[key] === score}
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
          {showAverage && <th scope="col">AI average</th>}
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
            {showAverage && <td>{(trials.reduce((sum, trial) => sum + trial[key], 0) / trials.length).toFixed(1)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SavedHrRating({ response, busy, headingRef, showAverage, onToggleComparison, onNext, onCorrect }) {
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
  const [showHrComparison, setShowHrComparison] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [pending, setPending] = useState('');
  const action = useRef(null);
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
  const aiReady = responses.filter((item) => item.trialsSaved === cohort.trialCount).length;
  const paired = responses.filter((item) => item.rated && item.trialsSaved > 0).length;
  const busy = refreshing || Boolean(pending);
  const savingRating = pending === 'Saving correction…' || pending === 'Saving HR rating…';

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

  function choose(id, focusQuestion = false) {
    if (id === selectedId) return;
    focusQuestionAfterLoad.current = focusQuestion;
    setSelectedId(id);
    setDetail(null);
    setRatingEdit(null);
    setShowHrComparison(false);
    setError('');
  }

  function refreshStudy() {
    setError('');
    setDetail(null);
    setRatingEdit(null);
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
    const data = ratingEdit ? { ...values, revision: ratingEdit.revision } : values;
    perform(ratingEdit ? 'Saving correction…' : 'Saving HR rating…', async (request, signal) => {
      focusSavedRatingAfterSave.current = !(advance && nextQuestion);
      try {
        const saved = await saveResponse('rating', data, request, signal, ratingEdit ? 'PATCH' : 'POST');
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
    <button type="button" className="admin-action scoring-refresh" disabled={busy} onClick={refreshStudy}>
      {refreshing ? 'Refreshing…' : hrOnly ? 'Refresh responses' : 'Refresh study'}
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
        {error && !ratingFormOpen && <p className="admin-error" role="alert">{error}</p>}
        {!cohort && !error && <p role="status" className="admin-muted">Loading completed pre-test responses…</p>}
        {cohort && !responses.length && <p className="admin-muted">Saved answers appear here after a student completes the pre-test.</p>}
        {!!responses.length && (
          <div className="scoring-toolbar">
            <div className="scoring-selection">
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
                    if (value !== selected?.participantKey) choose(responsesByParticipant.get(value)?.[0].id ?? '');
                  }} />
              </div>
              <div className="scoring-field">
                <label id="scoring-response-label" htmlFor="scoring-response">Saved response</label>
                <DashboardRoleSelect id="scoring-response" labelledBy="scoring-response-label"
                  icon={FileText} value={selected?.id ?? ''} disabled={!selected || busy}
                  options={selected ? questionOptions.map((item) => ({
                    value: item.id,
                    label: hrOnly ? `Question ${item.questionIndex + 1} · ${item.rated ? 'Rated' : 'To rate'}`
                      : `Question ${item.questionIndex + 1} · AI ${item.trialsSaved}/${cohort.trialCount}${item.rated ? ' · HR rated' : ''}`,
                  })) : [{ value: '', label: 'Choose a participant first', disabled: true }]}
                  onChange={choose} />
              </div>
            </div>
          </div>
        )}
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
                <h3 id={hrOnly ? 'hr-rating-transcript' : undefined}>Student transcript</h3>
                <blockquote tabIndex={hrOnly ? 0 : undefined} aria-labelledby={hrOnly ? 'hr-rating-transcript' : undefined}>
                  {response.transcript}
                </blockquote>
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
                    }} onNext={nextQuestion ? () => choose(nextQuestion.id, true) : undefined} onCorrect={() => {
                      setError('');
                      setRatingEdit({ rating: response.rating, revision: response.ratingRevision });
                    }} />
                ) : <RatingForm busy={busy} rating={ratingEdit?.rating} saving={savingRating} error={error}
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
        {hrOnly && !refreshing && refreshButton}
      </div>
    </section>
  );
}
