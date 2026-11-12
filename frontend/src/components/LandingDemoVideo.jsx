import { Captions, CaptionsOff, Maximize, Minimize, Pause, Play } from 'lucide-react';
import {
  MediaCaptionsButton,
  MediaControlBar,
  MediaController,
  MediaErrorDialog,
  MediaFullscreenButton,
  MediaLoadingIndicator,
  MediaMuteButton,
  MediaPlayButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from 'media-chrome/react';
import demoVideo from '../assets/landing-demo/iterview-landing-demo-smooth.mp4';
import demoCaptions from '../assets/landing-demo/iterview-landing-demo-en.vtt?url';
import demoPoster from '../assets/landing-demo/iterview-landing-demo-poster.webp';
import './LandingDemoVideo.css';

export default function LandingDemoVideo() {
  return (
    <MediaController className="lp-demo-player" noAutohide hotkeys="noarrowleft noarrowright">
      <video
        slot="media"
        src={demoVideo}
        poster={demoPoster}
        width={1920}
        height={1080}
        playsInline
        preload="metadata"
        aria-label="ITerview demo video"
      >
        <track kind="captions" src={demoCaptions} srcLang="en" label="English" />
      </video>
      <MediaLoadingIndicator slot="centered-chrome" />
      <MediaErrorDialog slot="dialog" />
      <MediaControlBar className="lp-demo-controls" noautohide="">
        <MediaTimeRange className="lp-demo-timeline" />
        <MediaPlayButton className="lp-demo-play">
          <Play slot="play" aria-hidden="true" />
          <Pause slot="pause" aria-hidden="true" />
        </MediaPlayButton>
        <MediaTimeDisplay showDuration noToggle />
        <MediaMuteButton />
        <MediaVolumeRange className="lp-demo-volume" />
        <MediaCaptionsButton>
          <Captions slot="on" aria-hidden="true" />
          <CaptionsOff slot="off" aria-hidden="true" />
        </MediaCaptionsButton>
        <MediaFullscreenButton>
          <Maximize slot="enter" aria-hidden="true" />
          <Minimize slot="exit" aria-hidden="true" />
        </MediaFullscreenButton>
      </MediaControlBar>
    </MediaController>
  );
}
