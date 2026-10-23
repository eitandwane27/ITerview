import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSavedQuestions, removePracticeQuestion, restorePracticeQuestion } from '../utils/practiceAgainApi';
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion as Motion,
  useReducedMotion,
} from 'framer-motion';
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  Lightbulb,
  Mic,
  Search,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import './DashboardPracticeAgain.css';
import { EASE } from './motion/motion';
import { formatRoleLabel } from '../utils/roleCatalogue';

const setLabel = (set) =>
  `Set ${set} · ${{ 1: 'Personalized', 2: 'Technical', 3: 'Behavioral' }[set] || 'Practice'}`;

function PracticeTipDialog({ question, onDismiss, onStart }) {
  const dialogRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const main = dialog.closest('.db-main');
    const previousBodyOverflow = document.body.style.overflow;
    const previousMainOverflow = main?.style.overflowY;
    document.body.style.overflow = 'hidden';
    if (main) main.style.overflowY = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousBodyOverflow;
      if (main) main.style.overflowY = previousMainOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  return (
    <Motion.dialog
      ref={dialogRef}
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98, y: reduceMotion ? 0 : 8 }}
      transition={{ duration: reduceMotion ? 0 : 0.25, ease: EASE }}
      className="pa-dialog"
      aria-labelledby="pa-dialog-title"
      aria-describedby="pa-dialog-question"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (
          !buttons.includes(document.activeElement) ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onDismiss();
      }}
    >
      <div className="pa-dialog__header">
        <div className="pa-dialog__identity">
          <RotateCcw size={18} aria-hidden="true" />
          <h2 id="pa-dialog-title">Practice again</h2>
        </div>
        <button
          type="button"
          className="pa-icon-button"
          aria-label="Close practice dialog"
          onClick={onDismiss}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="pa-dialog__body">
        <section className="pa-dialog__question" aria-labelledby="pa-dialog-question">
          <h3 id="pa-dialog-question">{question.text}</h3>
          <p className="pa-dialog__meta">
            <span className="pa-dialog__role">{question.roleLabel}</span>
            <span>{setLabel(question.set)}</span>
            <span className="pa-difficulty" data-level={question.difficulty.toLowerCase()}>
              {question.difficulty}
            </span>
          </p>
        </section>
        <section className="pa-dialog__coaching" aria-labelledby="pa-dialog-tip-title">
          <h3 id="pa-dialog-tip-title">
            <Lightbulb size={18} aria-hidden="true" />A tip for your next try
          </h3>
          <p>{question.tip}</p>
        </section>
      </div>
      <div className="pa-dialog__footer">
        <p className="pa-dialog__reassurance">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Your original interview score stays the same.</span>
        </p>
        <div className="pa-dialog__action">
          <button
            type="button"
            className="pa-practice-button pa-practice-button--primary"
            onClick={() => onStart(question)}
          >
            <Mic size={18} aria-hidden="true" />
            Start practice
          </button>
          <span>One question · Voice practice</span>
        </div>
      </div>
    </Motion.dialog>
  );
}

