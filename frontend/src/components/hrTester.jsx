import { useEffect, useRef, useState } from 'react';
import { Check, Copy, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';
import useRoleCatalogue from '../hooks/useRoleCatalogue';
import logoSrc from '../assets/logo';
import './hrTester.css';

// Behavioral practice uses one profile and has no difficulty selection.
const QUESTION_SETS = [
  {
    id: 1,
    label: 'Personalized 3C',
    endpoint: 'generate-question',
    description: 'Targets the lowest pre-test 3C score',
  },
  {
    id: 2,
    label: 'Technical',
    endpoint: 'generate-question-s2',
    description: 'Technical mastery · role-specific knowledge',
  },
  {
    id: 3,
    label: 'Behavioral',
    endpoint: 'generate-question-s3',
    description: 'Past experiences · STAR framework',
  },
];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const FOCUS_OPTIONS = [
  {
    value: 'focus_clarity',
    label: 'Clarity',
    description: 'Questions that practice explaining a concept clearly.',
  },
  {
    value: 'focus_correctness',
    label: 'Correctness',
    description: 'Questions that practice accurate facts and definitions.',
  },
  {
    value: 'focus_completeness',
    label: 'Completeness',
    description: 'Questions that practice covering multiple related points.',
  },
];
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export default function HrTester() {
  const { roles, status: roleStatus, retry: retryRoles } = useRoleCatalogue();
  const [selectedRole, setSelectedRole] = useState('');
  const [selection, setSelection] = useState({ setId: 1, difficulty: 'medium' });
  const [focus, setFocus] = useState('focus_completeness');
  const [generation, setGeneration] = useState({ status: 'idle', results: [], error: '' });
  const [copyStatus, setCopyStatus] = useState('');
  const requestRef = useRef(null);
  const mainRef = useRef(null);
  const copyTimer = useRef(null);
  const selectedSet = QUESTION_SETS.find((set) => set.id === selection.setId);
  const selectedFocus = FOCUS_OPTIONS.find((option) => option.value === focus);
  const role = selectedRole || roles[0]?.id || '';
  const roleLabel = roles.find((item) => item.id === role)?.label || '';
  const supportedDifficulties = (setId) =>
    roles.find((item) => item.id === role)?.supportedDifficulties?.[`set${setId}`] || DIFFICULTIES;
  const selectionLabel = `Set ${selectedSet.id} · ${selectedSet.label}${selectedSet.id === 3 ? '' : ` · ${capitalize(selection.difficulty)}`}`;
  const loading = generation.status === 'loading';
  const ready = roleStatus === 'ready' && !!role;
  const canGenerateSelection = selectedSet.id === 3 || ready;
  const successfulResults = generation.results.filter((result) => result.question && !result.error);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      clearTimeout(copyTimer.current);
    },
    []
  );

  useEffect(() => {
    if (generation.status !== 'loading' || !window.matchMedia('(max-width: 960px)').matches) return;
    mainRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
  }, [generation]);

  function resetResults() {
    requestRef.current?.abort();
    requestRef.current = null;
    clearTimeout(copyTimer.current);
    setGeneration({ status: 'idle', results: [], error: '' });
    setCopyStatus('');
  }

  async function generateQuestions(nextSelection = selection) {
    const questionSet = QUESTION_SETS.find((set) => set.id === nextSelection.setId);
    if (questionSet.id !== 3 && !ready) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const supported = supportedDifficulties(questionSet.id);
    const difficulty =
      questionSet.id === 3
        ? undefined
        : supported.includes(nextSelection.difficulty)
          ? nextSelection.difficulty
          : supported[0];
    const params = new URLSearchParams({ runs: '5' });
    if (questionSet.id === 3) params.set('startIndex', '0');
    else {
      params.set('role', role);
      params.set('difficulty', difficulty);
    }
    if (questionSet.id === 1) params.set('weakness', focus);
    setSelection(questionSet.id === 3 ? { setId: 3 } : { ...nextSelection, difficulty });
    clearTimeout(copyTimer.current);
    setCopyStatus('');
    setGeneration({ status: 'loading', results: [], error: '' });
    // Five sequential AI calls can take longer than an ordinary REST request.
    const timeout = setTimeout(() => controller.abort('timeout'), 300000);
    try {
      const response = await fetch(`/api/debug/${questionSet.endpoint}?${params}`, {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(`Question generation failed (HTTP ${response.status}). Please try again.`);
      const data = await response.json();
      if (
        !Array.isArray(data.results) ||
        data.results.length === 0 ||
        data.results.some(
          (result) =>
            !result ||
            (result.question != null && typeof result.question !== 'string') ||
            (result.error != null && typeof result.error !== 'string') ||
            !(result.question?.trim() || result.error?.trim()) ||
            (result.competency != null && typeof result.competency !== 'string')
        )
      ) {
        throw new Error('The server returned no usable questions. Please try again.');
      }
      if (requestRef.current !== controller) return;
      const actualDifficulty = DIFFICULTIES.includes(data.params?.difficulty)
        ? data.params.difficulty
        : difficulty;
      setSelection(
        questionSet.id === 3 ? { setId: 3 } : { ...nextSelection, difficulty: actualDifficulty }
      );
      setGeneration({ status: 'done', results: data.results, error: '', generatedAt: new Date() });
    } catch (error) {
      if (requestRef.current !== controller) return;
      setGeneration({
        status: 'error',
        results: [],
        error: controller.signal.aborted
          ? 'Generation took too long. Please try again.'
          : error instanceof TypeError
            ? 'Could not reach the question service. Check that the backend is running, then try again.'
            : error.message,
      });
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  function cancelGeneration() {
    resetResults();
    setGeneration({ status: 'idle', results: [], error: '', cancelled: true });
  }

  async function copyQuestions() {
    const heading = `${selectionLabel}${selectedSet.id !== 3 ? ` · ${roleLabel}` : ''}${selectedSet.id === 1 ? ` · ${selectedFocus.label}` : ''}`;
    const text = `${heading}\n\n${successfulResults.map((result) => `${result.index}. ${result.question}`).join('\n\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopyStatus(''), 2500);
    } catch {
      setCopyStatus('error');
    }
  }

  const metadata = loading
    ? 'Generating five questions…'
    : generation.generatedAt
      ? `Generated at ${generation.generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Five questions per set';

  return (
    <div className="hr-tester">
      <header className="hr-tester__header">
        <div className="hr-tester__heading">
          <img className="hr-tester__logo" src={logoSrc} alt="ITerview" />
          <div>
            <h1>Question Review Studio</h1>
            <p>Generate question sets for verbal HR evaluation</p>
          </div>
        </div>
        <span className="hr-tester__badge">Internal</span>
      </header>

      <div className="hr-tester__workspace">
        <aside className="hr-tester__sidebar" aria-label="Question generation settings">
          <h2>Question sets</h2>
          <p className="hr-tester__intro">Generate a set to review five interview questions</p>

          <div className="hr-tester__field">
            <label htmlFor="hr-tester-role">Target role</label>
            <select
              id="hr-tester-role"
              value={role}
              disabled={roleStatus !== 'ready'}
              aria-describedby="hr-tester-role-status"
              onChange={(event) => {
                resetResults();
                setSelectedRole(event.target.value);
              }}
            >
              {roleStatus !== 'ready' && (
                <option value="">
                  {roleStatus === 'loading' ? 'Loading roles…' : 'Roles unavailable'}
                </option>
              )}
              {roles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <div id="hr-tester-role-status" className="hr-tester__field-note" aria-live="polite">
              {roleStatus === 'error' ? (
                <>
                  <span>Could not load roles.</span>{' '}
                  <Button variant="ghost" onClick={retryRoles}>
                    Retry roles
                  </Button>
                </>
              ) : selectedSet.id === 3 ? (
                'Behavioral questions apply to all roles.'
              ) : (
                'Used for personalized 3C and technical questions.'
              )}
            </div>
          </div>

          <div className="hr-tester__sets">
            {QUESTION_SETS.map((set) => (
              <section
                key={set.id}
                className="hr-tester__set"
                data-selected={selection.setId === set.id}
                aria-labelledby={`hr-set-${set.id}`}
              >
                <div className="hr-tester__set-heading">
                  <h3 id={`hr-set-${set.id}`}>{set.label}</h3>
                  <span>Set {set.id}</span>
                </div>
                <p className="hr-tester__set-description">{set.description}</p>
                {set.id === 1 && (
                  <fieldset className="hr-tester__focus" aria-describedby="hr-3c-help">
                    <legend>3C focus</legend>
                    <p id="hr-3c-help" className="hr-tester__field-note">
                      Simulate the student's pre-test weakness.
                    </p>
                    <div className="hr-tester__focus-options">
                      {FOCUS_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className="hr-tester__focus-option"
                          data-focus={option.value}
                        >
                          <input
                            type="radio"
                            name="hr-3c-focus"
                            value={option.value}
                            checked={focus === option.value}
                            onChange={() => {
                              resetResults();
                              setFocus(option.value);
                              setSelection({ ...selection, setId: 1 });
                            }}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="hr-tester__field-note" aria-live="polite">
                      {selectedFocus.description}
                    </p>
                  </fieldset>
                )}
                {set.id === 3 ? (
                  <Button
                    variant="outline"
                    className={`hr-tester__behavioral hr-tester__difficulty${selection.setId === 3 ? ' is-selected' : ''}`}
                    aria-pressed={selection.setId === 3}
                    onClick={() => generateQuestions({ setId: 3 })}
                  >
                    Generate behavioral questions
                  </Button>
                ) : (
                  <div
                    className="hr-tester__difficulties"
                    role="group"
                    aria-label={`${set.label} difficulty`}
                  >
                    {DIFFICULTIES.map((difficulty) => (
                      <Button
                        key={difficulty}
                        variant="outline"
                        className={
                          selection.setId === set.id && selection.difficulty === difficulty
                            ? 'hr-tester__difficulty is-selected'
                            : 'hr-tester__difficulty'
                        }
                        disabled={
                          (set.id !== 3 && !ready) ||
                          !supportedDifficulties(set.id).includes(difficulty)
                        }
                        aria-pressed={
                          selection.setId === set.id && selection.difficulty === difficulty
                        }
                        aria-label={`${set.label} ${capitalize(difficulty)}`}
                        onClick={() => generateQuestions({ setId: set.id, difficulty })}
                      >
                        {capitalize(difficulty)}
                      </Button>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </aside>

        <main className="hr-tester__main" ref={mainRef}>
          <div className="hr-tester__toolbar">
            <div className="hr-tester__title">
              <h2>Generated Questions</h2>
              <p className="hr-tester__metadata">
                <span>{selectionLabel}</span>
                <span>{metadata}</span>
              </p>
              {selectedSet.id !== 3 && roleLabel && (
                <p className="hr-tester__context">
                  {roleLabel}
                  {selectedSet.id === 1 ? ` · ${selectedFocus.label}` : ''}
                </p>
              )}
            </div>
            <div className="hr-tester__actions">
              {loading ? (
                <Button variant="outline" onClick={cancelGeneration}>
                  <X size={20} aria-hidden="true" />
                  Cancel
                </Button>
              ) : (
                <Button disabled={!canGenerateSelection} onClick={() => generateQuestions()}>
                  <RefreshCw size={20} aria-hidden="true" />
                  {generation.status === 'done' ? 'Regenerate' : 'Generate questions'}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={loading || successfulResults.length === 0}
                onClick={copyQuestions}
              >
                {copyStatus === 'copied' ? (
                  <Check size={20} aria-hidden="true" />
                ) : (
                  <Copy size={20} aria-hidden="true" />
                )}
                {copyStatus === 'copied' ? 'Copied!' : 'Copy all'}
              </Button>
            </div>
          </div>

          <div className="hr-tester__announcement" role="status">
            {copyStatus === 'copied' ? 'Questions copied to clipboard.' : ''}
            {generation.status === 'done'
              ? `${successfulResults.length} of ${generation.results.length} questions generated.`
              : ''}
          </div>
          {copyStatus === 'error' && (
            <p className="hr-tester__error" role="alert">
              Could not copy to the clipboard. Select the question text and copy it manually.
            </p>
          )}

          <section
            className="hr-tester__questions"
            aria-label="Generated question list"
            aria-busy={loading}
          >
            {loading ? (
              <div className="hr-tester__empty" role="status">
                <LoaderCircle className="hr-tester__spinner" size={28} aria-hidden="true" />
                <h3>Preparing your question set</h3>
                <p>Generating five fresh questions in sequence. This may take a few minutes.</p>
              </div>
            ) : generation.status === 'error' ? (
              <div className="hr-tester__empty" role="alert">
                <h3>Questions could not be generated</h3>
                <p>{generation.error}</p>
                <Button
                  variant="outline"
                  disabled={!canGenerateSelection}
                  onClick={() => generateQuestions()}
                >
                  <RefreshCw size={18} aria-hidden="true" />
                  Try again
                </Button>
              </div>
            ) : generation.status === 'done' ? (
              <>
                {successfulResults.length < generation.results.length && (
                  <p className="hr-tester__error" role="alert">
                    {generation.results.length - successfulResults.length} question(s) could not be
                    generated. Regenerate to try again.
                  </p>
                )}
                <ol className="hr-tester__question-list">
                  {generation.results.map((result, index) => (
                    <li key={`${result.index}-${index}`} className="hr-tester__question">
                      <span className="hr-tester__number" aria-hidden="true">
                        {String(result.index ?? index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        {result.competency && (
                          <p className="hr-tester__competency">{result.competency}</p>
                        )}
                        {result.question && !result.error ? (
                          <p className="hr-tester__question-text">{result.question}</p>
                        ) : (
                          <p className="hr-tester__question-error">
                            This question could not be generated.{' '}
                            {result.error || 'Please regenerate the set.'}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <div className="hr-tester__empty">
                <h3>
                  {generation.cancelled
                    ? 'Generation cancelled'
                    : 'Your next interview starts here'}
                </h3>
                <p>
                  {generation.cancelled
                    ? 'Choose a set or generate again when you’re ready.'
                    : 'Choose a role and difficulty for technical practice, or generate a behavioral set.'}
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
