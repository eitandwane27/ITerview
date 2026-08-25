// backend/controllers/demoSocket.js
// ─────────────────────────────────────────────────────────────────────────────
// Anonymous Interactive "Try It Live" Demo WebSocket Controller
//
// Handles the /ws/demo path for unauthenticated landing-page visitors.
//   - No auth required (no uid parameter)
//   - 30-second server-side auto-cutoff per recording
//   - Forwards Deepgram transcripts to the client
//   - Computes deterministic 3C scores (Clarity, Correctness, Completeness)
//     when a turn completes (isFinal === true)
// ─────────────────────────────────────────────────────────────────────────────

const { createDeepgramLiveSession } = require("../services/sttService");

const MAX_RECORDING_MS = 30 * 1000; // 30-second hard cap

/**
 * Deterministic 3C scoring based on transcript length, structure, and
 * technical depth. Scores are 0–100 integers.
 *
 * @param {string} text - The final transcript to score.
 * @returns {{ clarity: number, correctness: number, completeness: number }}
 */
function compute3CScores(text) {
  const t = (text || "").trim();
  const words = t.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ── Clarity: structure & organization ────────────────────────────────────
  // Reward structured language (sequencing, transitions) and reasonable length.
  const structureMarkers = [
    "first", "firstly", "second", "secondly", "third", "then", "next",
    "finally", "lastly", "start", "started", "begin", "beginning",
    "step", "steps", "approach", "process", "method", "way", "how",
    "i'd", "i would", "i'll", "i will", "so", "because", "therefore",
    "for example", "for instance", "in order to", "to do", "you can",
  ];
  let structureHits = 0;
  const lower = t.toLowerCase();
  structureMarkers.forEach((m) => {
    if (lower.includes(m)) structureHits++;
  });

  // Clarity base: 40 + structure bonus (up to 30) + length bonus (up to 30)
  let clarity = 40;
  clarity += Math.min(30, structureHits * 6);
  if (wordCount >= 8) clarity += 10;
  else if (wordCount >= 4) clarity += 5;
  if (wordCount >= 20) clarity += 10;
  else if (wordCount >= 12) clarity += 5;
  clarity = Math.min(100, Math.max(0, clarity));

  // ── Correctness: technical keyword depth ─────────────────────────────────
  const techKeywords = [
    // General
    "api", "database", "server", "client", "request", "response", "endpoint",
    "query", "sql", "nosql", "index", "indexing", "cache", "caching",
    "performance", "latency", "throughput", "optimize", "optimization",
    "debug", "debugging", "profile", "profiling", "monitor", "monitoring",
    "log", "logs", "logging", "error", "exception", "stack", "trace",
    "timeout", "retry", "load", "scal", "scale", "scaling", "concurr",
    "async", "await", "promise", "callback", "event", "stream", "buffer",
    // Frontend
    "react", "component", "state", "props", "hook", "usestate", "useeffect",
    "redux", "context", "render", "virtual", "dom", "css", "html", "javascript",
    "typescript", "bundle", "bundling", "code splitting", "lazy", "suspense",
    "memo", "memoization", "key", "list", "array", "object",
    // Backend
    "node", "express", "python", "java", "go", "golang", "spring", "django",
    "flask", "rest", "graphql", "websocket", "http", "https", "json", "xml",
    "middleware", "route", "controller", "service", "model", "schema",
    "migration", "transaction", "join", "foreign", "primary", "key",
    "normalization", "denormalization", "sharding", "replication",
    // DevOps
    "docker", "kubernetes", "k8s", "container", "ci", "cd", "pipeline",
    "deploy", "deployment", "aws", "azure", "gcp", "cloud", "terraform",
    "ansible", "jenkins", "github", "actions", "nginx", "load balancer",
    "microservice", "monolith", "observability", "grafana", "prometheus",
    "elastic", "kibana", "sentry", "new relic", "datadog",
  ];
  let techHits = 0;
  techKeywords.forEach((kw) => {
    if (lower.includes(kw)) techHits++;
  });

  // Correctness base: 35 + keyword bonus (up to 45) + length bonus (up to 20)
  let correctness = 35;
  correctness += Math.min(45, techHits * 5);
  if (wordCount >= 10) correctness += 10;
  else if (wordCount >= 5) correctness += 5;
  if (wordCount >= 25) correctness += 10;
  else if (wordCount >= 15) correctness += 5;
  correctness = Math.min(100, Math.max(0, correctness));

  // ── Completeness: coverage & depth ───────────────────────────────────────
  // Reward longer, more detailed answers that address multiple aspects.
  let completeness = 30;
  if (wordCount >= 5) completeness += 10;
  if (wordCount >= 10) completeness += 10;
  if (wordCount >= 15) completeness += 10;
  if (wordCount >= 25) completeness += 10;
  if (wordCount >= 40) completeness += 10;
  // Bonus for covering multiple distinct ideas (unique words)
  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  if (uniqueWords >= 15) completeness += 10;
  if (uniqueWords >= 25) completeness += 10;
  completeness = Math.min(100, Math.max(0, completeness));

  return {
    clarity: Math.round(clarity),
    correctness: Math.round(correctness),
    completeness: Math.round(completeness),
  };
}

