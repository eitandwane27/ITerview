// backend/services/sttService.js
// ─────────────────────────────────────────────────────────────────────────────
// Deepgram STT — Live WebSocket "Listen" service
//
// Blueprint ref: system-blueprint.md § Phase 1
//   "Client streams binary audio via WebSocket to Node.js backend.
//    Backend pipes this to Deepgram (nova-3 model)."
//   "KeepAlive: Backend pings Deepgram every 2s to prevent WebSocket
//    timeout during AI or TTS processing."
//
// Usage:
//   const { createDeepgramLiveSession } = require("./sttService");
//   const session = createDeepgramLiveSession(onTranscript, onError);
//   session.sendAudio(binaryChunk);   // call with raw PCM/WebM audio
//   session.keepAlive();              // call on a 2 s interval
//   session.finish();                 // call when the user stops speaking
// ─────────────────────────────────────────────────────────────────────────────

const WebSocket = require("ws");

/**
 * createDeepgramLiveSession
 *
 * Opens a Deepgram STT WebSocket and returns a thin controller object so the
 * caller (interviewSocket) can pipe audio into it and receive transcripts.
 *
 * @param {(transcript: string, isFinal: boolean) => void} onTranscript
 *   Called whenever Deepgram returns a transcript segment.
 *   `isFinal` is true when the utterance is complete.
 *
 * @param {(err: Error) => void} onError
 *   Called on any fatal connection / stream error.
 *
 * @returns {{ sendAudio, keepAlive, finish }}
 */
