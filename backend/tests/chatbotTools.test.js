const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createRecommendationReply } = require("../services/roleRecommendationService");

const publicResult = { title: "Public career report", url: "https://example.org/careers", snippet: "Public career context, with qualifications." };
const toolCompletion = (query, id = "call1") => ({ choices: [{ finish_reason: "tool_calls", message: {
  reasoning_content: "Synthetic private reasoning marker",
  tool_calls: [{ id, type: "function", function: { name: "web_search", arguments: JSON.stringify({ query }) } }],
} }] });
const finalCompletion = (data = {}) => ({ choices: [{ finish_reason: "stop", message: {
  content: JSON.stringify({ reply: "Here is the career context.", recommendedRoleId: null, confidence: "low", sourceIds: [], ...data }),
} }] });
function mockClient(responses, payloads = []) {
  return { chat: { completions: { create: async (payload, options) => {
    payloads.push(JSON.parse(JSON.stringify({ ...payload, timeout: options.timeout })));
    assert.ok(responses.length, "Unexpected additional AI call");
    return responses.shift();
  } } } };
}

test("current-information searches return selected server sources and keep reasoning private", async () => {
  const payloads = [];
  const queries = [];
  const result = await createRecommendationReply({ message: "Compare junior IT salaries in the Philippines" }, {
    client: mockClient([toolCompletion("junior IT salaries Philippines PHP monthly"), finalCompletion({ sourceIds: ["s1", "fake"], sources: [{ url: "https://fake.org" }] })], payloads),
    search: async (query, options) => { queries.push(query); assert.ok(options.timeoutMs <= 10000); return [publicResult]; },
  });
  assert.equal(payloads[0].tools[0].function.name, "web_search");
  assert.equal(queries.length, 1);
  assert.deepEqual(result.sources, [{ id: "s1", title: publicResult.title, url: publicResult.url }]);
  assert.equal(result.searchStatus, "used");
  assert.equal(payloads[1].messages[2].reasoning_content, "Synthetic private reasoning marker");
  assert.equal(payloads[1].messages[3].role, "tool");
  assert.equal(JSON.parse(payloads[1].messages[3].content).results[0].id, "s1");
  assert.equal(JSON.stringify(result).includes("private reasoning"), false);
  assert.equal(JSON.stringify(result).includes("fake.org"), false);
});

test("platform explanations and salary clarification require no tool call", async () => {
  let searches = 0;
  const payloads = [];
  const result = await createRecommendationReply({ message: "whats like the most expensive role" }, {
    client: mockClient([finalCompletion({ reply: "Do you mean highest paying? Which country and experience level should I compare?" })], payloads),
    search: async () => { searches += 1; return []; },
  });
  assert.equal(searches, 0);
  assert.match(result.reply, /country and experience/);
  assert.match(payloads[0].messages[0].content, /highest paying/);
  assert.match(payloads[0].messages[0].content, /ITerview questions using only the guide/);
  assert.match(payloads[0].messages[0].content, /general knowledge help/);
  assert.match(payloads[0].messages[0].content, /Do not search while asking a clarifying question/);
});

test("missing search configuration advertises no tool or fake verification", async t => {
  const previous = process.env.TAVILY_API_KEY;
  delete process.env.TAVILY_API_KEY;
  t.after(() => { if (previous !== undefined) process.env.TAVILY_API_KEY = previous; });
  const payloads = [];
  const result = await createRecommendationReply({ message: "How does ITerview work?" }, {
    client: mockClient([finalCompletion({ sourceIds: ["s1"] })], payloads),
  });
  assert.equal(payloads[0].tools, undefined);
  assert.match(payloads[0].messages[0].content, /Web search is currently unavailable/);
  assert.equal(result.sources, undefined);
});

test("search outages fall back without logging provider text or fabricating sources", async t => {
  const logs = [];
  t.mock.method(console, "warn", (...args) => logs.push(args));
  const payloads = [];
  const result = await createRecommendationReply({ message: "Current IT job demand in the Philippines" }, {
    client: mockClient([toolCompletion("IT job demand Philippines"), finalCompletion({ reply: "I couldn't verify current job demand. I can explain the main career paths.", sourceIds: ["s1"] })], payloads),
    search: async () => { throw new Error("Synthetic private provider marker"); },
  });
  assert.equal(result.searchStatus, "unavailable");
  assert.equal(result.sources, undefined);
  assert.equal(JSON.parse(payloads[1].messages.at(-1).content).status, "unavailable");
  assert.equal(logs[0][1].reason, "provider_error");
  assert.equal(JSON.stringify(logs).includes("private provider"), false);
});

test("unsafe queries are rejected before the search provider", async () => {
  for (const query of ["person@example.org salary", "sk-synthetic0123456789", " "]) {
    let searches = 0;
    const payloads = [];
    const result = await createRecommendationReply({ message: "Compare career paths" }, {
      client: mockClient([toolCompletion(query), finalCompletion()], payloads),
      search: async () => { searches += 1; return [publicResult]; },
    });
    assert.equal(searches, 0);
    assert.equal(result.searchStatus, "unavailable");
    assert.equal(JSON.parse(payloads[1].messages.at(-1).content).status, "invalid_query");
  }
});

