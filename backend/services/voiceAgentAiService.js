// OpenAI-compatible DeepSeek adapter used only by the Deepgram Voice Agent.
// Deepgram calls this endpoint as its BYO LLM. Keeping the adapter here lets us
// force DeepSeek's native thinking mode off without changing the core evaluator.

const { OpenAI } = require("openai");

const DEFAULT_MODEL = "deepseek-flash";

function createDeepSeekClient() {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment");
  }

  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
}

function getVoiceAgentModel() {
  return (
    process.env.VOICE_AGENT_DEEPSEEK_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    DEFAULT_MODEL
  );
}

function getBearerToken(req) {
  const authorization = req.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function isAuthorized(req) {
  const expectedToken = process.env.VOICE_AGENT_LLM_PROXY_TOKEN;
  return Boolean(expectedToken) && getBearerToken(req) === expectedToken;
}

function buildDeepSeekRequest(body = {}) {
  return {
    ...body,
    model: getVoiceAgentModel(),
    messages: Array.isArray(body.messages) ? body.messages : [],
    stream: body.stream !== false,
    thinking: { type: "disabled" },
  };
}

async function handleVoiceAgentChatCompletion(req, res) {
  if (!process.env.VOICE_AGENT_LLM_PROXY_TOKEN) {
    return res.status(503).json({
      error: "VOICE_AGENT_LLM_PROXY_TOKEN is not configured on the server",
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!Array.isArray(req.body?.messages)) {
    return res.status(400).json({
      error: "'messages' must be an array in OpenAI Chat Completions format",
    });
  }

  try {
    const client = createDeepSeekClient();
    const request = buildDeepSeekRequest(req.body);

    if (!request.stream) {
      const completion = await client.chat.completions.create(request);
      return res.json(completion);
    }

    const stream = await client.chat.completions.create(request);

    res.status(200);
    res.set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    for await (const chunk of stream) {
      if (res.destroyed) break;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    if (!res.destroyed) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (error) {
    console.error("[VoiceAgent:LLM] DeepSeek request failed:", error.message);

    if (res.headersSent) {
      if (!res.destroyed) {
        res.write(
          `data: ${JSON.stringify({
            error: { message: "The voice agent LLM request failed" },
          })}\n\n`,
        );
        res.write("data: [DONE]\n\n");
        res.end();
      }
      return;
    }

    return res.status(error.status || 502).json({
      error: "The voice agent LLM request failed",
    });
  }
}

module.exports = {
  buildDeepSeekRequest,
  getVoiceAgentModel,
  handleVoiceAgentChatCompletion,
};
