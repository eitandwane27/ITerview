import { useRef, useState } from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  motion as Motion,
  useInView,
  useReducedMotion,
} from 'framer-motion';
import { Check, CodeXml, MessageSquareMore, Search } from 'lucide-react';
import Reveal from './motion/Reveal';
import './LearningJourney.css';

const STAGES = [
  {
    id: 'baseline',
    label: 'Find your starting point',
    title: 'Initial Baseline Assessment',
    description:
      '5 initial diagnostic questions establish your starting baseline across Clarity, Correctness, and Completeness without gating any tracks.',
  },
  {
    id: 'practice',
    label: 'Build a stronger answer',
    title: '3-Round Mock Interview',
    description:
      '15 voice questions across Diagnostic, Role-Technical, and Behavioral (Situation, Task, Action, Result) categories with real-time rubric feedback.',
  },
  {
    id: 'benchmark',
    label: 'See how far you came',
    title: 'Graduation Benchmark Assessment',
    description:
      'Re-test against identical benchmark questions to objectively verify and celebrate your score growth.',
  },
];

// Existing illustrative scores, not a promise of a particular learner's result.
// A difference between percentages is expressed in percentage points.
const SAMPLE = { baseline: 55, benchmark: 82, unlock: 75 };
const ROUNDS = [
  {
    name: 'Diagnostic',
    icon: <Search strokeWidth={2} />,
    description: 'Explore your current strengths and identify growth areas.',
    example: 'e.g. self-introduction, problem solving',
  },
  {
    name: 'Role-Technical',
    icon: <CodeXml strokeWidth={2} />,
    description: 'Practice role-specific technical questions out loud.',
    example: 'e.g. data structures, JavaScript, React',
  },
  {
    name: 'Behavioral',
    icon: <MessageSquareMore strokeWidth={2} />,
    description: 'Build confidence with common behavioral questions.',
    example: 'e.g. teamwork, challenges, impact',
  },
];
const EASE = [0.22, 1, 0.36, 1];

