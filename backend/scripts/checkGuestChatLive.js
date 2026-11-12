// Opt-in diagnostic: spends real DeepSeek and Tavily credits, using public test
// messages and the guest service's normal prompt, validation and retry path.
// Never prints credentials, system prompts, or private model reasoning.
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const { OpenAI } = require("openai");
const { createRecommendationReply } = require("../services/roleRecommendationService");
const { isWebSearchConfigured, searchWeb } = require("../services/chatbotWebSearchService");

if (!process.argv.includes("--live")) {
  console.error("Requires --live: this diagnostic calls the configured AI and web-search providers.");
  process.exit(1);
}
if (!process.env.DEEPSEEK_API_KEY || !isWebSearchConfigured()) {
  console.error("Configure DeepSeek and enable Tavily before running the live check.");
  process.exit(1);
}

const provider = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
  timeout: 60000,
  maxRetries: 0,
});
const cases = [
  { name: "platform-help", message: "What is ITerview?", expectsSearch: false },
  { name: "salary-clarification", message: "What is the most expensive role on your list?", expectsSearch: false },
  {
    name: "salary-follow-up",
    message: "Philippines, entry level. Search and compare the highest paying careers among your tracks in PHP per month.",
    history: [
      { role: "user", content: "What is the most expensive role on your list?" },
      { role: "assistant", content: "Do you mean highest paying? Which country and experience level should I compare?" },
    ],
    expectsSearch: true,
  },
  {
    name: "backend-salary-search",
    message: "Search the web for junior backend developer salaries in the Philippines in PHP per month, with sources.",
    expectsSearch: true,
  },
  {
    name: "career-demand-search",
    message: "Search current junior IT career demand in the Philippines in 2026 and compare tracks using sources.",
    expectsSearch: true,
  },
];

function jsonDiagnostics(content) {
  if (typeof content !== "string" || !content.trim()) return {};
  let inString = false;
  let escaped = false;
  let rawStringControls = 0;
  let repaired = "";
  for (const char of content) {
    if (inString && !escaped && char.charCodeAt(0) < 32) {
      rawStringControls += 1;
      repaired += JSON.stringify(char).slice(1, -1);
      continue;
    }
    repaired += char;
    if (escaped) escaped = false;
    else if (inString && char === "\\") escaped = true;
    else if (char === '"') inString = !inString;
  }
  let validAfterEscapingControls = false;
  try { JSON.parse(repaired); validAfterEscapingControls = true; } catch { /* metadata only */ }
  return {
    startsObject: content.trim().startsWith("{"),
    endsObject: content.trim().endsWith("}"),
    hasFence: content.includes("```"),
    rawStringControls,
    validAfterEscapingControls,
  };
}

async function main() {
  const reports = [];
  const requestedCase = process.argv.find(arg => arg.startsWith("--case="))?.slice(7);
  const selectedCases = requestedCase ? cases.filter(scenario => scenario.name === requestedCase) : cases;
  if (!selectedCases.length) throw new Error("Unknown diagnostic case");
  const repeat = Number(process.argv.find(arg => arg.startsWith("--repeat="))?.slice(9) || 1);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 3) throw new Error("Repeat must be 1 to 3");
  for (const scenario of Array.from({ length: repeat }, () => selectedCases).flat()) {
    const startedAt = Date.now();
    const calls = [];
    let searches = 0;
    let searchResultCount = 0;
    const client = { chat: { completions: { create: async (payload, options) => {
      const startedCallAt = Date.now();
      const completion = await provider.chat.completions.create(payload, options);
      const choice = completion.choices?.[0];
      const content = choice?.message?.content;
      let validJson = false;
      try { JSON.parse(content); validJson = true; } catch { /* metadata only */ }
      calls.push({
        format: payload.response_format.type,
        finishReason: choice?.finish_reason,
        contentCharacters: typeof content === "string" ? content.length : 0,
        trimmedContentCharacters: typeof content === "string" ? content.trim().length : 0,
        validJson,
        ...(!validJson ? jsonDiagnostics(content) : {}),
        elapsedMs: Date.now() - startedCallAt,
      });
      return completion;
    } } } };
    let result;
    let failure;
    try {
      result = await createRecommendationReply(scenario, {
        client,
        search: async (query, options) => {
          searches += 1;
          const results = await searchWeb(query, options);
          searchResultCount += results.length;
          return results;
        },
      });
    } catch (error) {
      failure = error.reason || "unexpected_error";
    }
    const finalCalls = calls.filter(call => call.finishReason !== "tool_calls").length;
    const passed = Boolean(result?.reply) && result.mode !== "guarded"
      && searches === (scenario.expectsSearch ? 1 : 0)
      && (!scenario.expectsSearch || (result.searchStatus === "used" && result.sources?.length > 0));
    const report = {
      name: scenario.name, passed, elapsedMs: Date.now() - startedAt,
      modelCalls: calls.length, outputRetries: Math.max(0, finalCalls - 1),
      searches, searchResultCount, calls,
      ...(failure ? { failure } : {}),
      ...(result ? { reply: result.reply, sources: result.sources || [], searchStatus: result.searchStatus } : {}),
    };
    reports.push(report);
    console.log(JSON.stringify(report));
  }
  const summary = {
    summary: true, passed: reports.filter(report => report.passed).length, total: reports.length,
    outputRetries: reports.reduce((sum, report) => sum + report.outputRetries, 0),
    searches: reports.reduce((sum, report) => sum + report.searches, 0),
  };
  console.log(JSON.stringify(summary));
  if (process.argv.includes("--report")) {
    const fs = require("node:fs");
    const reportPath = path.join(__dirname, "../../output/guest-chat-live-report.json");
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ checkedAt: new Date().toISOString(), summary, reports }, null, 2));
  }
  if (reports.some(report => !report.passed)) process.exitCode = 1;
}

main().catch(() => { console.error("Live diagnostic failed."); process.exitCode = 1; });
