// Simple terminal output for the standalone Voice Agent.
// We only show what STT heard, what TTS will say, and the AI thinking time.

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

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

      if (event.type === "ConversationText") {
        const text = cleanText(event.content || event.text);
        if (!text) return;

        if (event.role === "user") {
          writeLine(`[STT] You: ${text}`);
        }

        if (event.role === "assistant") {
          writeLine(`[TTS] AI: ${text}`);
        }
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
        writeLine(
          `[VOICE WARNING] ${event.description || event.message || "Unknown warning"}`,
        );
      }

      if (event.type === "Error") {
        writeLine(
          `[VOICE ERROR] ${event.description || event.message || "Unknown error"}`,
        );
      }
    },

    error(error) {
      writeLine(`[VOICE ERROR] ${error?.message || String(error)}`);
    },
  };
}

module.exports = { createVoiceAgentTelemetry };
