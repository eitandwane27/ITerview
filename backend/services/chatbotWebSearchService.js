const { isIP } = require("node:net");
const { containsSensitiveContent, isBlockedRequest } = require("./chatbotGuardrails");

const SEARCH_URL = "https://api.tavily.com/search";
const MAX_SEARCH_RESULTS = 5;
const MAX_QUERY_LENGTH = 300;
const SEARCH_FAILURES = new Set([
  "not_configured", "invalid_query", "timeout", "authentication", "rate_limit",
  "provider_error", "invalid_response",
]);

class WebSearchError extends Error {
  constructor(reason) {
    super("Web search is unavailable.");
    this.reason = SEARCH_FAILURES.has(reason) ? reason : "provider_error";
  }
}

function isWebSearchConfigured() {
  return process.env.CHATBOT_WEB_SEARCH_ENABLED !== "false"
    && Boolean(process.env.TAVILY_API_KEY?.trim());
}

function isSafeSearchQuery(query) {
  return typeof query === "string" && Boolean(query.trim())
    && query.length <= MAX_QUERY_LENGTH
    && !containsSensitiveContent(query) && !isBlockedRequest(query)
    && !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(query)
    && !/\b(?:\+?\d[\s().-]*){10,}\b/.test(query);
}

function publicSourceUrl(raw) {
  if (typeof raw !== "string" || raw.length > 2000 || containsSensitiveContent(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password
      || !url.hostname.includes(".") || isIP(url.hostname)
      || !/^[a-z\d.-]+$/i.test(url.hostname)
      || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeSearchResults(results) {
  if (!Array.isArray(results)) return [];
  const seen = new Set();
  const normalized = [];
  for (const result of results.slice(0, 20)) {
    const url = publicSourceUrl(result?.url);
    if (!url || seen.has(url) || typeof result.title !== "string"
      || typeof result.content !== "string") continue;
    const title = result.title.trim().slice(0, 160);
    const snippet = result.content.trim().slice(0, 1800);
    if (!title || !snippet || containsSensitiveContent(title + "\n" + snippet)) continue;
    seen.add(url);
    normalized.push({ title, url, snippet });
    if (normalized.length >= MAX_SEARCH_RESULTS) break;
  }
  return normalized;
}

async function searchWeb(query, { timeoutMs = 10000, fetch: fetchImpl = globalThis.fetch } = {}) {
  if (!isSafeSearchQuery(query)) throw new WebSearchError("invalid_query");
  if (!isWebSearchConfigured()) throw new WebSearchError("not_configured");
  try {
    const response = await fetchImpl(SEARCH_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.TAVILY_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, 10000))),
      body: JSON.stringify({
        query: query.trim(), search_depth: "basic", topic: "general",
        max_results: MAX_SEARCH_RESULTS, include_answer: false,
        include_raw_content: false, include_images: false,
      }),
    });
    if (!response.ok) {
      throw new WebSearchError(response.status === 401 || response.status === 403
        ? "authentication" : [429, 432, 433].includes(response.status)
          ? "rate_limit" : "provider_error");
    }
    // Keep third-party responses bounded; never fetch result URLs ourselves.
    const body = await response.text();
    if (body.length > 100000) throw new WebSearchError("invalid_response");
    let data;
    try { data = JSON.parse(body); } catch { throw new WebSearchError("invalid_response"); }
    if (!Array.isArray(data?.results)) throw new WebSearchError("invalid_response");
    return normalizeSearchResults(data.results);
  } catch (error) {
    if (error instanceof WebSearchError) throw error;
    throw new WebSearchError(["TimeoutError", "AbortError"].includes(error?.name)
      ? "timeout" : "provider_error");
  }
}

module.exports = {
  isWebSearchConfigured, isSafeSearchQuery, normalizeSearchResults, publicSourceUrl,
  searchWeb, WebSearchError,
};
