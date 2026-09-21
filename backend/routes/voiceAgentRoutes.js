const express = require("express");
const {
  getVoiceAgentModel,
  handleVoiceAgentChatCompletion,
} = require("../services/voiceAgentAiService");

const router = express.Router();

router.get("/health", (req, res) => {
  const usesLlmProxy = Boolean(process.env.VOICE_AGENT_LLM_ENDPOINT_URL);
  const configured = Boolean(
    process.env.DEEPGRAM_API_KEY &&
      process.env.DEEPSEEK_API_KEY &&
      (!usesLlmProxy || process.env.VOICE_AGENT_LLM_PROXY_TOKEN),
  );

  res.status(configured ? 200 : 503).json({
    configured,
    model: getVoiceAgentModel(),
    llmMode: usesLlmProxy ? "proxy" : "direct",
    websocketPath: "/ws/voice-agent",
  });
});

// OpenAI-compatible endpoint called by Deepgram, not by the browser.
router.post("/llm", handleVoiceAgentChatCompletion);

module.exports = router;
