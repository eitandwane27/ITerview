// Voice Agent latency and provider status without conversation content.

function createVoiceAgentTelemetry({ writeLine = console.log } = {}) {
  let thinkingStartedAt = null;
  let thinkingTimeLogged = false;

  function logThinkingTime(seconds) {
    if (!Number.isFinite(seconds) || thinkingTimeLogged) return;
    thinkingTimeLogged = true;
    writeLine(
      `[AI SPEED] Thought for ${seconds.toFixed(2)} seconds before sending text to TTS`,
    );
  }

  return {
    event(event = {}) {
      if (event.type === "UserStartedSpeaking") {
        thinkingStartedAt = null;
        thinkingTimeLogged = false;
        return;
      }

      if (event.type === "AgentThinking") {
        thinkingStartedAt = Date.now();
        return;
      }

      if (event.type === "LatencyReport") {
        // Deepgram reports this in seconds: the time until the LLM produces
        // its first text for the TTS stage.
        logThinkingTime(event.ttt_text_latency);
        return;
      }

      // Fallback when a provider does not include ttt_text_latency.
      if (
        event.type === "AgentAudioDone" &&
        thinkingStartedAt &&
        !thinkingTimeLogged
      ) {
        logThinkingTime((Date.now() - thinkingStartedAt) / 1_000);
      }

      if (event.type === "Warning") {
        writeLine("[VOICE WARNING] Provider warning");
      }

      if (event.type === "Error") {
        writeLine("[VOICE ERROR] Provider error");
      }
    },

    error() {
      writeLine("[VOICE ERROR] Voice agent operation failed");
    },
  };
}

module.exports = { createVoiceAgentTelemetry };
