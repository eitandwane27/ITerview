// frontend/src/components/InterviewSidebar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Right sidebar panel for MainSets interview arena containing 3 subcomponents:
// 1. QuestionListCard: Question navigation (1-5) and Candidate Scratchpad notes
// 2. AICoachCard: AI Coach avatar (mascot head) and real-time coaching tip
// 3. AIFeedbackCard: Structured feedback points (What you did well / Try improving)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Clock, Check, Activity, Trash2, ThumbsUp, Lightbulb } from 'lucide-react';
import mascotHeadSrc from '../assets/mascot-head.png';

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Question Navigation List and Scratchpad Notes Tab Card
 */
export function QuestionListCard({
  activeQuestionIndex = 1,
  questionsAsked = [],
  currentQuestionText = '',
  titleFor = () => null,
  candidateNotes = '',
  onNotesChange,
  onClearNotes,
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
          aria-selected={activeTab === 'questions'}
          className={`ix-sidebar-tab ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setTab('questions')}
        >
          Questions (5)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'notes'}
          className={`ix-sidebar-tab ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setTab('notes')}
        >
          Scratchpad Notes
        </button>
      </div>

      {activeTab === 'notes' ? (
        <div className="ix-notes-body">
          <textarea
            className="ix-notes-textarea"
            placeholder="Jot down quick thoughts, STAR points, or technical keywords during your interview..."
            value={candidateNotes}
            onChange={onNotesChange}
            rows={7}
            aria-label="Interview notes scratchpad"
          />
          <div className="ix-notes-footer">
            <span className="ix-notes-saved-hint">Auto-saved locally</span>
            {candidateNotes && onClearNotes && (
              <button type="button" className="ix-notes-clear-btn" onClick={onClearNotes}>
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="ix-question-list">
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
  candidateNotes,
  onNotesChange,
  onClearNotes,
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
        candidateNotes={candidateNotes}
        onNotesChange={onNotesChange}
        onClearNotes={onClearNotes}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
      <AICoachCard coachTip={coachTip} />
      <AIFeedbackCard whatYouDidWell={whatYouDidWell} tryImproving={tryImproving} />
    </aside>
  );
}
