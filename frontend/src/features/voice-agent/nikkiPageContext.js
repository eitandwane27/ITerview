import { createContext, useContext, useLayoutEffect } from 'react';

// Separate from the audio session context: page publishers do not subscribe to
// microphone levels, captions or playback updates.
export const NikkiPageContext = createContext(null);
// A native modal makes the rest of the document inert. Host the companion in
// that modal's top layer so its Stop/audio controls and pointer remain usable.
export const NikkiOverlayContext = createContext(null);

export function useNikkiPageContext(snapshot) {
  const publish = useContext(NikkiPageContext);
  // Mounted but inactive panels must not overwrite the active panel's context.
  useLayoutEffect(() => snapshot ? publish?.(snapshot) : undefined, [publish, snapshot]);
}