test("unsupported tools are rejected without execution", async t => {
  t.mock.method(console, "error", () => {});
  let searches = 0;
  const completion = toolCompletion("public query");
  completion.choices[0].message.tool_calls[0].function.name = "read_file";
  await assert.rejects(createRecommendationReply({ message: "Explain SQL" }, {
    client: mockClient([completion]), search: async () => { searches += 1; },
  }), error => error.reason === "invalid_tool_call");
  assert.equal(searches, 0);
});

test("search calls stop at one and final output receives its evidence", async () => {
  const payloads = [];
  let searches = 0;
  const result = await createRecommendationReply({ message: "Compare career demand" }, {
    client: mockClient([toolCompletion("career demand report", "a"), finalCompletion({ sourceIds: ["s1"] })], payloads),
    search: async () => { searches += 1; return [publicResult]; },
  });
  assert.equal(searches, 1);
  assert.equal(payloads[1].tools[0].function.name, "web_search");
  assert.equal(payloads[1].tool_choice, "none");
  assert.equal(payloads[1].messages.filter(message => message.role === "tool").length, 1);
  assert.equal(result.sources.length, 1);
});

test("output recovery retains search evidence without repeating the search", async t => {
  t.mock.method(console, "error", () => {});
  const payloads = [];
  let searches = 0;
  const invalid = { choices: [{ finish_reason: "stop", message: { content: "not JSON" } }] };
  const result = await createRecommendationReply({ message: "Current career demand" }, {
    client: mockClient([toolCompletion("career demand report"), invalid, finalCompletion({ sourceIds: ["s1"] })], payloads),
    search: async () => { searches += 1; return [publicResult]; },
  });
  assert.equal(searches, 1);
  assert.equal(payloads[2].response_format.type, "text");
  assert.equal(payloads[2].tool_choice, "none");
  assert.equal(JSON.parse(payloads[2].messages.at(-1).content).results[0].id, "s1");
  assert.equal(result.sources[0].url, publicResult.url);
});

test("search rounds share the deadline with final generation", async t => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const payloads = [];
  await createRecommendationReply({ message: "Current career demand" }, {
    client: mockClient([toolCompletion("career demand report"), finalCompletion()], payloads),
    search: async () => { now += 8000; return []; },
  });
  assert.deepEqual(payloads.map(payload => payload.timeout), [60000, 52000]);
});

test("private search results and unselected evidence are not exposed as sources", async () => {
  const result = await createRecommendationReply({ message: "Career demand" }, {
    client: mockClient([toolCompletion("career demand report"), finalCompletion({ sourceIds: ["s99"] })]),
    search: async () => [publicResult, { ...publicResult, url: "https://example.org/private", snippet: "sk-synthetic0123456789" }],
  });
  assert.equal(result.sources, undefined);
  assert.equal(JSON.stringify(result).includes("synthetic"), false);
});

test("guarded final replies omit search evidence", async () => {
  const result = await createRecommendationReply({ message: "Career demand" }, {
    client: mockClient([toolCompletion("career demand report"), finalCompletion({ reply: "sk-synthetic0123456789", sourceIds: ["s1"] })]),
    search: async () => [publicResult],
  });
  assert.equal(result.mode, "guarded");
  assert.equal(result.sources, undefined);
});

test("parallel tool calls execute one search and report the limit for the other", async () => {
  const first = toolCompletion("career report", "a");
  first.choices[0].message.tool_calls.push(toolCompletion("salary report", "b").choices[0].message.tool_calls[0]);
  const payloads = [];
  let searches = 0;
  await createRecommendationReply({ message: "Compare junior careers in the Philippines" }, {
    client: mockClient([first, finalCompletion()], payloads),
    search: async () => { searches += 1; return [publicResult]; },
  });
  assert.equal(searches, 1);
  assert.deepEqual(payloads[1].messages.filter(message => message.role === "tool").map(message => message.tool_call_id), ["a", "b"]);
  assert.deepEqual(payloads[1].messages.filter(message => message.role === "tool").map(message => JSON.parse(message.content).status), ["ok", "limit_reached"]);
  assert.equal(payloads[1].tool_choice, "none");
});

test("a model ignoring the exhausted tool budget cannot make a second search", async t => {
  t.mock.method(console, "error", () => {});
  let searches = 0;
  await assert.rejects(createRecommendationReply({ message: "Career demand" }, {
    client: mockClient([toolCompletion("career report", "a"), toolCompletion("salary report", "b")]),
    search: async () => { searches += 1; return []; },
  }), error => error.reason === "tool_limit");
  assert.equal(searches, 1);
});

test("malformed tool arguments return an invalid-query result instead of executing", async () => {
  const completion = toolCompletion("career report");
  completion.choices[0].message.tool_calls[0].function.arguments = "not JSON";
  const payloads = [];
  let searches = 0;
  await createRecommendationReply({ message: "Career demand" }, {
    client: mockClient([completion, finalCompletion()], payloads),
    search: async () => { searches += 1; return []; },
  });
  assert.equal(searches, 0);
  assert.equal(JSON.parse(payloads[1].messages.at(-1).content).status, "invalid_query");
});
