const { OpenAI } = require("openai");
const { setTimeout: delay } = require("node:timers/promises");
const { VALID_ROLES } = require("../config/roleConfig");
const { getRoleCatalogue } = require("./chatbotKnowledgeService");
const { buildSystemPrompt } = require("./chatbotPrompt");
const {
  containsSensitiveContent,
  getRefusalReply,
  isBlockedRequest,
  isInstructionOverride,
} = require("./chatbotGuardrails");

const DEFAULT_MODEL = "deepseek-flash";
const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 600;
const THINKING_TOKEN_BUDGET = 8192;
const AI_TIMEOUT_MS = 60000;
const MAX_AI_ATTEMPTS = 2;
const RETRY_DELAY_MS = 250;
const MIN_RETRY_BUDGET_MS = 1000;
const RETRYABLE_FAILURES = new Set([
  "empty_reply", "invalid_reply", "provider_interrupted", "provider_connection", "provider_temporary",
]);
const OUTPUT_RECOVERY_FAILURES = new Set(["empty_reply", "invalid_reply"]);
const FINISH_REASONS = new Set([
  "stop", "length", "content_filter", "tool_calls", "insufficient_system_resource", "aborted",
]);
const OUTPUT_RECOVERY_INSTRUCTIONS = `Output requirements for this response:
Return one complete JSON object with a nonempty reply, a valid recommendedRoleId or null, and confidence.
Example of the required format (format only; answer the current student message):
{"reply":"What part of an IT project do you enjoy working on?","recommendedRoleId":null,"confidence":"low"}
Do not output Markdown fences, commentary outside the JSON object, or an empty response. All preceding factual and safety rules still apply.`;

class AssistantUnavailableError extends Error {
  constructor(reason = "provider_error") {
    super("The ITerview assistant is temporarily unavailable. Please try again.");
    this.name = "AssistantUnavailableError";
    this.reason = reason;
  }
}

function safeProviderStatus(error) {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function classifyFailure(error) {
  if (error instanceof AssistantUnavailableError) return error.reason;
  if (error?.name === "APIConnectionTimeoutError") return "provider_timeout";
  if (error?.name === "APIConnectionError") return "provider_connection";
  const status = safeProviderStatus(error);
  if (status === 401 || status === 403) return "provider_auth";
  if (status === 402) return "provider_balance";
  if (status === 429) return "provider_rate_limit";
  if (status >= 500 || status === 408) return "provider_temporary";
  return "provider_error";
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function completionMetadata(completion) {
  if (!completion) return {};
  const choice = completion.choices?.[0];
  const content = choice?.message?.content;
  return {
    choiceCount: Array.isArray(completion.choices) ? completion.choices.length : 0,
    finishReason: FINISH_REASONS.has(choice?.finish_reason) ? choice.finish_reason : "unknown",
    contentCharacters: typeof content === "string" ? content.length : 0,
    hasReasoning: typeof choice?.message?.reasoning_content === "string"
      && Boolean(choice.message.reasoning_content.trim()),
    completionTokens: safeCount(completion.usage?.completion_tokens),
    reasoningTokens: safeCount(completion.usage?.completion_tokens_details?.reasoning_tokens),
  };
}

function outputRecoveryPayload(payload) {
  // DeepSeek documents empty content in JSON mode. Keep native thinking and
  // validate the final JSON ourselves while changing the provider output mode.
  return {
    ...payload,
    response_format: { type: "text" },
    messages: payload.messages.map((message) => message.role === "system"
      ? { ...message, content: `${message.content}\n\n${OUTPUT_RECOVERY_INSTRUCTIONS}` }
      : message),
  };
}

function readCompletion(completion) {
  const choice = completion?.choices?.[0];
  if (choice?.finish_reason && choice.finish_reason !== "stop") {
    const reason = choice.finish_reason === "content_filter"
      ? "provider_content_filter"
      : choice.finish_reason === "length"
      ? "output_truncated"
      : ["insufficient_system_resource", "aborted"].includes(choice.finish_reason)
        ? "provider_interrupted"
        : "unexpected_finish";
    throw new AssistantUnavailableError(reason);
  }
  // Consume only the final answer. Never return, store, or log reasoning_content.
  if (typeof choice?.message?.content !== "string" || !choice.message.content.trim()) {
    throw new AssistantUnavailableError("empty_reply");
  }
  const normalized = normalizeModelReply(choice.message.content);
  if (!normalized) throw new AssistantUnavailableError("invalid_reply");
  return normalized;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item) =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string" &&
        item.content.trim() &&
        !isInstructionOverride(item.content) &&
        (item.role !== "user" || !isBlockedRequest(item.content)) &&
        item.content.trim() !== getRefusalReply().reply &&
        !containsSensitiveContent(item.content)
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }));
}

