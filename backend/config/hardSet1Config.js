// Set 1 keeps the legacy 3C task types instead of Set 2's technical formats.
// Research and calibration rationale: docs/hard-set1-interview-research.md.
function profile(topicScope, topicKeywords, completenessScope, hardExamples) {
  return { topicScope, topicKeywords, hardExamples,
    focusTopics: {
      focus_completeness: { topicScope: completenessScope, topicKeywords },
    } };
}

const HARD_SET1_ROLE_PROFILES = {
  frontend: profile([
    'Rendering performance: initial server rendering, client rendering, and unnecessary component updates; explain one effect, not framework API trivia',
    'Browser scheduling: main-thread work, promise microtasks, and responsiveness; state browser timing assumptions and avoid runtime-phase recall',
    'Browser security: untrusted content display and cross-origin response access; CORS is not server authorization',
    'Asset loading: image dimensions, responsive sizing, compression, and deferred loading; distinguish visible content from below-the-fold assets',
    'Asynchronous interface state: stale search responses, request ordering, and keeping displayed results consistent with current input',
    'Accessible interaction: modal keyboard focus, focus containment, dismissal, and restoring focus to a usable control',
  ], [
    ['render', 'rendering', 'component', 'update'],
    ['browser', 'microtask', 'main thread', 'promise', 'scheduling', 'responsiveness'],
    ['cors', 'cross-origin', 'untrusted', 'scripting', 'security'],
    ['image', 'asset', 'loading', 'compression', 'layout shift'],
    ['search', 'response', 'request ordering', 'input', 'stale'],
    ['modal', 'keyboard', 'focus', 'accessible'],
  ], [
    'Rendering investigation: name three distinct checks for an expensive component that redraws when its displayed data is unchanged',
    'Browser responsiveness: name three distinct ways to reduce long main-thread work during a large client-side calculation; no API-name recall',
    'Untrusted content security: name three distinct safeguards against script execution when displaying user-submitted content',
    'Image loading performance: name three distinct optimizations for image assets below the fold on a slow connection',
    'Search consistency testing: name three distinct test cases for asynchronous search results when requests complete out of order',
    'Modal accessibility testing: name three distinct keyboard focus checks across opening, using, and closing a modal',
  ], {
    focus_clarity: [
      'How does server rendering make initial page content available before the browser finishes running the application scripts?',
      'Why can a long chain of promise microtasks delay the browser from responding to keyboard input?',
      'How does displaying untrusted comments as text prevent them from executing as page markup?',
      'Why does reserving image dimensions before loading prevent surrounding content from shifting?',
      'How does checking a search response against the current input prevent stale results from replacing newer ones?',
      'Why does keeping keyboard focus inside an open modal help users navigate its controls?',
    ],
    focus_correctness: [
      'How does server rendering differ from client rendering in making initial page content available before application scripts run?',
      'After the current browser task finishes, with one promise microtask and one timer task ready, which executes first?',
      'What does a successful CORS preflight establish about browser access rather than a user\'s permission to read private records?',
      'How does deferring below-the-fold image loading differ from deferring the main image initially visible on a page?',
      'An older search request finishes after the newest request; which response should control the results for the current input?',
      'A modal closes while keyboard focus is inside it; where should focus return if its opening button still exists?',
    ],
    focus_completeness: [
      'Name three checks for an expensive component that redraws although its displayed data is unchanged?',
      'Name three ways to reduce long main-thread work during a large browser calculation?',
      'Name three safeguards against script execution when displaying untrusted user content?',
      'List three image loading optimizations for assets below the fold on a slow connection?',
      'Name three test cases for keeping search results consistent when requests finish out of order?',
      'List three keyboard focus checks across opening, using, and closing a modal?',
    ],
  }),
  backend: profile([
    'Database consistency: transactions and rollback versus concurrent-update protection; distinguish atomicity from isolation without vendor-specific internals',
    'Database performance: index read versus write costs, bounded cache freshness, and connection pool usage',
    'API security: authentication versus record ownership authorization, parameterized queries, and bounded abuse prevention',
    'Password storage: unique salts, slow password hashing, and credential protection; transport encryption does not replace secure storage',
    'Request handling: middleware order, asynchronous errors, and CPU-bound work blocking other requests in one service',
    'Retry safety: timeouts, idempotency keys, and atomic duplicate-write prevention in one service; no distributed-system design',
  ], [
    ['transaction', 'rollback', 'atomic', 'concurrent', 'concurrency', 'version', 'locking', 'lost update'],
    ['index', 'database query', 'cache', 'pool', 'database performance', 'database-backed endpoint'],
    ['authorization', 'ownership', 'authentication', 'authenticating', 'authorizing', 'parameterized', 'injection', 'api', 'access-control'],
    ['password', 'salt', 'hash', 'credential'],
    ['middleware', 'async', 'asynchronous', 'cpu', 'request handling', 'error'],
    ['retry', 'retries', 'idempotency', 'duplicate', 'timeout', 'deduplication'],
  ], [
    'Concurrent-update testing: name three distinct test cases for version-checked record edits, including normal and conflicting saves',
    'Database performance investigation: name three distinct checks for a slow database-backed endpoint; no execution-plan internals',
    'Private-record API testing: name three distinct access-control test cases for an endpoint that returns records by identifier',
    'Password storage protection: name three distinct safeguards for stored passwords if the credential database is stolen',
    'Async request error testing: name three distinct failure cases for a route that waits for a database write before responding',
    'Retry safety testing: name three distinct test cases for duplicate-write prevention when a create request is retried after a timeout',
  ], {
    focus_clarity: [
      'How does an atomic database transaction protect a transfer when the debit succeeds but the matching credit fails?',
      'Why can adding a database index speed up matching reads while increasing the cost of writes?',
      'How does checking record ownership on the server prevent a logged-in user from reading another user\'s private record?',
      'Why do unique salts prevent identical passwords from producing identical stored password hashes?',
      'Why can a long CPU-bound calculation delay unrelated requests handled on the same server thread?',
      'How does atomically recording an idempotency key with a created record prevent duplicate writes when requests are retried?',
    ],
    focus_correctness: [
      'How does optimistic version checking differ from pessimistic locking when two requests edit the same database record?',
      'How does a database index affect matching read cost compared with the cost of maintaining that index during writes?',
      'How does authenticating a caller differ from authorizing that caller to read a particular private record?',
      'How does encrypting password traffic differ from hashing stored passwords when the credential database is stolen?',
      'If authorization middleware runs after a route has already sent private data, what protection has been lost?',
      'A create request times out after its write succeeds; what can happen if the same request is retried without deduplication?',
    ],
    focus_completeness: [
      'Name three test cases for an endpoint that uses version checks to prevent conflicting record edits?',
      'List three checks for a slow database-backed endpoint before choosing a performance optimization?',
      'Name three access-control test cases for an API that returns a private record by its identifier?',
      'Name three safeguards for stored passwords if the credential database is stolen?',
      'List three failure cases to test for an asynchronous route that waits for a database write before responding?',
      'Name three test cases for preventing duplicate writes when a create request is retried after a timeout?',
    ],
  }),
  fullstack: profile([
    'Session boundaries: session expiry, server authorization, and private credentials; never treat hidden interface controls as access enforcement',
    'Browser-server access: credentialed cross-origin requests, preflight, and the distinction between CORS and server permissions',
    'Application caching: cache freshness after confirmed writes and invalidation; keep timing and cache assumptions explicit',
    'Concurrent edits: server version checks, rejected conflicting saves, and preserving unsaved form data',
    'Application security: untrusted content, parameterized database queries, and record ownership enforced independently of browser controls',
    'Save feedback: optimistic updates, rollback after rejection, and distinguishing pending changes from confirmed persistence',
  ], [
    ['session', 'expiry', 'expired', 'credential', 'cookie'],
    ['cors', 'cross-origin', 'preflight', 'browser access'],
    ['cache', 'cached', 'caching', 'freshness', 'invalidation'],
    ['concurrent', 'version', 'conflicting', 'edit', 'unsaved'],
    ['untrusted', 'injection', 'ownership', 'authorization', 'private record', 'security'],
    ['optimistic', 'rollback', 'save', 'feedback', 'pending', 'rejected'],
  ], [
    'Session-expiry testing: name three distinct test cases for preserving an unsaved form when its session expires during submission',
    'Credentialed cross-origin investigation: name three distinct browser-server configuration checks when the browser blocks a credentialed response',
    'Cache consistency testing: name three distinct test cases for a cached record after a confirmed server update',
    'Conflicting-edit testing: name three distinct test cases for two users saving edits based on record versions',
    'Private-record authorization testing: name three distinct test cases for server ownership checks even when interface edit controls are hidden',
    'Optimistic-save testing: name three distinct test cases for visible save feedback when an optimistic update is pending or rejected',
  ], {
    focus_clarity: [
      'Why must the server check an active session before accepting a save even when the browser still displays a logged-in screen?',
      'Why does a wildcard allowed origin prevent browser scripts from reading a credentialed cross-origin response?',
      'How does invalidating a cached record after a confirmed write prevent an old value from appearing on reload?',
      'How does a server version check prevent a later save from silently overwriting another user\'s concurrent edit?',
      'Why must record ownership be checked on the server even when the browser hides another user\'s edit controls?',
      'How does rolling back an optimistic update keep displayed data consistent when the server rejects the save?',
    ],
    focus_correctness: [
      'How does an expired session differ from an active session without record permission in the server\'s reason for rejecting a save?',
      'What does allowing a browser origin through CORS establish compared with authorizing a user to access a private record?',
      'The server confirms a price update but the next read uses an unchanged cache entry; which price can appear after reload?',
      'With server version checks, two users submit edits based on the same record version; what should happen to the later save after the first succeeds?',
      'How does hiding a record\'s edit button differ from enforcing record ownership on the server?',
      'How does an optimistic save differ from waiting for server confirmation in what the interface displays while the request is pending?',
    ],
    focus_completeness: [
      'Name three test cases for preserving an unsaved form when its session expires during submission?',
      'List three configuration checks when the browser blocks access to a credentialed cross-origin response?',
      'Name three test cases for cache freshness after the server confirms a record update?',
      'Name three test cases for preventing conflicting edits when two users save record versions?',
      'List three authorization test cases for a private-record endpoint whose interface hides unauthorized edit controls?',
      'Name three test cases for save feedback when an optimistic interface update is pending or rejected?',
    ],
  }),
};

