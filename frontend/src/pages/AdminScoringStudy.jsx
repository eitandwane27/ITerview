import { useEffect, useRef, useState } from 'react';
import { FileText, UserRound } from 'lucide-react';
import DashboardRoleSelect from '../components/DashboardRoleSelect';
import adminRequest from '../utils/adminRequest';

const criteria = [
  { key: 'clarity_score', label: 'Clarity', description: 'How easy the answer is to follow.' },
  { key: 'correctness_score', label: 'Correctness', description: 'How accurate and relevant it is.' },
  { key: 'completeness_score', label: 'Completeness', description: 'How fully it covers what was asked.' },
];
const scoreOptions = [
  { value: '', label: 'Select score', disabled: true },
  ...['1', '2', '3', '4', '5'].map((value) => ({ value, label: value })),
];

const studyTabs = [
  { id: 'ai', label: 'H₀₃ · AI trials' },
  { id: 'hr', label: 'H₀₄ · HR ratings' },
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

function RatingForm({ busy, rating, saving, onCancel, onSave }) {
  const [scores, setScores] = useState(() => Object.fromEntries(
    criteria.map(({ key }) => [key, String(rating?.[key] ?? '')])
  ));
  const [showErrors, setShowErrors] = useState(false);

  function submit(event) {
    event.preventDefault();
    const missing = criteria.find(({ key }) => !scores[key]);
    if (missing) {
      setShowErrors(true);
      event.currentTarget.querySelector(`#scoring-${missing.key}`).focus();
      return;
    }
    const form = new FormData(event.currentTarget);
    onSave({
      raterCode: form.get('raterCode').trim(),
      scores: Object.fromEntries(criteria.map(({ key }) => [key, Number(scores[key])])),
    });
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="scoring-fields">
        <legend>{rating ? 'Correct HR rating' : 'HR rating'}</legend>
        {rating ? <p>Use the HR specialist’s recorded scores to correct the entry.</p> : (
          <>
            <p>Have the HR specialist rate the transcript independently on the entry-level 3C rubric.</p>
            <p className="admin-muted">1 = no usable evidence, 2 = limited, 3 = partial, 4 = mostly meets the criterion, 5 = fully meets it.</p>
          </>
        )}
        <div className="scoring-field scoring-rater">
          <label htmlFor="scoring-rater">Rater code</label>
          <input id="scoring-rater" name="raterCode" required maxLength={32} defaultValue={rating?.raterCode ?? ''}
            pattern={String.raw`[A-Za-z0-9][A-Za-z0-9_\-]*`} placeholder="e.g. HR01" aria-describedby="scoring-rater-hint" />
          <span id="scoring-rater-hint" className="admin-muted">Use the same code for each response this specialist rates.</span>
        </div>
        <div className="scoring-criteria">
          {criteria.map(({ key, label, description }) => (
            <div className="scoring-field" key={key}>
              <label id={`scoring-${key}-label`} htmlFor={`scoring-${key}`}>{label}</label>
              <DashboardRoleSelect id={`scoring-${key}`} labelledBy={`scoring-${key}-label`}
                describedBy={`scoring-${key}-hint`} icon={null} required disabled={busy}
                options={scoreOptions} value={scores[key]} invalid={showErrors && !scores[key]}
                autoFocus={Boolean(rating) && key === 'clarity_score'}
                onChange={(value) => setScores((current) => ({ ...current, [key]: value }))} />
              <span id={`scoring-${key}-hint`} className="admin-muted">{description}</span>
            </div>
          ))}
        </div>
        {showErrors && criteria.some(({ key }) => !scores[key]) && (
          <p className="admin-error" role="alert">Choose a score for each criterion.</p>
        )}
        {!rating && <p className="admin-muted">Saving reveals the AI scores for this response.</p>}
        <div className="research-export-actions">
          <button type="submit" className="rs-btn-primary research-export">
            {saving ? 'Saving…' : rating ? 'Save correction' : 'Save HR rating'}
          </button>
          {rating && <button type="button" className="rs-btn-secondary research-export" onClick={onCancel}>Cancel</button>}
        </div>
      </fieldset>
    </form>
  );
}

function ScoreTable({ trials, rating, trialCount }) {
  return (
    <table className="scoring-results" aria-label={rating ? 'AI trials and HR scores out of five' : 'AI trial scores out of five'}>
      <thead>
        <tr>
          <th scope="col">Criterion</th>
          {Array.from({ length: trialCount }, (_, index) => <th key={index} scope="col">Trial {index + 1}</th>)}
          {rating && <th scope="col">HR</th>}
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminScoringStudy({ user }) {
  const [tab, setTab] = useState('ai');
  const [cohort, setCohort] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [ratingEdit, setRatingEdit] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [pending, setPending] = useState('');
  const action = useRef(null);
  const responses = cohort?.responses ?? [];
  const selected = responses.find(({ id }) => id === selectedId);
  const path = selected ? responsePath(selected) : '';
  const response = detail?.id === selected?.id ? detail : null;
  const showingUnratedTrials = !response?.rating && Boolean(response?.trials.length);
  const firstByParticipant = new Map();
  for (const item of responses) {
    if (!firstByParticipant.has(item.participantKey)) firstByParticipant.set(item.participantKey, item);
  }
  const questionOptions = responses.filter((item) => item.participantKey === selected?.participantKey);
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

  function choose(id) {
    if (id === selectedId) return;
    setSelectedId(id);
    setDetail(null);
    setRatingEdit(null);
    setError('');
  }

  function handleTabKeys(event) {
    const target = {
      ArrowLeft: tab === 'ai' ? 'hr' : 'ai',
      ArrowRight: tab === 'ai' ? 'hr' : 'ai',
      Home: 'ai',
      End: 'hr',
    }[event.key];
    if (!target) return;
    event.preventDefault();
    setTab(target);
    event.currentTarget.querySelector(`#scoring-tab-${target}`).focus();
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

  function saveHrRating(values) {
    const data = ratingEdit ? { ...values, revision: ratingEdit.revision } : values;
    perform(ratingEdit ? 'Saving correction…' : 'Saving HR rating…', async (request, signal) => {
      await saveResponse('rating', data, request, signal, ratingEdit ? 'PATCH' : 'POST');
      if (ratingEdit && !signal.aborted) setRatingEdit(null);
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

  return (
    <section className="admin-roster scoring-study" aria-label="3C scoring study">
      <div className="admin-toolbar research-toolbar">
        <p className="admin-count" role="status">
          {cohort && `AI trials complete for ${aiReady} of ${responses.length} responses · ${paired} AI–HR pairs`}
        </p>
        <div className="research-export-actions">
          <button type="button" className="admin-action" disabled={busy} onClick={() => {
            setError('');
            setDetail(null);
            setRatingEdit(null);
            setRefreshing(true);
            setRefresh((value) => value + 1);
          }}>{refreshing ? 'Refreshing…' : 'Refresh study'}</button>
          <button type="button" className="rs-btn-secondary research-export"
            disabled={busy || !responses.some((item) => item.rated || item.trialsSaved)}
            onClick={() => perform('Exporting CSV…', async (request, signal) => {
              const { csv } = await request('/scoring-study/export');
              if (!signal.aborted) saveCsv(csv);
            })}>Export scores CSV</button>
        </div>
      </div>
      <div className="scoring-body">
        <div className="scoring-tabs" role="tablist" aria-label="Scoring study hypotheses" onKeyDown={handleTabKeys}>
          {studyTabs.map(({ id, label }) => (
            <button key={id} id={`scoring-tab-${id}`} type="button" role="tab"
              aria-selected={tab === id} aria-controls={`scoring-panel-${id}`}
              tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {!cohort && !error && <p role="status" className="admin-muted">Loading completed pre-test responses…</p>}
        {cohort && !responses.length && <p className="admin-muted">Saved answers appear here after a student completes the pre-test.</p>}
        {!!responses.length && (
          <>
            <div className="scoring-selection">
              <div className="scoring-field">
                <label id="scoring-participant-label" htmlFor="scoring-participant">Participant</label>
                <DashboardRoleSelect id="scoring-participant" labelledBy="scoring-participant-label"
                  icon={UserRound} value={selected?.participantKey ?? ''} disabled={busy}
                  options={[
                    selected ? { value: 'clear', label: 'Clear participant' }
                      : { value: '', label: 'Choose a participant', disabled: true },
                    ...Array.from(firstByParticipant, ([value, item]) => ({ value, label: participantLabel(item) })),
                  ]}
                  onChange={(value) => {
                    if (value !== selected?.participantKey) choose(firstByParticipant.get(value)?.id ?? '');
                  }} />
              </div>
              <div className="scoring-field">
                <label id="scoring-response-label" htmlFor="scoring-response">Saved response</label>
                <DashboardRoleSelect id="scoring-response" labelledBy="scoring-response-label"
                  icon={FileText} value={selected?.id ?? ''} disabled={!selected || busy}
                  options={selected ? questionOptions.map((item) => ({
                    value: item.id,
                    label: `Question ${item.questionIndex + 1} · AI ${item.trialsSaved}/${cohort.trialCount}${item.rated ? ' · HR rated' : ''}`,
                  })) : [{ value: '', label: 'Choose a participant first', disabled: true }]}
                  onChange={choose} />
              </div>
            </div>
            {selected && !response && !error && <p role="status" className="admin-muted">Loading saved response…</p>}
          </>
        )}
        <div className="scoring-response">
          {response && (
            <div className="scoring-evidence" key={response.id}>
              <h2>Question {response.questionIndex + 1}</h2>
              <p>{response.question}</p>
              <h3>Student transcript</h3>
              <blockquote>{response.transcript}</blockquote>
            </div>
          )}
          <div id="scoring-panel-ai" role="tabpanel" aria-labelledby="scoring-tab-ai"
            tabIndex={response ? 0 : undefined} hidden={tab !== 'ai'}>
            {response && (
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
                {response.trials.length > 0 && <ScoreTable trials={response.trials} trialCount={cohort.trialCount} />}
              </div>
            )}
          </div>
          <div id="scoring-panel-hr" role="tabpanel" aria-labelledby="scoring-tab-hr"
            tabIndex={response ? 0 : undefined} hidden={tab !== 'hr'}>
            {response && (
              <div className="scoring-task" key={response.id}>
                {response.rating && !ratingEdit ? (
                  <>
                    <h3>AI–HR comparison</h3>
                    <p className="admin-muted" role="status">
                      HR rating saved under {response.rating.raterCode}.
                      {response.ratingRevision > 0 && ' Prior ratings are kept in the study record.'}
                    </p>
                    <ScoreTable trials={response.trials} rating={response.rating} trialCount={cohort.trialCount} />
                    <button type="button" className="admin-action" disabled={busy} onClick={() => {
                      setError('');
                      setRatingEdit({ rating: response.rating, revision: response.ratingRevision });
                    }}>Correct HR rating</button>
                  </>
                ) : <RatingForm busy={busy} rating={ratingEdit?.rating} saving={savingRating} onCancel={() => {
                  setRatingEdit(null);
                  setError('');
                }} onSave={saveHrRating} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
