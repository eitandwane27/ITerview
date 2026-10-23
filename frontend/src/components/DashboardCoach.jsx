import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import AssistantReply from './AssistantReply';
import { authenticatedFetch } from '../utils/authenticatedApi';
import { normalizeAssistantSources } from '../utils/assistantSources';
import mascotHead from '../assets/mascot-head.png';
import './DashboardCoach.css';

const MAX_MESSAGE_LENGTH = 600;
const NEXT_STEPS = {
  'likert-pre': 'Complete your confidence check',
  'mic-test': 'Check your microphone',
  pretest: 'Complete your one-time pre-test',
  mainsets: 'Continue your practice sets',
  posttest: 'Complete your one-time post-test',
  'likert-post': 'Complete your final confidence check',
  complete: 'Continue with practice sets',
};
const starters = [
  {
    icon: TrendingUp,
    label: 'Explain my progress',
    description: 'Find the story behind your scores',
    message: 'Explain my saved progress and what my metrics mean.',
  },
  {
    icon: Target,
    label: 'What should I practice next?',
    description: 'Turn your results into a clear next step',
    message: 'What should I practice next based on my saved results?',
  },
  {
    icon: BookOpen,
    label: 'Give me a practice drill',
    description: 'Work on one answer, one skill at a time',
    message:
      'Give me one short practice drill for my weakest assessed area. If I have no results yet, suggest a beginner drill.',
  },
];
const welcome = {
  role: 'assistant',
  content:
    'Let’s turn your practice results into a next step. Ask about your scores, work through an interview answer, or build a short practice plan.',
};
const percentage = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'Not yet';

