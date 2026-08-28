// frontend/src/hooks/useTypewriter.js
// Reveals `text` one character at a time at `speed` ms per character.
// Returns { displayText, isDone, skip } so the parent can:
//   - Render displayText in the UI
//   - Gate subsequent animations behind isDone
//   - Let the user call skip() to instantly reveal the full text

import { useState, useEffect, useCallback } from 'react';

export function useTypewriter(text, speed = 30) {
  const [displayText, setDisplayText] = useState('');
  const [isDone, setIsDone] = useState(false);

  // Reset whenever the source text changes
  useEffect(() => {
    setDisplayText('');
    setIsDone(false);

    if (!text) {
      setIsDone(true);
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setDisplayText(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
        setIsDone(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  // Skip — instantly reveal the full text
  const skip = useCallback(() => {
    setDisplayText(text);
    setIsDone(true);
  }, [text]);

  return { displayText, isDone, skip };
}
