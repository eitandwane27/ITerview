// frontend/src/components/InterviewSidebar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Right sidebar panel for MainSets interview arena containing 4 subcomponents:
// 1. QuestionListCard: Question navigation (1-5) and chat-style Transcript tab
// 2. TranscriptThread: speaking-order log of AI question → candidate answer →
//    AI's spoken reply (plus the in-progress candidate turn while it streams)
// 3. AICoachCard: AI Coach avatar (mascot head) and real-time coaching tip
// 4. AIFeedbackCard: Structured feedback points (What you did well / Try improving)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Check,
  Activity,
  MessageSquare,
  ArrowDown,
  ThumbsUp,
  Lightbulb,
} from 'lucide-react';
import mascotHeadSrc from '../assets/mascot-head.png';

const pad2 = (n) => String(n).padStart(2, '0');

// Auto-scroll stays pinned to the newest turn while the reader is within this
// distance of the bottom; scrolling further up pauses pinning (jump pill).
const NEAR_BOTTOM_THRESHOLD_PX = 48;

/**
 * Question Navigation List and Chat-Style Transcript Tab Card
 */
export function QuestionListCard({
  activeQuestionIndex = 1,
  questionsAsked = [],
  currentQuestionText = '',
  titleFor = () => null,
  chatTurns = [],
  userInitials = 'ME',
  activeTab: controlledTab,
  onTabChange,
}) {
  const [internalTab, setInternalTab] = useState('questions');
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setTab = onTabChange || setInternalTab;

  return (
    <div className="ix-sidebar-card">
      <div className="ix-sidebar-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          id="ix-sidebar-tab-questions"
          aria-selected={activeTab === 'questions'}
          aria-controls="ix-sidebar-panel-questions"
          className={`ix-sidebar-tab ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setTab('questions')}
        >
          Questions (5)
        </button>
        <button
          type="button"
          role="tab"
          id="ix-sidebar-tab-transcript"
          aria-selected={activeTab === 'transcript'}
          aria-controls="ix-sidebar-panel-transcript"
          className={`ix-sidebar-tab ${activeTab === 'transcript' ? 'active' : ''}`}
          onClick={() => setTab('transcript')}
        >
          Transcript
        </button>
      </div>

      {activeTab === 'transcript' ? (
        <div
          id="ix-sidebar-panel-transcript"
          role="tabpanel"
          aria-labelledby="ix-sidebar-tab-transcript"
          className="ix-transcript-panel"
        >
          <TranscriptThread turns={chatTurns} userInitials={userInitials} />
        </div>
      ) : (
        <div
          id="ix-sidebar-panel-questions"
          role="tabpanel"
          aria-labelledby="ix-sidebar-tab-questions"
          className="ix-question-list"
        >
          {[1, 2, 3, 4, 5].map((i) => {
            const isCurrent = i === activeQuestionIndex;
            const asked = questionsAsked.find((q) => q.index === i);
            const isAnswered = asked ? asked.answered : i < activeQuestionIndex;
            const qText = asked ? asked.text : titleFor(i);

            const stateClass = isCurrent ? 'active' : isAnswered ? 'answered' : 'pending';

            return (
              <div key={i} className={`ix-q-list-item ${stateClass}`}>
                <span className={`ix-q-list-num ${stateClass}`}>{pad2(i)}</span>
                <span className={`ix-q-list-title ${stateClass}`}>
                  {isCurrent
                    ? currentQuestionText || qText || 'Current question'
                    : isAnswered
                      ? qText || `Question ${i}`
                      : 'Waiting for the interviewer...'}
                </span>
                {isCurrent ? (
                  <Activity size={15} className="ix-q-list-icon-active" />
                ) : isAnswered ? (
                  <Check size={15} className="ix-q-list-icon-answered" />
                ) : (
                  <Clock size={15} className="ix-q-list-icon-pending" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Chat-Style Interview Transcript Thread
 *
 * Speaking-order log of the interviewer's question, the candidate's spoken
 * answer, and the interviewer's spoken reply. The in-progress candidate turn
 * arrives flagged `live`: 'recording' while the candidate speaks (with the
 * live caret + listening chip), 'evaluating' while feedback is synthesised.
 */
export function TranscriptThread({ turns = [], userInitials = 'ME' }) {
  const scrollRef = useRef(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  // Stick to the newest turn while the reader is already near the bottom; a
  // manual scroll-up pauses pinning (jump pill) so reading is never fought.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isPinnedToBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, isPinnedToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsPinnedToBottom(distance <= NEAR_BOTTOM_THRESHOLD_PX);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setIsPinnedToBottom(true);
  };

  if (turns.length === 0) {
    return (
      <div
        className="ix-chat-thread"
        role="log"
        aria-live="polite"
        aria-label="Interview transcript"
      >
        <div className="ix-chat-empty">
          <MessageSquare size={20} />
          <p>
            Your conversation will appear here — every question the interviewer asks and every
            answer you give.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ix-chat-wrap">
      <div
        className="ix-chat-thread"
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Interview transcript"
      >
        {turns.map((turn) => {
          const isAI = turn.role === 'ai';
          const isLive = Boolean(turn.live);
          return (
            <div key={turn.id} className={`ix-chat-row ${isAI ? 'ai' : 'me'}`}>
              <div className={`ix-chat-avatar ${isAI ? 'ai' : 'me'}`} aria-hidden="true">
                {isAI ? (
                  <img
                    src={mascotHeadSrc}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span>
                    {String(userInitials || 'ME')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <div className={`ix-chat-bubble ${isAI ? 'ai' : 'me'} ${isLive ? 'live' : ''}`}>
                <span className="ix-chat-role">
                  {turn.label || (isAI ? 'AI Interviewer' : 'You')}
                </span>
                <p className="ix-chat-text">
                  {turn.text || '…'}
                  {isLive && turn.live === 'recording' && (
                    <span className="ix-chat-caret" aria-hidden="true" />
                  )}
                </p>
                {isLive && turn.live === 'recording' && (
                  <span className="ix-chat-live-chip recording">
                    <span className="ix-chat-rec-dot" aria-hidden="true" />
                    Listening…
                  </span>
                )}
                {isLive && turn.live === 'evaluating' && (
                  <span className="ix-chat-live-chip">
                    <Activity size={10} />
                    Analyzing your answer…
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!isPinnedToBottom && (
        <button type="button" className="ix-chat-jump" onClick={jumpToLatest}>
          <ArrowDown size={12} />
          <span>Jump to latest</span>
        </button>
      )}
    </div>
  );
}

/**
 * AI Coach Mascot Card with Dynamic Tip
 */
export function AICoachCard({ coachTip }) {
  return (
    <div className="ix-coach-section">
      <div className="ix-section-heading">AI COACH</div>
      <div className="ix-coach-card">
        <div className="ix-coach-content-row">
          <div className="ix-coach-avatar-col">
            <div
              className="ix-mascot-logo ix-coach-avatar"
              style={{ width: 46, height: 46 }}
              aria-label="AI Coach mascot"
            >
              <img
                src={mascotHeadSrc}
                alt="AI Coach mascot"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div className="ix-coach-pagination">
              <span className="ix-dot-page active" />
              <span className="ix-dot-page" />
              <span className="ix-dot-page" />
            </div>
          </div>
          <div className="ix-coach-text-block">
            <h4 className="ix-coach-title">AI Coach</h4>
            <p className="ix-coach-tip">
              {coachTip &&
              coachTip !== 'Your personalized AI feedback will appear here after each answer.'
                ? coachTip
                : 'Great structure! Now try adding more concrete trade-offs or edge cases.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AI Feedback Cards (What you did well / Try improving)
 */
export function AIFeedbackCard({
  whatYouDidWell = 'You clearly outlined your points with direct structure and confident pacing.',
  tryImproving = 'Quantifying your results or highlighting specific architecture choices will strengthen your answer.',
}) {
  return (
    <div className="ix-feedback-section">
      <div className="ix-section-heading">AI FEEDBACK</div>
      <div className="ix-feedback-cards">
        {/* What you did well */}
        <div className="ix-feedback-item-card">
          <div className="ix-feedback-icon-wrap green">
            <ThumbsUp size={14} />
          </div>
          <div className="ix-feedback-item-content">
            <h5 className="ix-feedback-item-title">What you did well</h5>
            <p className="ix-feedback-item-desc">{whatYouDidWell}</p>
          </div>
        </div>

        {/* Try improving */}
        <div className="ix-feedback-item-card">
          <div className="ix-feedback-icon-wrap amber">
            <Lightbulb size={14} />
          </div>
          <div className="ix-feedback-item-content">
            <h5 className="ix-feedback-item-title">Try improving</h5>
            <p className="ix-feedback-item-desc">{tryImproving}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Complete Composite Interview Sidebar Column
 */
export default function InterviewSidebar({
  activeQuestionIndex,
  questionsAsked,
  currentQuestionText,
  titleFor,
  chatTurns,
  userInitials,
  activeTab,
  onTabChange,
  coachTip,
  whatYouDidWell,
  tryImproving,
}) {
  return (
    <aside className="ix-sidebar-column">
      <QuestionListCard
        activeQuestionIndex={activeQuestionIndex}
        questionsAsked={questionsAsked}
        currentQuestionText={currentQuestionText}
        titleFor={titleFor}
        chatTurns={chatTurns}
        userInitials={userInitials}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
      <AICoachCard coachTip={coachTip} />
      <AIFeedbackCard whatYouDidWell={whatYouDidWell} tryImproving={tryImproving} />
    </aside>
  );
}