/**
 * handleDemoSocket(ws, request)
 * @param {import("ws").WebSocket} ws
 * @param {import("http").IncomingMessage} request
 */
function handleDemoSocket(ws, request) {
  console.log("[WS-DEMO] 🔌 Anonymous Try-It-Live demo connected");

  let sttSession = null;
  let isRecording = false;
  let recordingTimer = null;
  let fullTranscript = "";

  // ── Helpers ───────────────────────────────────────────────────────────────
  function send(obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function openSttSession() {
    fullTranscript = "";
    sttSession = createDeepgramLiveSession(
      // onTranscript
      (transcript, isFinal) => {
        if (transcript || isFinal) {
          send({ type: "transcript", text: transcript, isFinal });
          if (isFinal && transcript) {
            fullTranscript = fullTranscript
              ? `${fullTranscript} ${transcript}`
              : transcript;
          }
        }

        // When a turn completes, compute and send deterministic 3C scores
        if (isFinal) {
          const scores = compute3CScores(fullTranscript || transcript);
          console.log(
            `[WS-DEMO] 🎯 3C Scores — Clarity: ${scores.clarity} | Correctness: ${scores.correctness} | Completeness: ${scores.completeness}`
          );
          send({ type: "scores", ...scores });
        }
      },
      // onError
      (err) => {
        send({ type: "error", message: `STT error: ${err.message}` });
        clearRecordingTimer();
        closeSttSession();
      },
    );
    isRecording = true;
  }

  function closeSttSession() {
    if (sttSession) {
      sttSession.finish();
      sttSession = null;
    }
    isRecording = false;
  }

  function clearRecordingTimer() {
    if (recordingTimer) {
      clearTimeout(recordingTimer);
      recordingTimer = null;
    }
  }

  function startRecordingTimer() {
    clearRecordingTimer();
    recordingTimer = setTimeout(() => {
      console.log("[WS-DEMO] ⏱️ 30-second auto-cutoff reached — stopping recording");
      closeSttSession();
      send({ type: "recording_timeout", message: "30-second limit reached" });
      send({ type: "status", message: "Recording stopped (30s limit)" });
    }, MAX_RECORDING_MS);
  }

  // ── Incoming message handler ──────────────────────────────────────────────
  ws.on("message", (data, isBinary) => {
    // Binary frame → raw audio chunk
    if (isBinary) {
      if (sttSession && isRecording) sttSession.sendAudio(data);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "start_recording":
        if (!isRecording) {
          openSttSession();
          startRecordingTimer();
          send({ type: "status", message: "Listening..." });
        }
        break;

      case "stop_recording":
        clearRecordingTimer();
        closeSttSession();
        send({ type: "status", message: "Recording stopped." });
        break;

      default:
        break;
    }
  });

  // ── Connection close ──────────────────────────────────────────────────────
  ws.on("close", () => {
    console.log("[WS-DEMO] 🔌 Demo client disconnected — cleaning up");
    clearRecordingTimer();
    closeSttSession();
  });

  ws.on("error", (err) => {
    console.error("[WS-DEMO] ❌ WebSocket error:", err.message);
    clearRecordingTimer();
    closeSttSession();
  });
}

module.exports = { handleDemoSocket };