export default function DashboardCoach({ active }) {
  const [context, setContext] = useState(null);
  const [contextStatus, setContextStatus] = useState('loading');
  const [messages, setMessages] = useState([welcome]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const requestRef = useRef(null);
  const contextRequestRef = useRef(null);
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const followThreadRef = useRef(true);
  const isNewConversation = messages.length === 1;
  const showProgress = progressExpanded || contextStatus === 'error';

  const refreshContext = useCallback(async () => {
    contextRequestRef.current?.abort();
    const controller = new AbortController();
    contextRequestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setContextStatus('loading');
    try {
      const response = await authenticatedFetch('/api/coach/context', {
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !data.context) throw new Error('Progress could not be loaded');
      if (contextRequestRef.current !== controller) return;
      setContext(data.context);
      setContextStatus('ready');
    } catch {
      if (contextRequestRef.current === controller) setContextStatus('error');
    } finally {
      window.clearTimeout(timeout);
      if (contextRequestRef.current === controller) contextRequestRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (active) refreshContext();
  }, [active, refreshContext]);
  useEffect(
    () => () => {
      requestRef.current?.abort();
      requestRef.current = null;
      contextRequestRef.current?.abort();
      contextRequestRef.current = null;
    },
    []
  );
  useEffect(() => {
    if (active && threadRef.current && followThreadRef.current && !isNewConversation)
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [active, messages, sending, error, isNewConversation]);

  const reset = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setMessages([welcome]);
    setInput('');
    setSending(false);
    setError(null);
    followThreadRef.current = true;
    if (threadRef.current) threadRef.current.scrollTop = 0;
    inputRef.current?.focus();
  };

  const send = async (suggestion) => {
    const content = (suggestion ?? input).trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!content || requestRef.current || contextStatus !== 'ready') return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 75000);
    const history = messages.slice(-8).map(({ role, content: previous }) => ({
      role,
      content: previous.slice(0, role === 'assistant' ? 900 : MAX_MESSAGE_LENGTH),
    }));
    setMessages((current) => [...current, { role: 'user', content }]);
    followThreadRef.current = true;
    setInput('');
    setError(null);
    setSending(true);
    try {
      const response = await authenticatedFetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          data.error || data.message || 'Your coach could not respond. Please try again.'
        );
      if (typeof data.reply !== 'string' || !data.reply.trim())
        throw new Error('Your coach returned an empty reply. Please try again.');
      if (requestRef.current !== controller) return;
      // A message's snapshot wins over an older in-flight context refresh.
      contextRequestRef.current?.abort();
      contextRequestRef.current = null;
      if (data.context) setContext(data.context);
      setContextStatus('ready');
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.reply,
          sources: normalizeAssistantSources(data.sources),
          searchStatus: data.searchStatus === 'unavailable' ? 'unavailable' : null,
        },
      ]);
    } catch (failure) {
      if (requestRef.current !== controller) return;
      setError(
        failure.name === 'AbortError'
          ? 'The reply took too long. Please try again.'
          : failure.message
      );
      // Keep the draft so the user can edit or resend after a failure. An
      // unanswered submission is not part of the next model history.
      setMessages((current) => current.slice(0, -1));
      setInput((current) => current || content);
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setSending(false);
      }
    }
  };

  return (
    <section className="db-ai-coach" aria-label="Personal progress coach" data-active={active}>
      <header className="db-ai-coach__heading">
        <div className="db-ai-coach__identity">
          <img src={mascotHead} alt="" width="44" height="44" />
          <div>
            <h2>AI Coach</h2>
            <p role={contextStatus === 'loading' ? 'status' : undefined}>
              {contextStatus === 'loading'
                ? 'Loading your saved progress…'
                : 'Your progress. Your next move.'}
            </p>
          </div>
        </div>
        <div className="db-ai-coach__actions">
          <button
            type="button"
            className="db-ai-coach__progress-toggle"
            aria-expanded={showProgress}
            aria-controls="dashboard-coach-progress"
            onClick={() => setProgressExpanded((expanded) => !expanded)}
          >
            <ClipboardList size={16} aria-hidden="true" />
            <span>Your progress</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button type="button" className="db-ai-coach__reset" onClick={reset}>
            <RotateCcw size={16} aria-hidden="true" /> <span>New conversation</span>
          </button>
        </div>
      </header>
      <div className="db-ai-coach__layout">
        <div className="db-ai-coach__chat">
          <div
            className={`db-ai-coach__thread${isNewConversation ? ' db-ai-coach__thread--new' : ''}`}
            ref={threadRef}
            tabIndex={0}
            onScroll={(event) => {
              const thread = event.currentTarget;
              followThreadRef.current =
                thread.scrollHeight - thread.scrollTop - thread.clientHeight < 64;
            }}
            role="log"
            aria-label="Coach conversation"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {isNewConversation && (
              <div className="db-ai-coach__welcome">
                <div className="db-ai-coach__welcome-intro">
                  <div className="db-ai-coach__welcome-mark" aria-hidden="true">
                    <img src={mascotHead} alt="" width="48" height="48" />
                  </div>
                  <h3>
                    Make your next <span>answer stronger.</span>
                  </h3>
                </div>
                <p>
                  Understand your progress, sharpen an answer, or find your next practice focus.
                </p>
                <div className="db-ai-coach__starters">
                  {starters.map((starter) => {
                    const Icon = starter.icon;
                    return (
                      <button
                        key={starter.label}
                        type="button"
                        aria-label={starter.label}
                        onClick={() => send(starter.message)}
                        disabled={sending || contextStatus !== 'ready'}
                      >
                        <span className="db-ai-coach__starter-icon">
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <span className="db-ai-coach__starter-copy">
                          <strong>{starter.label}</strong>
                          <small>{starter.description}</small>
                        </span>
                        <ArrowUpRight
                          size={18}
                          className="db-ai-coach__starter-arrow"
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {messages.slice(1).map((message, index) => (
              <div
                key={index}
                className={`db-ai-coach__message db-ai-coach__message--${message.role}`}
              >
                {message.role === 'assistant' && (
                  <img
                    className="db-ai-coach__message-avatar"
                    src={mascotHead}
                    alt=""
                    width="28"
                    height="28"
                  />
                )}
                <div className="db-ai-coach__message-content">
                  <span
                    className={
                      message.role === 'user' ? 'db-ai-coach__sr-only' : 'db-ai-coach__author'
                    }
                  >
                    {message.role === 'user' ? 'You' : 'ITerview'}
                  </span>
                  <div className="db-ai-coach__bubble">
                    <AssistantReply content={message.content} />
                    {message.sources?.length > 0 && (
                      <nav className="db-ai-coach__sources" aria-label="Sources for this reply">
                        <span>Sources</span>
                        {message.sources.map((source) => (
                          <a
                            key={source.url}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <strong>{source.title}</strong>
                            <small>{source.domain}</small>
                            <ExternalLink size={14} aria-hidden="true" />
                          </a>
                        ))}
                      </nav>
                    )}
                    {message.searchStatus === 'unavailable' && (
                      <p className="db-ai-coach__search-note">
                        Live search couldn’t verify this answer. Treat current figures as
                        unverified.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <p className="db-ai-coach__thinking" role="status">
                <span className="db-ai-coach__thinking-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                Thinking through your question…
              </p>
            )}
          </div>
          {error && (
            <div className="db-ai-coach__error" role="alert">
              {error}
            </div>
          )}
          <form
            className="db-ai-coach__composer"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <label className="db-ai-coach__sr-only" htmlFor="dashboard-coach-message">
              Ask your coach
            </label>
            <div className="db-ai-coach__input-box">
              <textarea
                id="dashboard-coach-message"
                ref={inputRef}
                value={input}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={2}
                placeholder="What should I work on next?"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <div className="db-ai-coach__input-tools">
                <span className="db-ai-coach__keyboard-hint">
                  Enter to send <span>·</span> Shift + Enter for a new line
                </span>
                <span
                  className="db-ai-coach__character-count"
                  aria-label={`${input.length} of ${MAX_MESSAGE_LENGTH} characters`}
                >
                  {input.length}/{MAX_MESSAGE_LENGTH}
                </span>
                <button
                  type="submit"
                  aria-label="Send coach message"
                  disabled={sending || !input.trim() || contextStatus !== 'ready'}
                >
                  <ArrowUp size={20} aria-hidden="true" />
                </button>
              </div>
            </div>
            <details className="db-ai-coach__privacy">
              <summary>
                <ShieldCheck size={14} aria-hidden="true" /> How your data is used{' '}
                <ChevronDown size={12} aria-hidden="true" />
              </summary>
              <p>
                An AI service processes your messages and saved assessment summary. Public search
                queries may be sent to a search service. Avoid passwords and personal details.
              </p>
            </details>
          </form>
        </div>
        <aside
          id="dashboard-coach-progress"
          className="db-ai-coach__context"
          data-expanded={showProgress}
          aria-label="Saved progress used by your coach"
        >
          <div className="db-ai-coach__brief-heading">
            <ClipboardList size={17} aria-hidden="true" />
            <h2>Your progress</h2>
          </div>
          {contextStatus === 'loading' ? (
            <div className="db-ai-coach__context-loading">
              <p>Loading your saved progress…</p>
              <span />
              <span />
              <span />
            </div>
          ) : contextStatus === 'error' ? (
            <div role="alert">
              <p>Your saved progress couldn’t be loaded.</p>
              <button
                type="button"
                className="db-btn-secondary db-btn-secondary--sm"
                onClick={refreshContext}
              >
                Retry loading progress
              </button>
            </div>
          ) : (
            <>
              <p className="db-ai-coach__track">
                {context?.roleLabel || 'No interview role selected yet'}
              </p>
              <p className="db-ai-coach__context-status">
                {context?.hasAssessmentData
                  ? 'Your coach uses your saved results to guide you.'
                  : 'No scores yet. Complete your one-time pre-test for personalized feedback. You can still ask your coach for help.'}
              </p>
              <div className="db-ai-coach__next-step">
                <ArrowRight size={18} aria-hidden="true" />
                <div>
                  <h3>Next step</h3>
                  <strong>{NEXT_STEPS[context?.nextStage] || 'Review your dashboard'}</strong>
                </div>
              </div>
              {context?.hasAssessmentData && (
                <details className="db-ai-coach__scores">
                  <summary>
                    View score details <ChevronDown size={14} aria-hidden="true" />
                  </summary>
                  <dl>
                    <div>
                      <dt>
                        Pre-test <small>Your starting score before practice.</small>
                      </dt>
                      <dd data-assessed={typeof context?.preTestScore === 'number'}>
                        {percentage(context?.preTestScore)}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        Practice average <small>Average across your scored practice sets.</small>
                      </dt>
                      <dd data-assessed={typeof context?.practiceScore === 'number'}>
                        {percentage(context?.practiceScore)}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        Post-test <small>Your score after completing practice.</small>
                      </dt>
                      <dd data-assessed={typeof context?.postTestScore === 'number'}>
                        {percentage(context?.postTestScore)}
                      </dd>
                    </div>
                  </dl>
                  <p className="db-ai-coach__context-note">
                    Pre-test and post-test are taken once for the study. Only practice sets can be
                    repeated.
                  </p>
                </details>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
