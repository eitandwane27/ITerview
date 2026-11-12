const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createVoiceAgentTelemetry,
} = require("../services/voiceAgentTelemetry");

test("Voice Agent logs timing and error categories without conversation text", () => {
  const lines = [];
  const telemetry = createVoiceAgentTelemetry({
    writeLine: (line) => lines.push(line),
  });

  telemetry.event({ type: "UserStartedSpeaking" });
  telemetry.event({ type: "AgentThinking" });
  telemetry.event({
    type: "ConversationText",
    role: "user",
    content: "My email is student@example.test.",
  });
  telemetry.event({
    type: "ConversationText",
    role: "assistant",
    content: "I heard student@example.test.",
  });
  telemetry.event({
    type: "LatencyReport",
    ttt_text_latency: 0.36,
  });
  telemetry.event({ type: "Warning", description: "Warning about student@example.test" });
  telemetry.event({ type: "Error", message: "Could not process student@example.test" });

  assert.deepEqual(lines, [
    "[AI SPEED] Thought for 0.36 seconds before sending text to TTS",
    "[VOICE WARNING] Provider warning",
    "[VOICE ERROR] Provider error",
  ]);
});