const HARD_SET1_FOCUS_INSTRUCTIONS = {
  focus_clarity: 'Ask how ONE mechanism works or why ONE safeguard, performance practice, or interaction produces a stated effect. Test a clear causal explanation in the candidate\'s own words. Do not ask for a comparison, list, outcome selection, or implementation walkthrough.',
  focus_correctness: 'Ask for ONE technically precise behavior, consequence under stated conditions, or focused comparison of TWO related concepts. Test factual correctness and important boundaries, not term recall. Do not append a reason, example, list, or implementation task.',
  focus_completeness: 'Preserve the legacy Hard three-item task: start with Name three or List three and request exactly THREE distinct relevant safeguards, checks, test cases, or related items from ONE bounded category. Choose a category with at least three defensible answers. Do not supply answers or ask for explanations, reasons, definitions, or examples for each item.',
};

const HARD_SET1_QUESTION_STYLE = `HARD SET 1: ADVANCED JUNIOR 3C PRACTICE
- Assume strong academic or personal-project knowledge with no required commercial experience.
- Hardness comes from a causal mechanism, precise technical distinction, failure consequence, or coverage of three relevant items; not obscure vocabulary or senior architecture.
- Ask ONE focused task within the selected topic and 3C focus, with at most THREE connected reasoning steps. Clarity and correctness should be answerable in two to four short spoken sentences; completeness needs only the three requested items.
- Use one sentence, aiming for 18 to 35 words, never more than 45. State timing, concurrency, ownership, browser, and persistence assumptions that affect the answer.
- Keep questions role-specific and bounded to one application behavior. No code, framework hook recall, broad system design, full investigations, or production experience.
- Do not imply CORS provides user authorization, atomic transactions prevent every lost update, or transport encryption replaces password hashing.
- Use less-covered topics and different tested mechanisms within the session. Calibration examples guide difficulty and focus, not topic selection.`;

// Scoring rules live in evaluatorRubrics.js; this file configures generation.
module.exports = { HARD_SET1_ROLE_PROFILES, HARD_SET1_FOCUS_INSTRUCTIONS, HARD_SET1_QUESTION_STYLE };