function createDeepgramLiveSession(onTranscript, onError) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    onError(new Error("DEEPGRAM_API_KEY is not set in environment"));
    return null;
  }

  // ── Open a live transcription connection using raw WebSockets ──────────────
  // ── URL param notes ──────────────────────────────────────────────────────
  // • punctuate=true is intentionally OMITTED — smart_format already includes
  //   punctuation, casing, and ITN in a single pass; enabling both is redundant.
  // • endpointing=1500 — tells Deepgram's Voice Activity Detector (VAD) to wait
  //   1.5 seconds after silence before finalizing a transcript segment.
  // • utterance_end_ms=1500 — secondary backup gap detection based on transcript words.
  const url =
    "wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&smart_format=true&interim_results=true&endpointing=1500&utterance_end_ms=1500&encoding=linear16&sample_rate=16000&channels=1";

  const live = new WebSocket(url, ["token", apiKey]);

  // ── Performance logger ────────────────────────────────────────────────────
  // Mirrors the latency metrics shown in SttTestBench.jsx on the frontend.
  //
  // Tracked timestamps (all in ms since epoch):
  //   sessionStart    → when createDeepgramLiveSession() was called
  //   wsOpenTs        → when Deepgram WS "open" fired
  //   firstAudioSentTs→ when sendAudio() was first called (first PCM chunk)
  //   firstInterimTs  → when the very first interim transcript arrived
  //
  // Per-utterance:
  //   utteranceStartTs → timestamp of the first interim for the current utterance
  //   utteranceLatencies[] → (first-interim → final) in ms, one entry per utterance
  const perf = {
    sessionStart: Date.now(),
    wsOpenTs: null,
    firstAudioSentTs: null,
    firstInterimTs: null,
    utteranceStartTs: null,
    utteranceCount: 0,
    utteranceLatencies: [],
    wordCount: 0,
    _mark(label) {
      this[label] = Date.now();
    },
  };

  // ── Event listeners ───────────────────────────────────────────────────────
  live.on("open", () => {
    perf._mark("wsOpenTs");
    const wsOpenMs = perf.wsOpenTs - perf.sessionStart;
    console.log(
      `[STT] ✅ Deepgram WS opened  (+${wsOpenMs}ms from session create)`,
    );
  });

  live.on("message", (data) => {
    try {
      const response = JSON.parse(data.toString());

      if (response.type === "UtteranceEnd") {
        console.log("[STT] 🔇 UtteranceEnd received");
        onTranscript("", true); // empty final to signal end-of-utterance
        return;
      }

      const channel = response?.channel;
      const transcript = channel?.alternatives?.[0]?.transcript ?? "";

      if (!transcript) return;

      const isFinal = response.is_final === true;
      const now = Date.now();
      let latencyMs = null;

      if (!isFinal) {
        // ── Interim ──────────────────────────────────────────────────────────
        // Capture the timestamp of the first interim of this utterance
        if (!perf.utteranceStartTs) {
          perf.utteranceStartTs = now;
        }
        // Capture the global first-interim (full round-trip: mic → backend → Deepgram → backend)
        if (!perf.firstInterimTs) {
          perf.firstInterimTs = now;
          const audioToInterimMs = perf.firstAudioSentTs
            ? now - perf.firstAudioSentTs
            : null;
          console.log(
            `[STT] ⚡ First interim arrived` +
              (audioToInterimMs !== null
                ? `  (${audioToInterimMs}ms from first audio chunk)`
                : ""),
          );
        }
        if (process.env.STT_DEBUG === "true") {
          console.log(`[STT] interim: "${transcript}"`);
        }
      } else {
        // ── Final ────────────────────────────────────────────────────────────
        perf.utteranceCount++;
        const words = transcript.trim().split(/\s+/).filter(Boolean).length;
        perf.wordCount += words;

        // Calculate true processing/network latency:
        // We know exactly when the audio segment ended relative to the start of streaming
        // (response.start + response.duration) * 1000.
        // True Latency = Now - (First Audio Sent Time + Audio Segment End Time).
        if (
          perf.firstAudioSentTs &&
          response.start !== undefined &&
          response.duration !== undefined
        ) {
          const segmentEndStreamTimeMs = Math.round(
            (response.start + response.duration) * 1000,
          );
          const segmentEndWallTimeMs =
            perf.firstAudioSentTs + segmentEndStreamTimeMs;
          latencyMs = now - segmentEndWallTimeMs;
          perf.utteranceLatencies.push(latencyMs);
        } else if (perf.utteranceStartTs) {
          // Fallback if timestamps are missing
          latencyMs = now - perf.utteranceStartTs;
          perf.utteranceLatencies.push(latencyMs);
        }
        perf.utteranceStartTs = null; // reset for next utterance

        console.log(
          `[STT] ✅ FINAL #${perf.utteranceCount}` +
            (latencyMs !== null ? `  ${latencyMs}ms (net/proc)` : "") +
            `  (${words}w)  "${transcript}"`,
        );
      }

      onTranscript(transcript, isFinal, latencyMs);
    } catch (e) {
      console.error("[STT] ⚠️ Error parsing Deepgram message:", e.message);
    }
  });

  live.on("error", (err) => {
    console.error("[STT] ❌ Deepgram error:", err);
    onError(err);
  });

  live.on("close", (code, reason) => {
    const sessionDurationMs = Date.now() - perf.sessionStart;
    const lats = perf.utteranceLatencies;

    // ── Performance summary ──────────────────────────────────────────────────
    console.log("\n┌─────────────────────────────────────────────────┐");
    console.log("│           STT SESSION PERFORMANCE REPORT        │");
    console.log("├─────────────────────────────────────────────────┤");
    console.log(
      `│  Session duration   : ${(sessionDurationMs / 1000).toFixed(2)}s`.padEnd(
        50,
      ) + "│",
    );
    console.log(
      `│  WS open latency    : ${perf.wsOpenTs ? perf.wsOpenTs - perf.sessionStart + "ms" : "—"}`.padEnd(
        50,
      ) + "│",
    );

    if (perf.firstAudioSentTs && perf.firstInterimTs) {
      const audioToFirst = perf.firstInterimTs - perf.firstAudioSentTs;
      console.log(`│  Audio→first interim: ${audioToFirst}ms`.padEnd(50) + "│");
    }

    console.log(
      `│  Utterances         : ${perf.utteranceCount}`.padEnd(50) + "│",
    );
    console.log(`│  Total words        : ${perf.wordCount}`.padEnd(50) + "│");
    console.log("├─────────────────────────────────────────────────┤");

    if (lats.length > 0) {
      const avg = Math.round(lats.reduce((a, b) => a + b, 0) / lats.length);
      const min = Math.min(...lats);
      const max = Math.max(...lats);

      lats.forEach((ms, i) => {
        const tag = ms < 400 ? "🟢 fast" : ms < 800 ? "🟡 ok  " : "🔴 slow";
        console.log(
          `│  Utterance ${String(i + 1).padStart(2)}  ${tag}  ${String(ms).padStart(5)}ms`.padEnd(
            50,
          ) + "│",
        );
      });

      console.log("├─────────────────────────────────────────────────┤");
      console.log(`│  Avg latency        : ${avg}ms`.padEnd(50) + "│");
      console.log(`│  Best latency       : ${min}ms`.padEnd(50) + "│");
      console.log(`│  Worst latency      : ${max}ms`.padEnd(50) + "│");
    } else {
      console.log("│  No utterances recorded.                         │");
    }

    console.log(`│  Close code         : ${code}`.padEnd(50) + "│");
    console.log("└─────────────────────────────────────────────────┘\n");

    // Propagate unexpected closes as errors so the caller can notify the user
    if (code !== 1000 && code !== 1001) {
      onError(
        new Error(`Deepgram WS closed unexpectedly (code=${code}: ${reason})`),
      );
    }
  });

  // ── Public controller ─────────────────────────────────────────────────────
  return {
    /**
     * Pipe a raw audio chunk from the browser into Deepgram.
     * @param {Buffer | ArrayBuffer} chunk
     */
    sendAudio(chunk) {
      if (live.readyState === WebSocket.OPEN) {
        // Stamp the first audio chunk leaving this backend — used for round-trip latency
        if (!perf.firstAudioSentTs) {
          perf._mark("firstAudioSentTs");
        }
        live.send(chunk);
      }
    },

    /**
     * Blueprint §1 keepAlive — call this every 2 s while waiting for AI/TTS
     * so Deepgram doesn't time out the WebSocket.
     */
    keepAlive() {
      if (live.readyState === WebSocket.OPEN) {
        live.send(JSON.stringify({ type: "KeepAlive" }));
      }
    },

    /**
     * Gracefully close the Deepgram connection when the user is done.
     */
    finish() {
      if (live.readyState === WebSocket.OPEN) {
        // Send a CloseStream message to let Deepgram finish processing
        live.send(JSON.stringify({ type: "CloseStream" }));
      }
    },
  };
}

module.exports = { createDeepgramLiveSession };
