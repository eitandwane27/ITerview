import { lazy, Suspense, useState } from 'react';
import { Clapperboard, Mic } from 'lucide-react';
import { Button } from './ui/button';

const TryItLiveDemo = lazy(() => import('./TryItLiveDemo'));
const LandingDemoVideo = lazy(() => import('./LandingDemoVideo'));

export default function LandingDemoShowcase({ onOpenAuth }) {
  const [showLiveDemo, setShowLiveDemo] = useState(true);
  const [attemptCount, setAttemptCount] = useState(0);

  return (
    <div className="lp-hero-stage" role="group" aria-label="ITerview demos">
      <Button
        className="lp-demo-view lp-demo-view--live"
        variant="outline"
        size="icon"
        aria-pressed={showLiveDemo}
        aria-label="Try It Live"
        aria-controls="lp-demo-content"
        title="Try It Live"
        onClick={() => setShowLiveDemo(true)}
      >
        <Mic size={20} aria-hidden="true" />
      </Button>
      <Button
        className="lp-demo-view lp-demo-view--video"
        variant="outline"
        size="icon"
        aria-pressed={!showLiveDemo}
        aria-label="Watch demo video"
        aria-controls="lp-demo-content"
        title="Watch demo video"
        onClick={() => setShowLiveDemo(false)}
      >
        <Clapperboard size={20} aria-hidden="true" />
      </Button>
      <span className="lp-sr-only" role="status">
        {showLiveDemo ? 'Interactive demo selected' : 'Demo video selected'}
      </span>
      <div className="lp-demo-content" id="lp-demo-content">
        <Suspense fallback={<p className="lp-demo-loading" role="status">Loading demo…</p>}>
          {showLiveDemo ? (
            <TryItLiveDemo
              onOpenAuth={onOpenAuth}
              attemptCount={attemptCount}
              setAttemptCount={setAttemptCount}
            />
          ) : (
            <LandingDemoVideo />
          )}
        </Suspense>
      </div>
    </div>
  );
}
