import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  Code2,
  Compass,
  Layers,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Terminal,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from './ui/popover';
import mascotHeadSrc from '../assets/mascot-head.png';
import AssistantReply from './AssistantReply';
import './RecommendationChatbot.css';

// Operate: a mascot-led introduction, question rows, open assistant replies,
// and a persistent composer. Inherits the landing page's white/slate/cobalt world.
// Existing platform help, track discovery, and registration handoff remain intact.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const MAX_MESSAGE_LENGTH = 600;
const REQUEST_TIMEOUT_MS = 30000;
const MESSAGE_EASE = [0.16, 1, 0.3, 1];

const starters = [
  {
    icon: Compass,
    title: 'Find my practice track',
    message: 'Help me choose a practice track',
  },
  {
    icon: BookOpen,
    title: 'How does ITerview work?',
    message: 'How does ITerview work?',
  },
  {
    icon: Terminal,
    title: 'I enjoy logic, APIs, and data',
    message: 'I enjoy logic, APIs, and data',
  },
];
const welcomeMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hey! Interviews are enough of a guessing game. I can explain ITerview or help you find a practice track. What's on your mind?",
};
const trackIcons = { frontend: Code2, backend: Terminal, fullstack: Layers };

function CoachAvatar({ className = '' }) {
  return (
    <span className={`track-guide-avatar ${className}`} aria-hidden="true">
      <img src={mascotHeadSrc} alt="" width="40" height="40" decoding="async" />
    </span>
  );
}

