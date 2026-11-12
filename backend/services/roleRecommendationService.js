const { OpenAI } = require("openai");
const { setTimeout: delay } = require("node:timers/promises");
const { VALID_ROLES } = require("../config/roleConfig");
const { getRoleCatalogue } = require("./chatbotKnowledgeService");
const { buildSystemPrompt } = require("./chatbotPrompt");
const {
  isWebSearchConfigured, isSafeSearchQuery, normalizeSearchResults, searchWeb, WebSearchError,
} = require("./chatbotWebSearchService");
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
const MAX_WEB_SEARCH_CALLS = 1;
// A model may propose parallel calls. Answer each, but execute only one search.
const MAX_TOOL_CALLS_PER_ROUND = 2;
const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description: "Use only when an answer needs current external information (such as salary figures, job demand, or recent changes), or the user explicitly asks for a web search or source verification. Do not use for greetings, ITerview help, stable explanations, writing help, or ordinary track guidance. At most one search per reply. Ask for country and experience level before comparing salaries. Never send personal details.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "A concise public search query, at most 300 characters. Never include emails, phone numbers, credentials, or full conversation text." } },
      required: ["query"], additionalProperties: false,
    },
  },
};
const RETRYABLE_FAILURES = new Set([
  "empty_reply", "invalid_reply", "provider_interrupted", "provider_connection", "provider_temporary",
]);
const OUTPUT_RECOVERY_FAILURES = new Set(["empty_reply", "invalid_reply"]);
const VALIDATION_FAILURES = new Set([
  "malformed_json", "invalid_object", "missing_reply", "invalid_reply_type",
  "empty_reply", "invalid_role_id_type", "unsupported_role_id",
]);
const FINISH_REASONS = new Set([
  "stop", "length", "content_filter", "tool_calls", "insufficient_system_resource", "aborted",
]);
const OUTPUT_RECOVERY_INSTRUCTIONS = `Output requirements for this response:
Return one complete JSON object with a nonempty reply, a valid recommendedRoleId or null, confidence, and sourceIds.
Example of the required format (format only; answer the current student message):
{"reply":"What part of an IT project do you enjoy working on?","recommendedRoleId":null,"confidence":"low","sourceIds":[]}
Do not output Markdown fences, commentary outside the JSON object, or an empty response. Encode line breaks inside reply as JSON newline escapes. All preceding factual and safety rules still apply.`;

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
    trimmedContentCharacters: typeof content === "string" ? content.trim().length : 0,
    hasReasoning: typeof choice?.message?.reasoning_content === "string"
      && Boolean(choice.message.reasoning_content.trim()),
    completionTokens: safeCount(completion.usage?.completion_tokens),
    reasoningTokens: safeCount(completion.usage?.completion_tokens_details?.reasoning_tokens),
  };
}

function outputRecoveryPayload(payload) {
  // DeepSeek documents occasional empty JSON output and recommends adjusting
  // the prompt. Keep JSON mode: text mode removes the formatting guarantee
  // precisely when we need to recover a machine-readable answer.
  return {
    ...payload,
    response_format: { type: "json_object" },
    messages: payload.messages.map((message) => message.role === "system"
      ? { ...message, content: `${message.content}\n\n${OUTPUT_RECOVERY_INSTRUCTIONS}` }
      : message),
  };
}

function readCompletion(completion, availableSources = []) {
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
  const { normalized, validationFailure, sourceIds = [] } = validateModelReply(choice.message.content);
  if (!normalized) {
    const error = new AssistantUnavailableError("invalid_reply");
    error.validationFailure = validationFailure;
    throw error;
  }
  if (normalized.mode === "guarded") return normalized;
  const sources = availableSources.filter(source => sourceIds.includes(source.id))
    .slice(0, 5).map(({ id, title, url }) => ({ id, title, url }));
  return sources.length ? { ...normalized, sources } : normalized;
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
      content: item.content.trim().slice(0, item.role === "assistant" ? 900 : MAX_MESSAGE_LENGTH),
    }));
}

