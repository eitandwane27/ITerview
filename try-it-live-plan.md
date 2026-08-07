# Anonymous Interactive Try-It-Live Demo Implementation Plan

This document details the architectural plan and technical steps for converting the static "Try It Live" section in `frontend/src/pages/LandingPage.jsx` (lines 284–400) into an **interactive, anonymous demo component** with built-in quota protection, speech synthesis (TTS), live speech recognition (STT), and instant 3C evaluation.

---

## 🎯 Primary Goal & Business Logic

1. **Zero-Setup Visitor Demo**: Allow unauthenticated landing page visitors to test both AI voice output (TTS) and live voice input (STT).
2. **Quota & Cost Abuse Prevention**:
   - **Curated Premade Questions**: 3 open-ended technical questions (Frontend, Backend, DevOps).
   - **30-Second STT Auto-Cutoff**: Hard server-side and client-side timer capping each recording at 30 seconds.
   - **3-Attempt Cap per Session**: Visitors can try up to 3 recordings per session. On the 4th attempt, automatically trigger the registration/login modal (`AuthModal`).

---

## 🛠️ Proposed File Changes & Architecture

### 1. Backend Changes

#### `backend/controllers/demoSocket.js` [NEW FILE]
Create a standalone WebSocket controller for the `/ws/demo` path:
- Import `createDeepgramLiveSession` from `backend/services/sttService.js`.
- Listen for WebSocket control messages (`start_recording`, `stop_recording`) and binary PCM audio chunks.
- Implement a **30-second server-side auto-cutoff timer** (`setTimeout`) per recording session.
- On receiving transcript turns from Deepgram, forward `{ type: "transcript", text, isFinal }` back to the client.
- When turn completes (`isFinal === true`), compute deterministic 3C scores (Clarity, Correctness, Completeness) based on length, structure, and technical depth, sending `{ type: "scores", clarity, correctness, completeness }` to the client.

#### `backend/server.js` [MODIFY FILE]
- Import `handleDemoSocket` from `./controllers/demoSocket.js`.
- Add upgrade route handler for `/ws/demo`:
```javascript
} else if (pathname === "/ws/demo") {
  wss.handleUpgrade(request, socket, head, (ws) => {
    handleDemoSocket(ws, request);
  });
}
```

---

### 2. Frontend Changes

#### `frontend/src/components/TryItLiveDemo.jsx` [NEW FILE]
Extract lines 284–400 from `LandingPage.jsx` and `DemoScaleBar` helper into a new component:
- **Props**:
  - `onOpenAuth`: Callback function to open the register/login modal when attempt limit is exceeded.
- **Premade Questions**:
  1. *"Walk me through how you'd debug a slow production API."*
  2. *"How do you handle state management in large-scale React applications?"*
  3. *"Explain the difference between SQL and NoSQL databases and when to use each."*
- **Component State**:
  - `selectedQuestion`: Selected question index (0, 1, 2).
  - `isAudioPlaying`: True during TTS audio playback.
  - `isRecording`: True during microphone capture.
  - `recordingTimer`: 30s countdown display.
  - `transcriptText`: Live transcript string.
  - `scores`: `{ clarity: 92, correctness: 87, completeness: 84 }` (dynamic).
  - `attemptCount`: Counter for user recordings in session (max 3).
- **TTS Flow ("Hear the AI")**:
  - Trigger `POST /api/tts/speak` with `text: questions[selectedQuestion]`.
  - Play MP3 stream via HTML5 Web Audio / Audio element while animating the avatar waveform.
- **STT Flow ("Tap & speak")**:
  - Check `attemptCount`: If `>= 3`, invoke `onOpenAuth()` and stop.
  - Increment `attemptCount`.
  - Connect WebSocket to `ws://localhost:5000/ws/demo` (or relative WS port).
  - Stream audio chunks via `navigator.mediaDevices.getUserMedia`.
  - Display 30s countdown timer and stop recording when timer reaches 0 or user clicks stop.

#### `frontend/src/pages/LandingPage.jsx` [MODIFY FILE]
- Import `TryItLiveDemo` from `../components/TryItLiveDemo`.
- Replace inline demo lines 284–400 with:
```jsx
<TryItLiveDemo onOpenAuth={openRegisterModal} />
```

---

## 🧪 Verification & Testing Plan

1. **Backend Route Test**:
   - Verify `ws://localhost:5000/ws/demo` connects cleanly without auth headers.
2. **TTS Verification**:
   - Click "Hear the AI" on `TryItLiveDemo` component and verify speech synthesis audio plays.
3. **STT & Timer Verification**:
   - Click "Tap & speak" and speak into microphone. Verify live transcript updates on screen.
   - Wait for 30s timer to expire; verify connection closes gracefully.
4. **Attempt Limit Verification**:
   - Complete 3 recording attempts. On 4th try, verify `AuthModal` pops up automatically.