function PracticePath() {
  return (
    <>
      <div className="lj-path-intro">
        <h3 className="lj-path-title">Build a stronger answer</h3>
        <div className="lj-path-stats">
          <p>
            <strong>15</strong> <span>voice questions</span>
          </p>
          <p>
            <strong>3</strong> <span>rounds of targeted practice</span>
          </p>
        </div>
        <p className="lj-path-feedback">Feedback on your answers, as you practice</p>
      </div>
      <div className="lj-path-map">
        <img
          className="lj-path-mobile-art"
          src="/images/journey/practice-path-mobile.webp"
          alt=""
          width="480"
          height="800"
          loading="lazy"
        />
        <ol className="lj-path-rounds" aria-label="Three rounds of targeted practice">
          {ROUNDS.map(({ name, icon, description, example }) => (
            <li className="lj-path-round" key={name}>
              <span className="lj-path-icon" aria-hidden="true">
                {icon}
              </span>
              <div className="lj-path-copy">
                <h4>{name}</h4>
                <p className="lj-path-description">{description}</p>
                <p className="lj-path-example">{example}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function ScoreRow({ label, value, muted = false, reduce, delay = 0 }) {
  const trackRef = useRef(null);
  // Observe the stable track: a fill scaled to zero has no visible width to observe.
  const inView = useInView(trackRef, { once: true, amount: 0.8 });

  return (
    <div className={`lj-score-row${muted ? ' lj-score-row--muted' : ''}`}>
      <div className="lj-score-heading">
        <span>{label}</span>
        <p className="lj-score-value">
          {value}
          <span>%</span>
        </p>
      </div>
      <div ref={trackRef} className="lj-score-track" aria-hidden="true">
        <Motion.div
          className="lj-score-fill"
          initial={false}
          animate={{ scaleX: reduce || inView ? value / 100 : 0 }}
          transition={{ duration: reduce ? 0 : 0.65, delay: reduce ? 0 : delay, ease: EASE }}
        />
      </div>
    </div>
  );
}

function JourneyScene({ stage, reduce }) {
  const active = stage.id;
  if (active === 'practice') return <PracticePath />;

  const takeaway =
    active === 'baseline'
      ? ['5', 'diagnostic questions', 'Clarity, Correctness, and Completeness']
      : [
          `+${SAMPLE.benchmark - SAMPLE.baseline}`,
          'percentage points of growth',
          'From 55% at baseline to 82% at graduation',
        ];

  return (
    <>
      <div className="lj-scene-content">
        <p className="lj-visual-title">{stage.label}</p>
        <div className="lj-scene-body">
          <figure className="lj-comparison" aria-label="Sample score comparison">
            <ScoreRow
              label="Baseline score"
              value={SAMPLE.baseline}
              muted={active === 'benchmark'}
              reduce={reduce}
            />
            {active === 'benchmark' ? (
              <ScoreRow
                label="Graduation score"
                value={SAMPLE.benchmark}
                reduce={reduce}
                delay={0.1}
              />
            ) : (
              <p className="lj-baseline-note">
                Revisit these questions at graduation to measure your progress.
              </p>
            )}
            <figcaption className="lj-comparison-caption">
              {active === 'benchmark'
                ? 'Same questions. Same rubric. Visible progress.'
                : 'A clear starting point for your practice.'}
            </figcaption>
          </figure>
        </div>
      </div>
      <div className="lj-takeaway">
        <p className="lj-takeaway-label">
          <span className="lj-takeaway-value">{takeaway[0]}</span> {takeaway[1]}
        </p>
        <p className="lj-takeaway-note">{takeaway[2]}</p>
      </div>
    </>
  );
}

export default function LearningJourney() {
  const [active, setActive] = useState('practice');
  const [displayed, setDisplayed] = useState('practice');
  const reduce = useReducedMotion();
  const stage = STAGES.find((item) => item.id === active);

  return (
    <section className="lp-section-wrap lj-section" id="journey" aria-labelledby="journey-title">
      <div className="lp-section-inner lj-inner">
        <Reveal className="lj-heading">
          <h2 className="lp-section-title" id="journey-title">
            From your first try to <span className="lj-unbroken">interview-ready</span>
          </h2>
          <p className="lp-section-subtitle">
            Practice is only useful when you can prove you got better. Our diagnostic workflow
            measures your growth between your first attempt and your graduation test.
          </p>
        </Reveal>

        <div className="lj-layout">
          <LayoutGroup>
            <Reveal as="ol" className="lj-stages" aria-label="Your learning pathway" y={18}>
              {STAGES.map((item) => (
                <li
                  className={`lj-stage${active === item.id ? ' lj-stage--active' : ''}`}
                  key={item.id}
                >
                  <span className="lj-stop" aria-hidden="true">
                    {active === item.id && (
                      <Motion.span
                        className="lj-stop-active"
                        layoutId="journey-active-stop"
                        transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
                      />
                    )}
                    {item.id === 'benchmark' ? <Check size={14} strokeWidth={3} /> : <i />}
                  </span>
                  <div className="lj-stage-body">
                    <h3>
                      <button
                        type="button"
                        className="lj-stage-button"
                        aria-pressed={active === item.id}
                        aria-controls="journey-example"
                        onClick={() => setActive(item.id)}
                      >
                        <span>{item.title}</span>
                      </button>
                    </h3>
                    <p>{item.description}</p>
                  </div>
                </li>
              ))}
            </Reveal>
          </LayoutGroup>

          <Reveal
            className={`lj-example${displayed === 'practice' ? ' lj-example--practice' : ''}`}
            delay={0.08}
            y={18}
          >
            {displayed === 'practice' && (
              <img
                className="lj-path-art"
                src="/images/journey/practice-path.webp"
                alt=""
                width="1404"
                height="1120"
                loading="lazy"
              />
            )}
            <div className="lj-example-heading">
              <p className="lj-example-name">Sample Practice Journey</p>
              <p className="lj-example-track">Frontend Track</p>
            </div>
            <p className="lj-sr-only" aria-live="polite" aria-atomic="true">
              {stage.label}
            </p>
            <div id="journey-example" className="lj-visual" data-stage={displayed}>
              <AnimatePresence
                mode="wait"
                initial={false}
                onExitComplete={() => setDisplayed(active)}
              >
                <Motion.div
                  key={active}
                  className="lj-scene"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.24, ease: EASE } }}
                  exit={{
                    opacity: reduce ? 1 : 0,
                    transition: { duration: reduce ? 0 : 0.14, ease: EASE },
                  }}
                >
                  <JourneyScene stage={stage} reduce={reduce} />
                </Motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>

        <div className="lj-footnotes">
          <p>
            <strong>Targeted Prep</strong>
            <span>Focus on weak spots</span>
          </p>
          <p>
            <strong>{SAMPLE.unlock}%+ Unlock</strong>
            <span>Unlocks harder tiers</span>
          </p>
          <p>
            <strong>Zero Guesswork</strong>
            <span>Objective rubric</span>
          </p>
        </div>
      </div>
    </section>
  );
}