function validateModelReply(raw) {
  if (containsSensitiveContent(raw || "")) return { normalized: getRefusalReply() };
  const invalid = (validationFailure) => ({ normalized: null, validationFailure });
  // Accept only a complete JSON fence, not JSON extracted from surrounding prose.
  const content = typeof raw === "string" ? raw.trim() : "";
  const fenced = content.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  let parsed;
  try {
    parsed = JSON.parse(fenced ? fenced[1] : content);
  } catch {
    return invalid("malformed_json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return invalid("invalid_object");
  if (!Object.hasOwn(parsed, "reply")) return invalid("missing_reply");
  if (typeof parsed.reply !== "string") return invalid("invalid_reply_type");
  if (!parsed.reply.trim()) return invalid("empty_reply");
  // Request-attack keywords are not an output classifier: a safe explanation may mention them.
  if (containsSensitiveContent(parsed.reply)) return { normalized: getRefusalReply() };
  // A quoted null means no recommendation; never guess or map unsupported IDs.
  const roleId = parsed.recommendedRoleId === "null" ? null : parsed.recommendedRoleId;
  if (roleId != null && typeof roleId !== "string") return invalid("invalid_role_id_type");
  if (roleId != null && !VALID_ROLES.includes(roleId)) return invalid("unsupported_role_id");

  const recommendedRoleId = VALID_ROLES.includes(roleId)
    ? roleId
    : null;
  const confidence = ["low", "medium", "high"].includes(parsed.confidence)
    ? parsed.confidence
    : recommendedRoleId
      ? "medium"
      : "low";

  return { sourceIds: Array.isArray(parsed.sourceIds)
    ? parsed.sourceIds.filter(id => typeof id === "string").slice(0, 5) : [], normalized: {
    reply: parsed.reply.trim().replace(/[—–]/g, "-").slice(0, 2400),
    recommendedRoleId,
    confidence,
    mode: "ai-thinking",
  } };
}

function normalizeModelReply(raw) {
  return validateModelReply(raw).normalized;
}

async function createRecommendationReply({ message, history = [] }, { client: suppliedClient, search: suppliedSearch,
  progressContext = null, allowWebSearch = true } = {}) {
  if (isBlockedRequest(message) || containsSensitiveContent(message)) return getRefusalReply();
  const cleanMessage = String(message || "")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
  const cleanHistory = sanitizeHistory(history);
  const search = allowWebSearch ? suppliedSearch || (isWebSearchConfigured() ? searchWeb : null) : null;
  const systemPrompt = buildSystemPrompt(undefined, { webSearchEnabled: Boolean(search), progressContext });
  if (!systemPrompt || (!process.env.DEEPSEEK_API_KEY && !suppliedClient)) {
    const reason = !systemPrompt ? "knowledge_unavailable" : "configuration_missing";
    console.error("[RoleRecommendation] AI unavailable", { reason });
    throw new AssistantUnavailableError(reason);
  }

  const client = suppliedClient || new OpenAI({
    logLevel: "off",
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
    ...(search ? { tools: [WEB_SEARCH_TOOL], tool_choice: "auto" } : {}),
  };
  const startedAt = Date.now();
  let recoverOutput = false;
  let conversationMessages = [...payload.messages];
  let searchCalls = 0;
  let modelCalls = 0;
  let searchStatus;
  const availableSources = [];

  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
    let attemptPayload = { ...payload, messages: conversationMessages };
    if (recoverOutput) attemptPayload = outputRecoveryPayload(attemptPayload);
    let completion;
    try {
      while (true) {
        // Tool rounds and output retries share the original deadline and call limits.
        const remainingMs = AI_TIMEOUT_MS - (Date.now() - startedAt);
        if (remainingMs <= 0) throw new AssistantUnavailableError("provider_timeout");
        if (modelCalls >= MAX_AI_ATTEMPTS + MAX_WEB_SEARCH_CALLS) {
          throw new AssistantUnavailableError("tool_limit");
        }
        if (search && searchCalls >= MAX_WEB_SEARCH_CALLS) {
          // Keep tool definitions so DeepSeek preserves reasoning in the exchange;
          // disable further calls through tool_choice instead of dropping tools.
          // Restate the output contract after the untrusted search results, close
          // to answer generation rather than only in the long initial prompt.
          attemptPayload = {
            ...attemptPayload,
            tool_choice: "none",
            messages: [...attemptPayload.messages, { role: "system", content: OUTPUT_RECOVERY_INSTRUCTIONS }],
          };
        }
        modelCalls += 1;
        completion = await client.chat.completions.create(attemptPayload, { timeout: remainingMs });
        const choice = completion?.choices?.[0];
        if (choice?.finish_reason !== "tool_calls") {
          const result = readCompletion(completion, availableSources);
          return result.mode !== "guarded" && searchStatus ? { ...result, searchStatus } : result;
        }
        if (!search || searchCalls >= MAX_WEB_SEARCH_CALLS) {
          throw new AssistantUnavailableError("tool_limit");
        }
        const toolCalls = choice.message?.tool_calls;
        if (!Array.isArray(toolCalls) || !toolCalls.length || toolCalls.length > MAX_TOOL_CALLS_PER_ROUND
          || new Set(toolCalls.map(tool => tool?.id)).size !== toolCalls.length
          || toolCalls.some(tool => typeof tool?.id !== "string" || !tool.id || tool.id.length > 200
            || tool.type !== "function" || tool.function?.name !== "web_search"
            || typeof tool.function.arguments !== "string" || tool.function.arguments.length > 2000)) {
          throw new AssistantUnavailableError("invalid_tool_call");
        }
        // DeepSeek needs its reasoning in the tool exchange. Keep it request-local,
        // never client-visible, in conversation history, or in logs.
        conversationMessages = [...attemptPayload.messages, {
          role: "assistant", content: null, tool_calls: toolCalls,
          ...(typeof choice.message.reasoning_content === "string"
            ? { reasoning_content: choice.message.reasoning_content } : {}),
        }];
        for (const tool of toolCalls) {
          let toolResult;
          if (searchCalls >= MAX_WEB_SEARCH_CALLS) {
            toolResult = { status: "limit_reached", results: [] };
          } else {
            searchCalls += 1;
            let query;
            try { query = JSON.parse(tool.function.arguments)?.query; } catch { /* invalid query below */ }
            if (!isSafeSearchQuery(query)) {
              searchStatus ||= "unavailable";
              toolResult = { status: "invalid_query", results: [] };
            } else {
              try {
                const timeoutMs = AI_TIMEOUT_MS - (Date.now() - startedAt) - MIN_RETRY_BUDGET_MS;
                if (timeoutMs <= 0) throw new WebSearchError("timeout");
                const results = await search(query.trim(), { timeoutMs: Math.min(10000, timeoutMs) });
                // Validate every provider, including injected implementations, at the boundary.
                const safeResults = normalizeSearchResults(Array.isArray(results)
                  ? results.map(result => ({ ...result, content: result?.snippet ?? result?.content })) : []);
                const sources = safeResults.map(result => {
                  const existing = availableSources.find(source => source.url === result.url);
                  if (existing) return existing;
                  const source = { ...result, id: `s${availableSources.length + 1}` };
                  availableSources.push(source);
                  return source;
                });
                searchStatus = availableSources.length ? "used" : "unavailable";
                toolResult = { status: sources.length ? "ok" : "no_results", results: sources };
              } catch (error) {
                const reason = error instanceof WebSearchError ? error.reason : "provider_error";
                console.warn("[RoleRecommendation] Web search unavailable", { reason });
                searchStatus = availableSources.length ? "used" : "unavailable";
                toolResult = { status: "unavailable", results: [] };
              }
            }
          }
          conversationMessages.push({ role: "tool", tool_call_id: tool.id, content: JSON.stringify(toolResult) });
        }
        attemptPayload = { ...attemptPayload, messages: conversationMessages };
      }
    } catch (error) {
      const reason = classifyFailure(error);
      const elapsedMs = Date.now() - startedAt;
      const retrying = attempt < MAX_AI_ATTEMPTS && RETRYABLE_FAILURES.has(reason)
        && AI_TIMEOUT_MS - elapsedMs > RETRY_DELAY_MS + MIN_RETRY_BUDGET_MS;
      // Only fixed categories and numeric metadata; never provider text or generated content.
      console.error("[RoleRecommendation] AI request failed", {
        reason, status: safeProviderStatus(error), attempt, elapsedMs, retrying,
        requestFormat: attemptPayload.response_format.type,
        ...(reason === "invalid_reply" && VALIDATION_FAILURES.has(error?.validationFailure)
          ? { validationFailure: error.validationFailure } : {}),
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
  MAX_WEB_SEARCH_CALLS,
  AssistantUnavailableError,
  buildSystemPrompt,
  createRecommendationReply,
  getRoleCatalogue,
  normalizeModelReply,
  sanitizeHistory,
};
