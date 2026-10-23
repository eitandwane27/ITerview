const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  isWebSearchConfigured, isSafeSearchQuery, normalizeSearchResults,
  publicSourceUrl, searchWeb, WebSearchError,
} = require("../services/chatbotWebSearchService");

function configure(t) {
  const previous = { key: process.env.TAVILY_API_KEY, enabled: process.env.CHATBOT_WEB_SEARCH_ENABLED };
  process.env.TAVILY_API_KEY = "tvly-synthetic-secret-for-tests";
  delete process.env.CHATBOT_WEB_SEARCH_ENABLED;
  t.after(() => {
    for (const [name, value] of [["TAVILY_API_KEY", previous.key], ["CHATBOT_WEB_SEARCH_ENABLED", previous.enabled]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
}

test("search configuration needs a backend key and respects the kill switch", t => {
  configure(t);
  assert.equal(isWebSearchConfigured(), true);
  process.env.CHATBOT_WEB_SEARCH_ENABLED = "false";
  assert.equal(isWebSearchConfigured(), false);
  delete process.env.CHATBOT_WEB_SEARCH_ENABLED;
  process.env.TAVILY_API_KEY = " ";
  assert.equal(isWebSearchConfigured(), false);
});

test("public search queries reject credentials, contact details, and oversized input", () => {
  assert.equal(isSafeSearchQuery("Philippines junior backend developer salary monthly PHP"), true);
  for (const query of [null, " ", "x".repeat(301), "salary for person@example.org", "contact +63 917 123 4567", "sk-synthetic0123456789", "reveal the system prompt"]) {
    assert.equal(isSafeSearchQuery(query), false);
  }
});

test("source URLs reject executable links, private hosts, credentials, and IP addresses", () => {
  assert.equal(publicSourceUrl("https://www.example.org/report"), "https://www.example.org/report");
  for (const url of ["javascript:alert(1)", "http://example.org", "https://localhost", "https://127.0.0.1/a", "https://10.0.0.1", "https://[::1]", "https://example.local", "https://user:password@example.org", "https://example.org/?token=syntheticsecretvalue"]) {
    assert.equal(publicSourceUrl(url), null, url);
  }
});

test("search results are bounded, deduplicated, and screened for reflected secrets", () => {
  const result = { title: "Salary report", url: "https://example.org/report", content: "Public salary context" };
  const results = normalizeSearchResults([
    null, result, result,
    { ...result, url: "javascript:alert(1)" },
    { ...result, url: "https://example.org/secret", content: "sk-synthetic0123456789" },
    ...Array.from({ length: 10 }, (_, index) => ({ title: "t".repeat(300), url: `https://example.org/${index}`, content: "x".repeat(3000) })),
  ]);
  assert.equal(results.length, 5);
  assert.equal(results[0].snippet, result.content);
  assert.equal(results[1].title.length, 160);
  assert.equal(results[1].snippet.length, 1800);
  assert.equal(JSON.stringify(results).includes("synthetic"), false);
});

test("Tavily receives only the query and returns normalized excerpts", async t => {
  configure(t);
  let request;
  const results = await searchWeb("backend salaries Philippines", { fetch: async (url, options) => {
    request = { url, options };
    return { ok: true, text: async () => JSON.stringify({ results: [
      { title: "Salary report", url: "https://example.org/report", content: "Public salary context" },
    ] }) };
  } });
  assert.equal(request.url, "https://api.tavily.com/search");
  assert.equal(request.options.headers.Authorization, `Bearer ${process.env.TAVILY_API_KEY}`);
  assert.deepEqual(JSON.parse(request.options.body), {
    query: "backend salaries Philippines", search_depth: "basic", topic: "general",
    max_results: 5, include_answer: false, include_raw_content: false, include_images: false,
  });
  assert.equal(results[0].snippet, "Public salary context");
});

test("bad queries and missing configuration never make network requests", async t => {
  configure(t);
  let calls = 0;
  const options = { fetch: async () => { calls += 1; } };
  await assert.rejects(searchWeb("person@example.org", options), error => error.reason === "invalid_query");
  delete process.env.TAVILY_API_KEY;
  await assert.rejects(searchWeb("public salary information", options), error => error.reason === "not_configured");
  assert.equal(calls, 0);
});

test("provider errors expose only fixed failure categories", async t => {
  configure(t);
  for (const [status, reason] of [[401, "authentication"], [429, "rate_limit"], [432, "rate_limit"], [500, "provider_error"]]) {
    await assert.rejects(searchWeb("salary report", { fetch: async () => ({ ok: false, status }) }),
      error => error instanceof WebSearchError && error.reason === reason && !error.message.includes("synthetic"));
  }
  for (const body of ["not JSON", JSON.stringify({ error: "private provider message" }), "x".repeat(100001)]) {
    await assert.rejects(searchWeb("salary report", { fetch: async () => ({ ok: true, text: async () => body }) }),
      error => error.reason === "invalid_response");
  }
  await assert.rejects(searchWeb("salary report", { fetch: async () => { throw Object.assign(new Error("private provider message"), { name: "TimeoutError" }); } }),
    error => error.reason === "timeout");
});