function normalizeModelReply(raw) {
  if (containsSensitiveContent(raw || "")) return getRefusalReply();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed.reply !== "string" || !parsed.reply.trim()) return null;
  // Request-attack keywords are not an output classifier: a safe explanation may mention them.
  if (containsSensitiveContent(parsed.reply)) return getRefusalReply();
  if (parsed.recommendedRoleId != null && !VALID_ROLES.includes(parsed.recommendedRoleId)) return null;

  const recommendedRoleId = VALID_ROLES.includes(parsed.recommendedRoleId)
    ? parsed.recommendedRoleId
    : null;
  const confidence = ["low", "medium", "high"].includes(parsed.confidence)
    ? parsed.confidence
    : recommendedRoleId
      ? "medium"
      : "low";

  return {
    reply: parsed.reply.trim().replace(/[—–]/g, "-").slice(0, 900),
    recommendedRoleId,
    confidence,
    mode: "ai-thinking",
  };
}

async function createRecommendationReply({ message, history = [] }, { client: suppliedClient } = {}) {
  if (isBlockedRequest(message) || containsSensitiveContent(message)) return getRefusalReply();
  const cleanMessage = String(message || "")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
  const cleanHistory = sanitizeHistory(history);
  const systemPrompt = buildSystemPrompt();
  if (!systemPrompt || (!process.env.DEEPSEEK_API_KEY && !suppliedClient)) {
    const reason = !systemPrompt ? "knowledge_unavailable" : "configuration_missing";
    console.error("[RoleRecommendation] AI unavailable", { reason });
    throw new AssistantUnavailableError(reason);
  }

  const client = suppliedClient || new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
    timeout: AI_TIMEOUT_MS,
    maxRetries: 0,
  });
  const payload = {
    model: process.env.DEEPSEEK_CHATBOT_MODEL || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    thinking: { type: "enabled" },
    reasoning_effort: "high",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify({ conversation: cleanHistory, message: cleanMessage }) },
    ],
    response_format: { type: "json_object" },
    max_tokens: THINKING_TOKEN_BUDGET,
  };
  const startedAt = Date.now();
  let recoverOutput = false;

  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
    const attemptPayload = recoverOutput ? outputRecoveryPayload(payload) : payload;
    let completion;
    try {
      // Retries share the original deadline; SDK retries stay disabled.
      const remainingMs = AI_TIMEOUT_MS - (Date.now() - startedAt);
      if (remainingMs <= 0) throw new AssistantUnavailableError("provider_timeout");
      completion = await client.chat.completions.create(attemptPayload, { timeout: remainingMs });
      return readCompletion(completion);
    } catch (error) {
      const reason = classifyFailure(error);
      const elapsedMs = Date.now() - startedAt;
      const retrying = attempt < MAX_AI_ATTEMPTS && RETRYABLE_FAILURES.has(reason)
        && AI_TIMEOUT_MS - elapsedMs > RETRY_DELAY_MS + MIN_RETRY_BUDGET_MS;
      // Only fixed categories and numeric metadata; never provider text or generated content.
      console.error("[RoleRecommendation] AI request failed", {
        reason, status: safeProviderStatus(error), attempt, elapsedMs, retrying,
        requestFormat: attemptPayload.response_format.type,
        ...completionMetadata(completion),
      });
      if (!retrying) throw new AssistantUnavailableError(reason);
      recoverOutput = OUTPUT_RECOVERY_FAILURES.has(reason);
      await delay(RETRY_DELAY_MS);
    }
  }
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  AssistantUnavailableError,
  buildSystemPrompt,
  createRecommendationReply,
  getRoleCatalogue,
  normalizeModelReply,
  sanitizeHistory,
};
