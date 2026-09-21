const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createVoiceAgentTelemetry,
} = require("../services/voiceAgentTelemetry");

test("Voice Agent prints only the useful beginner-friendly information", () => {
  const lines = [];
  const telemetry = createVoiceAgentTelemetry({
    writeLine: (line) => lines.push(line),
  });

  telemetry.event({ type: "UserStartedSpeaking" });
  telemetry.event({ type: "AgentThinking" });
  telemetry.event({
    type: "ConversationText",
    role: "user",
    content: "I am nervous about interviews.",
  });
  telemetry.event({
    type: "ConversationText",
    role: "assistant",
    content: "That makes sense. What part feels hardest?",
  });
  telemetry.event({
    type: "LatencyReport",
    ttt_text_latency: 0.36,
  });

  assert.deepEqual(lines, [
    "[STT] You: I am nervous about interviews.",
    "[TTS] AI: That makes sense. What part feels hardest?",
    "[AI SPEED] Thought for 0.36 seconds before sending text to TTS",
  ]);
});
