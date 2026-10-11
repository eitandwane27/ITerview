// Original spoken adaptations; sources and validation: docs/ai-engineer-interview.md.
const scope = entries => ({ topicScope: entries.map(([name]) => name), topicKeywords: entries.map(([, words]) => words) });
const applied = (base, descriptions) => ({ ...base, topicScope: base.topicScope.map((name, i) => `${name}: ${descriptions[i]}`) });
const easy = scope([
  ['Language models', ['language model', 'generated text', 'generate text', 'pretrained', 'prediction']],
  ['Prompt basics', ['prompt', 'instruction', 'example', 'few shot']],
  ['Tokens and context', ['token', 'context window', 'input length', 'conversation history']],
  ['Retrieval basics', ['retrieval', 'retrieve', 'document', 'knowledge base', 'search']],
  ['Tool basics', ['tool', 'function call', 'calculator', 'API']],
  ['Answer verification', ['verification', 'verify', 'hallucination', 'factual', 'confident', 'claim']],
]);
const medium = scope([
  ['Chunk context', ['chunk', 'chunking', 'overlap', 'paragraph', 'split']],
  ['Semantic search', ['embedding', 'semantic', 'similarity', 'vector', 'nearest']],
  ['Grounded answers', ['grounded', 'grounding', 'citation', 'cited', 'evidence', 'source', 'unsupported']],
  ['Output contracts', ['schema', 'structured', 'JSON', 'field', 'validation', 'validate']],
  ['Task evaluation', ['evaluation', 'rubric', 'test set', 'regression', 'reference answer', 'quality']],
  ['Request handling', ['request', 'timeout', 'rate limit', 'retry', 'backoff', 'streaming', 'stream', 'streamed']],
]);
const hard = scope([
  ['Retrieval diagnosis', ['retrieval', 'retriever', 'rerank', 'reranking', 'candidate', 'ranking', 'recall', 'index']],
  ['Trust boundaries', ['injection', 'untrusted', 'permission', 'authorization', 'access control', 'private', 'malicious', 'disclosure', 'admin notes']],
  ['Tool effects', ['tool', 'side effect', 'duplicate', 'idempotency', 'idempotent', 'confirmation', 'booking', 'payment']],
  ['Evaluation validity', ['evaluation', 'judge', 'leakage', 'held out', 'benchmark', 'test set', 'grading', 'grader', 'reported accuracy', 'tune prompts']],
  ['Model adaptation', ['fine tuning', 'fine tune', 'fine tuned', 'weights', 'parameters', 'adaptation', 'behavior', 'training example', 'changing facts']],
  ['Resource tradeoffs', ['latency', 'cost', 'cache', 'cached', 'caching', 'cache validity', 'cached answer', 'budget', 'loop', 'streaming', 'streamed', 'completion time', 'first visible text', 'token limit']],
]);
const examples = {
  easy: {
    focus_clarity: [
      'What is a pretrained language model used for?',
      'What is a prompt used for in a text generation task?',
      'What does a context window limit?',
      'What is document retrieval used for in a question answering app?',
      'What is a calculator tool used for in an AI app?',
      'What does a hallucination mean in a factual answer?',
    ],
    focus_correctness: [
      'How does generated text differ from a verified fact?',
      'How does a task instruction differ from an example in a prompt?',
      'How does a token differ from a whole word?',
      'How does document retrieval differ from generating an answer?',
      'How does requesting a tool call differ from executing that tool?',
      'How does a confident claim differ from a verified claim?',
    ],
    focus_completeness: [
      'Name two familiar tasks for a pretrained language model?',
      'Name two useful parts of a task prompt?',
      'Name two kinds of content that consume context window space?',
      'Name two details to retain with a retrieved document?',
      'Name two details needed to describe a calculator tool?',
      'Name two checks for a factual claim in a generated answer?',
    ],
  },
  medium: {
    focus_clarity: [
      'Why can splitting a paragraph between chunks remove useful context?',
      'How does an embedding help semantic search find related wording?',
      'Why should a grounded answer be checked against its cited evidence?',
      'Why does schema validation matter before using structured model output?',
      'Why does a fixed evaluation test set help reveal regressions after prompt changes?',
      'Why can bounded backoff help when requests encounter a temporary rate limit?',
    ],
    focus_correctness: [
      'How does chunk overlap differ from keeping each passage in only one chunk?',
      'How does semantic similarity differ from exact keyword matching?',
      'How does citing evidence differ from evidence actually supporting a claim?',
      'How does valid JSON differ from meeting a required output schema?',
      'How does a task rubric differ from a reference answer in an evaluation?',
      'How does receiving the first streamed text differ from receiving a completed response?',
    ],
    focus_completeness: [
      'Name two chunk context checks before indexing a long document?',
      'Name two semantic search checks for a known relevant passage?',
      'Name two grounded answer checks for a cited claim?',
      'Name two schema validation checks before accepting structured output?',
      'Name two evaluation cases for a document question answering app?',
      'Name two request handling checks when retrying a temporary rate limit?',
    ],
  },
  hard: {
    focus_clarity: [
      'Why can reranking retrieved candidates alone not recover a relevant passage absent from those candidates?',
      'Why does labeling untrusted text alone not enforce tool authorization against prompt injection?',
      'Why can retrying a booking tool after an ambiguous timeout create a duplicate booking?',
      'Why can adjusting prompts using evaluation test answers inflate apparent performance on that same test set?',
      'Why can fine tuning for response style leave changing facts out of date?',
      'Why can a cached answer become unsuitable after permissions change even when the user question is unchanged?',
    ],
    focus_correctness: [
      'How does missing a relevant retrieval candidate differ from ranking an included relevant candidate too low?',
      'How does application enforced authorization differ from asking a model to respect permissions?',
      'A booking tool commits before its response times out; an unprotected retry commits again; what happens to the booking count?',
      'How does a held out evaluation differ from evaluating on cases used to adjust the prompt?',
      'How does fine tuning model weights differ from supplying current facts at inference time?',
      'How does streaming change time to first text compared with time to a complete answer?',
    ],
    focus_completeness: [
      'Name three retrieval checks when a known relevant passage is missing from the final answer context?',
      'Name three trust boundary checks before untrusted content can influence a private document search?',
      'Name three tool execution safeguards against duplicate effects after an ambiguous timeout?',
      'Name three evaluation validity checks before trusting an automated judge comparison?',
      'Name three model adaptation checks before fine tuning a task response behavior?',
      'Name three cache validity checks before reusing an answer for a private knowledge base?',
    ],
  },
};
const focusDetails = {
  easy: {
    focus_clarity: ['explain use of pretrained text models', 'explain task instructions', 'explain finite input space', 'explain finding reference passages', 'explain external calculation', 'explain unsupported generated claims'],
    focus_correctness: ['distinguish generated text from verified fact', 'distinguish instructions from demonstrations', 'distinguish tokens from whole words', 'distinguish finding information from generating text', 'distinguish requesting an action from execution', 'distinguish fluent confidence from evidence'],
    focus_completeness: ['name two familiar text tasks', 'name two prompt components', 'name two input content types', 'name two document reference details', 'name two tool description details', 'name two factual verification checks'],
  },
  medium: {
    focus_clarity: ['explain lost meaning at chunk boundaries', 'explain semantic embeddings', 'explain checking citation support', 'explain validating fields and types', 'explain controlled prompt comparisons', 'explain bounded waiting on temporary request limits'],
    focus_correctness: ['compare overlapping with disjoint passages', 'compare semantic and lexical matching', 'compare citation presence with claim support', 'compare parseable output with a valid schema', 'compare rubric criteria with reference answers', 'compare first streamed text with completed response'],
    focus_completeness: ['name two chunk context checks', 'name two retrieval relevance checks', 'name two evidence support checks', 'name two output contract checks', 'name two task evaluation cases', 'name two bounded retry checks'],
  },
  hard: {
    focus_clarity: ['explain candidate recall limits on reranking', 'explain permissions outside model instructions', 'explain ambiguous commit before retry', 'explain evaluation contamination', 'explain behavior adaptation versus factual freshness', 'explain cache isolation when permissions change'],
    focus_correctness: ['compare missing candidates with poor ranking', 'compare enforced and suggested access control', 'predict two commits under stated unprotected retry', 'compare held out and prompt development cases', 'compare parameter adaptation with current reference inputs', 'compare time to first text with completion time without claiming faster completion'],
    focus_completeness: ['name three candidate generation and ranking checks', 'name three private retrieval trust checks', 'name three duplicate side effect safeguards', 'name three judge validity checks', 'name three adaptation evidence checks', 'name three cache scope and freshness checks'],
  },
};
const focused = (base, difficulty) => ({ ...base, focusTopics: Object.fromEntries(Object.entries(focusDetails[difficulty]).map(([focus, descriptions]) => [focus, applied(base, descriptions)])) });
module.exports = {
  id: 'ai-engineer', label: 'AI Engineer',
  avoidList: `AI ENGINEER SPOKEN SCOPE:
- Target students building small applications with pretrained language models. Use original short questions about prompts, tokens, retrieval, tool calls, output validation, evaluation and bounded reliability. No code, API signatures, library trivia, vendor prices, foundation model training, advanced mathematics, GPU deployment or senior architecture. Set 3 remains shared behavioral practice.
- Ask one task only. Clarity explains one meaning or mechanism; correctness identifies a behavior or compares two concepts; completeness names two items for easy and medium, three for hard. Do not append an example, procedure, explanation list or and why. Start directly with the requested task and one short premise if needed. Aim for at most 24 words in easy, 32 in medium and 45 in hard. Do not request three introductory definitions as a hard task.
- A pretrained language model generates text from learned patterns and input; generated fluency, confidence or a citation is not proof of truth. Hallucination means an unsupported or fabricated claim in the task context. Do not claim all generated text is false. Verification requires relevant reliable evidence, not asking the same model to repeat its answer.
- A prompt can contain instructions, examples and reference information. Tokens may be words or word pieces, not always whole words. Context windows are finite and provider specific; no fixed capacity or exact word to token ratio. Context history is not a durable memory guarantee. Do not equate more tokens or longer prompts with better accuracy.
- Retrieval finds reference passages and supplies them at inference; it does not automatically change model weights or make answers correct. Keep source identity and version. Chunks may lose referents or conditions at boundaries; overlap may help but can duplicate content and consume space. No universal chunk size, overlap, top K or similarity cutoff.
- Embeddings support semantic similarity, not truth, access permission or calibrated answer confidence. Compatible embedding models and preprocessing matter. Similarity ranking is not a guarantee of relevance. A reranker can reorder or select its given candidates but cannot recover an absent passage unless additional retrieval is explicitly performed. Separate missing candidates from poor ranking; never assume more candidates always improve answers.
- Grounding requires checking whether evidence actually supports the claim and applies to the question. A source citation alone proves neither. If the task requires answers only from supplied sources and evidence is missing, acknowledge insufficient evidence instead of inventing a fact. State this source-only requirement before prescribing abstention. Retrieval errors and generation errors need separate evidence.
- Valid JSON is parseable; schema compliance concerns fields, types and constraints. Schema compliant output can still be factually wrong, unauthorized or outside a business rule. Tool calls are proposed inputs; application code validates and authorizes execution. Never claim JSON, schemas or tool descriptions guarantee safe or correct effects. State the validation and rejection policy before predicting acceptance.
- Evaluate a defined task with fixed criteria, representative cases and defensible references; exact string matching alone can penalize valid paraphrases. Keep a held out test set separate from cases used to adjust prompts or fine tune. Repeatedly tuning against a test set contaminates it. An automated judge needs comparison with human judgments and checks for preference or ordering bias; no universal metric, score threshold or single result proves general quality.
- Treat retrieved pages and tool results as untrusted data. Delimiters and instructions can reduce confusion but do not enforce access control or guarantee injection prevention. Authorization, input validation, least privilege and permission filtering belong in application code before data disclosure or side effects. Filtering private results after model exposure is too late to prevent that exposure. Avoid requesting real secrets or malicious payload construction.
- Retrying a read-only generation request differs from retrying an action with side effects. A timeout does not prove a booking or payment was never committed. State commit status and retry protection before predicting duplicates. Stable idempotency keys require server enforcement and appropriate scope; keys alone are not magic. Check execution status before retry where possible, use durable duplicate protection, and obtain required authorization.
- A completed generation attempt followed by a retry does not determine which answer is displayed or whether two answers appear. State the app's response selection policy before an outcome question, or ask which completion status to check. Do not import booking side effects into an ordinary text request.
- Keep timeout ambiguity and duplicate protection as separate questions unless asking one direct connection. Never append an explanation of a second safeguard to an explanation of uncertain commit status. Use one short premise, not a long scenario listing a symptom and its complete remedy.
- For prompt injection ask about the risk or the application boundary. A malicious instruction alone does not establish model compliance, access to private records or actual disclosure. Predict exposure only when the app's access, actual private inputs and enforcement behavior are specified. Do not say output filtering is too late when the prompt contains only an instruction requesting secrets and no actual secret information.
- Cache questions should compare required validity with reusing stale entries, not ask why an old answer is still served without a stated reuse policy. For cross-user exposure state that a shared cache reuses entries across users without a permission check; identical cache keys alone do not prove disclosure. Prefer why can stale reuse be unsafe to why can it still be served.
- For ranking-versus-recall comparisons, the ranking case must explicitly include the relevant passage among candidates passed to the reranker, ordered too low for final context. A passage ranked eighth when only five are retrieved is already a missing candidate for that reranker, not a distinct included-candidate ranking failure.
- Correctness predictions about a retried action must state that each attempt commits, or specify a server enforced deduplication rule. Never ask for the most likely commit outcome from a timeout alone. For authorization explanations state that application code blocks unauthorized access; a model following injected text alone cannot overcome that enforced boundary.
- Do not hide a yes-or-no or binary is this X or Y task after a context semicolon. Ask for one focused comparison or state an outcome question directly. For cached sources that change, ask about freshness risk or source preservation rather than predicting all answers become wrong; exact output needs a specified changed fact and generation behavior. Loop bounds cannot promise a useful answer when evidence remains insufficient: permit a clear limited or insufficient-evidence result at budget exhaustion.
- A comparison asks for one distinction, not both causes and remedies. Do not append the fix each requires to a comparison of failure types. Ask about loop stopping or cache validity separately; do not combine a loop already bounded to five attempts with a request to bound it while also repairing cache freshness. Prefer short direct questions over long paired scenarios.
- Supplying current facts improves available evidence; it does not guarantee that the model follows it, returns correct facts or overrides old learned answers. Never say retrieval keeps answers accurate or prevents staleness as a guaranteed result. Ask how access to current evidence differs from fixed past training, why it may help, or what remains to verify. Predict a factual answer only under an explicit rule that the app uses and returns the supplied current fact.
- Do not repeat the same fine tuning versus current policy freshness distinction in a session with different wording or format. Inspect history for the tested fact and choose a different scoped mechanism if that distinction already appeared; varied wording alone is not a new task.
- Fine tuning changes weights using training examples for task behavior; retrieval supplies relevant facts at inference. Either can fail and they can be combined. Fine tuning alone does not keep changing facts fresh, erase arbitrary secrets reliably or guarantee output correctness. Define the actual behavior problem and baseline evaluation before recommending adaptation; not every failure calls for fine tuning.
- Streaming can reduce time to first visible text without reducing time to complete an answer. Low sampling temperature is not a correctness or universal determinism guarantee. Bounded retries with backoff may help transient rate limits but do not repair invalid inputs or permissions. No endless retries or loops. A token limit bounds generation length and can truncate output; it does not guarantee sufficient answers.
- Cache validity depends on input, source version, relevant user permissions and model or prompt version. Reusing answers across users must not expose private information; identical questions alone do not justify reuse. Cache hits can avoid work when valid but do not imply fresh evidence or universally better accuracy. State the reuse scope before asking for a cache outcome.`,
  difficultyAvoidLists: {
    easy: 'Use familiar text generation, instructions, examples, token meanings, document lookup, calculator tools and factual checks. No chunk optimization, embedding compatibility, structured schemas, rate limit recovery, fine tuning, agent loops, idempotency, prompt injection mechanisms or judge bias. Testing asks two simple checks for one answer, not a complete trustworthy app audit.',
    medium: 'Use one applied chunk context, semantic matching, evidence support, structured output, task rubric or request handling question. No private authorization chains, duplicate side effect recovery, evaluation leakage mechanisms, reranker recall limits, judge bias, cross-user cache isolation or fine tuning decisions. For first streamed text distinguish completion status, not total latency guarantees.',
    hard: 'Use one bounded retrieval failure, trust boundary, tool effect, evaluation validity, adaptation or resource tradeoff under explicit premises. At most three connected reasoning steps. No enterprise design, training algorithms, inference infrastructure benchmarks, exact retry schedules or universal safeguards.',
  },
  set1: { ...medium, difficultyTopics: { easy: focused(easy, 'easy'), medium: focused(medium, 'medium'), hard: focused(hard, 'hard') }, easyExamples: examples.easy, mediumExamples: examples.medium, hardExamples: examples.hard },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: applied(easy, ['identify familiar text tasks', 'supply clear task instructions', 'recognize finite input space', 'find reference documents', 'request external calculation', 'verify factual claims']),
      medium: applied(medium, ['preserve meaning at passage boundaries', 'retrieve semantically related passages', 'check whether cited evidence supports claims', 'validate output shape before use', 'compare task results with fixed criteria', 'handle transient request failures and streaming status']),
      hard: applied(hard, ['distinguish absent evidence from ranking failure', 'enforce private access despite untrusted instructions', 'avoid duplicate effects when commit status is unclear', 'protect evaluation independence and judge validity', 'select behavior adaptation under changing facts', 'bound loops and preserve cache scope under resource constraints']),
    },
    easyExamples: [
      'What is a pretrained language model used for?',
      'Why is a clear task instruction useful in a prompt?',
      'How does document retrieval differ from generating an answer?',
      'An app executes a requested calculator tool for two plus three; what result does the tool return?',
      'Name two checks for a factual claim in a generated answer?',
      'You need a summary of a short passage; what instruction should the prompt give?',
    ],
    mediumExamples: [
      'How does an embedding help semantic search match related wording?',
      'Why is preserving paragraph context useful when creating document chunks?',
      'How does valid JSON differ from meeting a required output schema?',
      'An app rejects any output missing a required field; the structured response omits that field; what happens to its acceptance?',
      'Name two grounded answer checks for a cited claim?',
      'An answer must use only provided evidence, which is insufficient; what should the app communicate?',
      'A request receives a temporary rate limit response; what request handling condition should you check first?',
      'Why would you prefer a fixed evaluation rubric over judging answer quality by length alone?',
    ],
    hardExamples: [
      'How does reranking limit recovery when a relevant passage is absent from all retrieved candidates?',
      'Why does labeling untrusted text alone leave tool authorization dependent on application enforcement?',
      'How does held out evaluation differ from testing on cases already used to tune a prompt?',
      'A booking tool commits before timing out, then an unprotected retry commits again; what happens to the number of bookings?',
      'Name two cache isolation tests when users have different private document permissions?',
      'Private document permissions have changed since an answer was cached; what should happen before reusing that cached answer?',
      'The relevant passage is absent from retrieval candidates before reranking; what retrieval stage should you check first?',
      'Why would you prefer retrieving current policy facts over fine tuning alone when those facts change frequently?',
    ],
  },
};
