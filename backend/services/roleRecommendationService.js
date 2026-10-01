const { OpenAI } = require("openai");
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

class AssistantUnavailableError extends Error {
  constructor() {
    super("The ITerview assistant is temporarily unavailable. Please try again.");
    this.name = "AssistantUnavailableError";
  }
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
  if (!systemPrompt || (!process.env.DEEPSEEK_API_KEY && !suppliedClient)) throw new AssistantUnavailableError();

  try {
    const client = suppliedClient || new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
      timeout: AI_TIMEOUT_MS,
      maxRetries: 0,
    });
    const completion = await client.chat.completions.create({
      model: process.env.DEEPSEEK_CHATBOT_MODEL || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
      thinking: { type: "enabled" },
      reasoning_effort: "high",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ conversation: cleanHistory, message: cleanMessage }) },
      ],
      response_format: { type: "json_object" },
      max_tokens: THINKING_TOKEN_BUDGET,
    });

    const choice = completion.choices?.[0];
    if (choice?.finish_reason && choice.finish_reason !== "stop") throw new AssistantUnavailableError();
    // Consume only the final answer. Never return, store, or log reasoning_content.
    const normalized = normalizeModelReply(choice?.message?.content);
    if (!normalized) throw new AssistantUnavailableError();
    return normalized;
  } catch (error) {
    // Provider errors can contain request details; never log their body or messages.
    console.error("[RoleRecommendation] AI request failed", { status: Number(error.status) || null });
    throw new AssistantUnavailableError();
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