export default function DashboardPracticeAgain({ active, roles }) {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const updatingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const loadQuestions = useCallback(async (signal) => {
    setStatus('loading');
    setError('');
    try {
      const saved = await loadSavedQuestions({ signal });
      if (signal?.aborted || !mountedRef.current) return;
      setQuestions(saved);
      setStatus('ready');
    } catch (cause) {
      if (signal?.aborted || !mountedRef.current) return;
      setError(cause.message);
      setStatus('error');
    }
  }, []);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    loadQuestions(controller.signal);
    return () => controller.abort();
  }, [active, loadQuestions]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [setFilter, setSetFilter] = useState('all');
  const [focusedId, setFocusedId] = useState(null);
  const [tipExpanded, setTipExpanded] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [removedQuestion, setRemovedQuestion] = useState(null);
  const labelledQuestions = questions.map((question) => ({
    ...question,
    roleLabel:
      roles.find((role) => role.id === question.role)?.label ||
      question.roleLabel ||
      formatRoleLabel(question.role),
  }));
  const roleOptions = [...new Set(labelledQuestions.map((question) => question.role))]
    .map((role) => ({
      value: role,
      label: labelledQuestions.find((question) => question.role === role).roleLabel,
      count: questions.filter((question) => question.role === role).length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  // Keep a selected role available after its last question is removed, so the
  // empty state and Undo never silently switch the user's filter.
  const selectedRoleLabel =
    roleOptions.find((role) => role.value === roleFilter)?.label ||
    (removedQuestion?.role === roleFilter ? removedQuestion.roleLabel : null) ||
    formatRoleLabel(roleFilter, roles);
  const query = search.trim().toLowerCase();
  const matchingQuestions = labelledQuestions.filter(
    (question) =>
      (roleFilter === 'all' || question.role === roleFilter) &&
      (!query ||
        `${question.text} ${setLabel(question.set)} ${question.roleLabel} ${question.difficulty}`
          .toLowerCase()
          .includes(query))
  );
  const filteredQuestions = matchingQuestions.filter(
    (question) => setFilter === 'all' || String(question.set) === setFilter
  );

  const focusedQuestion =
    filteredQuestions.find((question) => question.id === focusedId) || filteredQuestions[0];
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 400, damping: 36, mass: 0.8 };
  const filters = [
    { value: 'all', label: 'All', count: matchingQuestions.length },
    ...[1, 2, 3].map((set) => ({
      value: String(set),
      label: `Set ${set}`,
      count: matchingQuestions.filter((question) => question.set === set).length,
    })),
  ];
  const nextQuestion = () => {
    const index = filteredQuestions.findIndex((question) => question.id === focusedQuestion?.id);
    setFocusedId(filteredQuestions[(index + 1) % filteredQuestions.length]?.id);
  };

  const removeQuestion = async (question) => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setIsUpdating(true);
    setError('');
    try {
      await removePracticeQuestion(question.id);
      if (!mountedRef.current) return;
      setQuestions((current) => current.filter((item) => item.id !== question.id));
      setRemovedQuestion(question);
    } catch (cause) { if (mountedRef.current) setError(cause.message); }
    finally {
      updatingRef.current = false;
      if (mountedRef.current) setIsUpdating(false);
    }
  };

  const undoRemoval = async () => {
    if (!removedQuestion || updatingRef.current) return;
    updatingRef.current = true;
    setIsUpdating(true);
    setError('');
    try {
      const question = await restorePracticeQuestion(removedQuestion.id);
      if (!mountedRef.current) return;
      setQuestions(current => [question, ...current.filter(item => item.id !== question.id)]
        .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)));
      setRemovedQuestion(null);
    } catch (cause) { if (mountedRef.current) setError(cause.message); }
    finally {
      updatingRef.current = false;
      if (mountedRef.current) setIsUpdating(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user" transition={transition}>
      <LayoutGroup id="practice-again">
        <section className="pa-screen" aria-labelledby="pa-title">
          <header className="pa-header">
            <div>
              <h1 id="pa-title">Practice Again</h1>
              <p className="pa-header__subtitle">A little more practice. A stronger next answer.</p>
            </div>
            <span className="pa-score-note">
              <ShieldCheck size={17} aria-hidden="true" /> Your scores stay unchanged
            </span>
          </header>

          <div className="pa-workspace">
            <div className="pa-library">
              <div className="pa-library__header">
                <div>
                  <h2>
                    Saved questions <span className="pa-count">{questions.length}</span>
                  </h2>
                  <p>Revisit your interview questions by role or set.</p>
                </div>
                <Bookmark size={18} aria-hidden="true" />
              </div>
              <div className="pa-toolbar">
                <label className="pa-search">
                  <Search size={17} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Find a saved question"
                    placeholder="Search your questions…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <div className="pa-filter-row">
                  <label className="pa-role-filter">
                    <span>Role</span>
                    <span className="pa-role-filter__control">
                      <select
                        aria-label="Filter saved questions by role"
                        value={roleFilter}
                        onChange={(event) => setRoleFilter(event.target.value)}
                      >
                        <option value="all">All roles ({questions.length})</option>
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label} ({role.count})
                          </option>
                        ))}
                        {roleFilter !== 'all' &&
                          !roleOptions.some((role) => role.value === roleFilter) && (
                            <option value={roleFilter}>{selectedRoleLabel} (0)</option>
                          )}
                      </select>
                      <ChevronDown size={16} aria-hidden="true" />
                    </span>
                  </label>
                  <fieldset className="pa-set-filter">
                    <legend>Interview set</legend>
                    <div className="pa-filters">
                      {filters.map((filter) => (
                        <button
                          type="button"
                          key={filter.value}
                          aria-label={`${filter.label === 'all' || filter.value === 'all' ? 'All sets' : filter.label}, ${filter.count} ${filter.count === 1 ? 'question' : 'questions'}`}
                          aria-pressed={setFilter === filter.value}
                          onClick={() => setSetFilter(filter.value)}
                        >
                          {setFilter === filter.value && (
                            <Motion.span
                              layoutId="pa-filter-indicator"
                              className="pa-filters__indicator"
                              transition={transition}
                            />
                          )}
                          <span className="pa-filters__label">{filter.label}</span>
                          <span className="pa-filters__count">{filter.count}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>

              <p className="pa-sr-only" role="status">
                {filteredQuestions.length} saved{' '}
                {filteredQuestions.length === 1 ? 'question' : 'questions'} shown.
              </p>
              <div className="pa-list-heading">
                <span>Question</span>
                <span>Revisit</span>
              </div>
              {status === 'loading' ? (
                <div className="pa-empty" role="status">Loading your saved questions…</div>
              ) : status === 'error' ? (
                <div className="pa-empty">
                  <p role="alert">{error}</p>
                  <button type="button" className="pa-practice-button" onClick={() => loadQuestions()}>Try again</button>
                </div>
              ) : filteredQuestions.length > 0 ? (
                <Motion.ul layout={reduceMotion ? false : 'position'} className="pa-questions">
                  <AnimatePresence initial={false} mode="popLayout">
                    {filteredQuestions.map((question) => (
                      <Motion.li
                        layout={reduceMotion ? false : 'position'}
                        key={question.id}
                        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: reduceMotion ? 0 : -16 }}
                        transition={transition}
                        className={`pa-question${focusedQuestion?.id === question.id ? ' pa-question--selected' : ''}`}
                      >
                        <div className="pa-question__body">
                          <button
                            type="button"
                            className="pa-question__select"
                            aria-label={`Show tip: ${question.text}`}
                            aria-pressed={focusedQuestion?.id === question.id}
                            onClick={() => {
                              setFocusedId(question.id);
                              setTipExpanded(true);
                            }}
                          >
                            {question.text}
                          </button>
                          <div className="pa-question__meta">
                            <span className="pa-question__role">{question.roleLabel}</span>
                            <span>{setLabel(question.set)}</span>
                            <span
                              className="pa-difficulty"
                              data-level={question.difficulty.toLowerCase()}
                            >
                              {question.difficulty}
                            </span>
                          </div>
                        </div>
                        <div className="pa-question__actions">
                          <button
                            type="button"
                            className="pa-row-practice"
                            aria-label={`Practice: ${question.text}`}
                            onClick={() => setSelectedQuestion(question)}
                          >
                            Practice <ArrowRight size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="pa-icon-button pa-question__remove"
                            aria-label={`Remove saved question: ${question.text}`}
                            disabled={isUpdating}
                            onClick={() => removeQuestion(question)}
                          >
                            <Bookmark size={17} aria-hidden="true" />
                          </button>
                        </div>
                      </Motion.li>
                    ))}
                  </AnimatePresence>
                </Motion.ul>
              ) : (
                <div className="pa-empty">
                  {questions.length > 0 ? (
                    <Search size={28} aria-hidden="true" />
                  ) : (
                    <Bookmark size={28} aria-hidden="true" />
                  )}
                  <h3>
                    {questions.length > 0 ? 'No matching questions' : 'No saved questions yet'}
                  </h3>
                  <p>
                    {questions.length > 0
                      ? 'Try a different role, set, or search term.'
                      : 'Save a question during your interview to find it here.'}
                  </p>
                  {questions.length > 0 && (
                    <button
                      type="button"
                      className="pa-practice-button"
                      onClick={() => {
                        setSearch('');
                        setRoleFilter('all');
                        setSetFilter('all');
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
              <div className="pa-library__footer">
                <span>
                  {filteredQuestions.length} of {questions.length} questions
                </span>
                <span>
                  {roleFilter === 'all'
                    ? `All roles · ${roleOptions.length} ${roleOptions.length === 1 ? 'role' : 'roles'}`
                    : selectedRoleLabel}
                </span>
              </div>
            </div>

            <aside
              className={`pa-focus${tipExpanded ? ' pa-focus--expanded' : ''}`}
              aria-label="Your next try"
            >
              <button
                className="pa-focus__toggle"
                type="button"
                aria-expanded={tipExpanded}
                aria-controls="pa-focus-content"
                onClick={() => setTipExpanded((current) => !current)}
              >
                <Lightbulb size={17} aria-hidden="true" />
                <span>A tip for your next try</span>
                <ChevronDown size={17} aria-hidden="true" />
              </button>
              <div className="pa-focus__content" id="pa-focus-content">
                <div className="pa-focus__heading">
                  <RotateCcw size={18} aria-hidden="true" />
                  <h2>Your next try</h2>
                </div>
                <p className="pa-focus__intro">Same question. A fresh perspective.</p>
                <AnimatePresence mode="wait" initial={false}>
                  <Motion.div
                    key={focusedQuestion?.id || 'empty'}
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                    transition={{ duration: reduceMotion ? 0 : 0.13 }}
                  >
                    {focusedQuestion ? (
                      <>
                        <div className="pa-focus__question">
                          <span className="pa-focus__role">{focusedQuestion.roleLabel}</span>
                          <span>{setLabel(focusedQuestion.set)}</span>
                          <p>{focusedQuestion.text}</p>
                        </div>
                        <div className="pa-focus__tip">
                          <h3>
                            <Lightbulb size={16} aria-hidden="true" /> Try this approach
                          </h3>
                          <p>{focusedQuestion.tip}</p>
                        </div>
                        <button
                          className="pa-practice-button pa-practice-button--primary"
                          type="button"
                          onClick={() => setSelectedQuestion(focusedQuestion)}
                        >
                          Give it another try <ArrowRight size={17} aria-hidden="true" />
                        </button>
                        <button
                          className="pa-next-button"
                          type="button"
                          onClick={nextQuestion}
                          disabled={filteredQuestions.length < 2}
                        >
                          Try another question <RotateCcw size={14} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <p className="pa-focus__empty">
                        {questions.length
                          ? 'Clear your filters to find your next question.'
                          : 'Your next practice starts with a saved question.'}
                      </p>
                    )}
                  </Motion.div>
                </AnimatePresence>
                <div className="pa-focus__reassurance">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>
                    Room to practice, without the pressure. Your original interview scores stay the
                    same.
                  </p>
                </div>
              </div>
              <div className="pa-save-note">
                <Bookmark size={17} aria-hidden="true" />
                <p>
                  One worth revisiting?
                  <br />
                  <span>Bookmark questions during an interview to keep them here.</span>
                </p>
              </div>
            </aside>
          </div>
          <footer className="pa-footer">
            <p>Saved to your account. Practice answers and feedback do not change your assessment scores.</p>
            {status !== 'error' && error && <p role="alert">{error}</p>}
          </footer>

          <AnimatePresence>
            {active && removedQuestion && (
              <Motion.div
                key="undo"
                className="pa-undo"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 18, scale: reduceMotion ? 1 : 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                transition={transition}
              >
                <Check size={17} aria-hidden="true" />
                <span role="status">Question removed from your library.</span>
                <button type="button" onClick={undoRemoval} disabled={isUpdating}>
                  Undo
                </button>
                <button
                  type="button"
                  className="pa-icon-button"
                  aria-label="Dismiss removal notification"
                  onClick={() => setRemovedQuestion(null)}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </Motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {active && selectedQuestion && (
              <PracticeTipDialog
                key={selectedQuestion.id}
                question={selectedQuestion}
                onDismiss={() => setSelectedQuestion(null)}
                onStart={(question) => navigate(`/interview?set=${question.set}&questionId=${encodeURIComponent(question.id)}&autostart=true`)}
              />
            )}
          </AnimatePresence>
        </section>
      </LayoutGroup>
    </MotionConfig>
  );
}