function TrackRecommendation({ role, onStart }) {
  const TrackIcon = trackIcons[role.id] || Compass;
  return (
    <div className="track-guide-recommendation">
      <div className="track-guide-recommendation-heading">
        <span className="track-guide-track-icon">
          <TrackIcon size={20} />
        </span>
        <div>
          <Badge>
            <Check size={12} /> Suggested track
          </Badge>
          <h3>{role.label}</h3>
        </div>
      </div>
      {role.topics?.length > 0 && (
        <ul className="track-guide-topics" aria-label="Practice topics">
          {role.topics.slice(0, 3).map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      )}
      <Button className="track-guide-start" onClick={() => onStart(role.id)}>
        Start this track <ArrowRight size={16} />
      </Button>
    </div>
  );
}

function RecommendationChatbot({ onStart }) {
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [roles, setRoles] = useState([]);
  const inputRef = useRef(null);
  const threadRef = useRef(null);
  const closeRef = useRef(null);
  const requestRef = useRef(null);
  const isWelcome = messages.length === 1;
  const reveal = {
    initial: reduceMotion ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduceMotion ? 0 : -6 },
    transition: { duration: reduceMotion ? 0 : 0.24, ease: MESSAGE_EASE },
  };
  const scrollToLatest = () => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: reduceMotion || isWelcome ? 'instant' : 'smooth',
    });
  };

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (!isOpen || roles.length) return;
    const controller = new AbortController();
    fetch(`${BACKEND_URL}/api/recommendations/roles`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load tracks');
        return response.json();
      })
      .then((data) => setRoles(Array.isArray(data.roles) ? data.roles : []))
      .catch(() => {});
    return () => controller.abort();
  }, [isOpen, roles.length]);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: reduceMotion || isWelcome ? 'instant' : 'smooth',
    });
  }, [messages, isSending, error, isOpen, isWelcome, reduceMotion]);

  const focusInput = () =>
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));

  const resetChat = () => {
    // Detach the old request before aborting so its reply cannot enter the new conversation.
    const previousRequest = requestRef.current;
    requestRef.current = null;
    previousRequest?.abort();
    setMessages([welcomeMessage]);
    setInput('');
    setError(null);
    setIsSending(false);
    focusInput();
  };

  const sendMessage = async (suggestedMessage, isRetry = false) => {
    const content = String(suggestedMessage ?? input)
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH);
    if (!content || requestRef.current) return;
    const userMessage = { id: `user-${Date.now()}`, role: 'user', content };
    const historySource = isRetry ? messages.slice(0, -1) : messages;
    const history = historySource.slice(-8).map(({ role, content: messageContent }) => ({
      role,
      content: messageContent.slice(0, MAX_MESSAGE_LENGTH),
    }));
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    if (!isRetry) setMessages((current) => [...current, userMessage]);
    setInput('');
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/recommendations/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || 'The guide could not respond. Please try again.');
      if (typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('The guide returned an empty reply. Please try again.');
      }
      if (requestRef.current !== controller) return;
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          recommendedRole: data.recommendedRole || null,
        },
      ]);
    } catch (requestError) {
      if (requestRef.current !== controller) return;
      setError({
        content,
        message:
          requestError.name === 'AbortError'
            ? 'The reply took too long. Please try again.'
            : requestError.message || 'The guide could not respond. Please try again.',
      });
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsSending(false);
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
    focusInput();
  };
  const handleStart = (roleId) => {
    if (roleId) sessionStorage.setItem('iterview-recommended-role', roleId);
    setIsOpen(false);
    onStart?.();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <div className={`track-guide track-guide-surface${isOpen ? ' track-guide--open' : ''}`}>
        <PopoverTrigger asChild>
          <Button
            className="track-guide-launcher"
            aria-label={isOpen ? 'Close ITerview guide' : 'Ask about ITerview'}
          >
            <span className="track-guide-launcher-icon" aria-hidden="true">
              <MessageCircle className="track-guide-launcher-chat" size={20} />
              <X className="track-guide-launcher-close" size={20} />
            </span>
            <span className="track-guide-launcher-label" aria-hidden={isOpen}>
              Ask about ITerview
            </span>
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="track-guide-panel track-guide-surface"
        side="top"
        align="end"
        sideOffset={12}
        collisionPadding={12}
        aria-labelledby="track-guide-title"
        aria-describedby="track-guide-description"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          // Keep the mobile keyboard closed until the visitor chooses to type.
          if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
          else closeRef.current?.focus({ preventScroll: true });
        }}
      >
        <header className="track-guide-header">
          <div className="track-guide-heading">
            <CoachAvatar />
            <div>
              <h2 id="track-guide-title">ITerview assistant</h2>
              <p id="track-guide-description">Platform help &amp; track guidance</p>
            </div>
          </div>
          <div className="track-guide-header-actions">
            <Button
              variant="ghost"
              size="icon"
              onClick={resetChat}
              aria-label="Start a new conversation"
              title="Start a new conversation"
              disabled={isWelcome && !input}
            >
              <RotateCcw size={17} />
            </Button>
            <PopoverClose asChild>
              <Button
                ref={closeRef}
                variant="ghost"
                size="icon"
                aria-label="Close ITerview guide"
                title="Close guide"
              >
                <X size={20} />
              </Button>
            </PopoverClose>
          </div>
        </header>
        <div className="track-guide-thread" ref={threadRef}>
          <AnimatePresence initial={false} mode="wait">
            {isWelcome ? (
              <Motion.div key="welcome" className="track-guide-welcome" {...reveal}>
                <CoachAvatar className="track-guide-avatar--welcome" />
                <h3>
                  Let’s find your
                  <br />
                  starting point.
                </h3>
                <p>{welcomeMessage.content}</p>
                <div className="track-guide-starters" aria-label="Conversation starters">
                  {starters.map((starter) => {
                    const { icon: Icon, title, message } = starter;
                    return (
                      <Button
                        key={title}
                        variant="outline"
                        className="track-guide-starter"
                        onClick={() => sendMessage(message)}
                      >
                        <Icon className="track-guide-starter-icon" size={19} />
                        <span>
                          <strong>{title}</strong>
                        </span>
                        <ArrowRight size={16} />
                      </Button>
                    );
                  })}
                </div>
                {roles.length > 0 && (
                  <div className="track-guide-tracks">
                    <div aria-label="Available practice tracks">
                      {roles.map((role) => {
                        const TrackIcon = trackIcons[role.id] || Code2;
                        return (
                          <Button
                            key={role.id}
                            variant="ghost"
                            onClick={() =>
                              sendMessage(`Tell me about the ${role.label} practice track`)
                            }
                          >
                            <TrackIcon size={14} />
                            {role.label.replace(/ Developer$/i, '')}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Motion.div>
            ) : (
              <Motion.div key="conversation" {...reveal} onAnimationComplete={scrollToLatest}>
                <div className="track-guide-conversation-marker">
                  <span>Let’s talk it through</span>
                </div>
                <div
                  role="log"
                  aria-label="Conversation with ITerview assistant"
                  aria-live="polite"
                  aria-relevant="additions"
                  className="track-guide-messages"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {messages.map((message) => (
                      <Motion.div
                        key={message.id}
                        className={`track-guide-row track-guide-row--${message.role}`}
                        layout={reduceMotion ? false : 'position'}
                        initial={
                          reduceMotion
                            ? false
                            : {
                                opacity: 0,
                                x: message.role === 'user' ? 12 : -6,
                                y: 12,
                                scale: message.role === 'user' ? 0.96 : 0.985,
                              }
                        }
                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.32, ease: MESSAGE_EASE }}
                        onAnimationComplete={scrollToLatest}
                      >
                        {message.role === 'assistant' && (
                          <CoachAvatar className="track-guide-avatar--message" />
                        )}
                        <div className="track-guide-message-group">
                          <span className="track-guide-message-author">
                            {message.role === 'assistant' ? 'ITerview' : 'You'}
                          </span>
                          <div className="track-guide-message">
                            {message.role === 'assistant' ? (
                              <AssistantReply content={message.content} />
                            ) : (
                              <p>{message.content}</p>
                            )}
                          </div>
                          {message.recommendedRole && (
                            <TrackRecommendation
                              role={message.recommendedRole}
                              onStart={handleStart}
                            />
                          )}
                        </div>
                      </Motion.div>
                    ))}
                    {isSending && (
                      <Motion.div
                        key="thinking"
                        className="track-guide-row track-guide-row--assistant"
                        layout={reduceMotion ? false : 'position'}
                        {...reveal}
                        exit={{
                          opacity: 0,
                          y: reduceMotion ? 0 : -4,
                          transition: { duration: reduceMotion ? 0 : 0.16 },
                        }}
                      >
                        <CoachAvatar className="track-guide-avatar--message" />
                        <div className="track-guide-loading" role="status">
                          <span className="track-guide-loading-dots" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                          <span>Thinking it through…</span>
                        </div>
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {error && (
              <Motion.div key="error" className="track-guide-error" role="alert" {...reveal}>
                <p>{error.message}</p>
                <Button variant="outline" onClick={() => sendMessage(error.content, true)}>
                  Try again <RotateCcw size={14} />
                </Button>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
        <footer className="track-guide-footer">
          <form className="track-guide-form" onSubmit={handleSubmit}>
            <label className="track-guide-sr-only" htmlFor="track-guide-input">
              Ask about ITerview or your interests
            </label>
            <div className="track-guide-composer">
              <Textarea
                ref={inputRef}
                id="track-guide-input"
                rows={2}
                maxLength={MAX_MESSAGE_LENGTH}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing)
                    handleSubmit(event);
                }}
                placeholder={isWelcome ? 'What would you like to know?' : 'Ask a follow-up…'}
                aria-describedby="track-guide-input-help"
              />
              <div className="track-guide-composer-actions">
                <span id="track-guide-input-help" className="track-guide-input-help">
                  {input.length > 480 ? (
                    `${input.length} / ${MAX_MESSAGE_LENGTH}`
                  ) : (
                    <>
                      <span className="track-guide-keyboard-help">
                        Enter to send · Shift + Enter for a new line
                      </span>
                      <span className="track-guide-touch-help">Up to 600 characters</span>
                    </>
                  )}
                </span>
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send message"
                  disabled={!input.trim() || isSending}
                >
                  <AnimatePresence initial={false} mode="wait">
                    <Motion.span
                      key={isSending ? 'sending' : 'send'}
                      className="track-guide-send-icon"
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.7, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.7, y: reduceMotion ? 0 : -4 }}
                      transition={{ duration: reduceMotion ? 0 : 0.14, ease: MESSAGE_EASE }}
                      aria-hidden="true"
                    >
                      {isSending ? (
                        <LoaderCircle className="track-guide-spin" size={19} />
                      ) : (
                        <ArrowUp size={20} />
                      )}
                    </Motion.span>
                  </AnimatePresence>
                </Button>
              </div>
            </div>
          </form>
          <p className="track-guide-privacy">
            <ShieldCheck size={13} aria-hidden="true" />
            <span>
              Avoid personal details and passwords. Messages may be processed by an AI service.
            </span>
          </p>
        </footer>
      </PopoverContent>
    </Popover>
  );
}

export default RecommendationChatbot;
