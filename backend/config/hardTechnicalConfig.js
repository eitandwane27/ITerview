// Research and adaptation rationale: docs/hard-technical-interview-research.md.
// Set 2 only: Set 1 keeps its existing weakness-specific hard scopes.
const HARD_TECHNICAL_ROLE_PROFILES = {
  frontend: {
    topicScope: [
      'Rendering performance: client versus server rendering, repeated component updates, and measuring expensive rendering; no framework hook recall',
      'JavaScript execution: browser event loop, promise microtasks versus timer tasks, debouncing versus throttling; state scheduling conditions',
      'Browser security: cross-origin preflight and safe display of untrusted content; distinguish browser access rules from authorization',
      'Asset optimization: image sizing, reserving image space, lazy loading below the fold, and prioritizing initially visible content',
      'Interactive state: event propagation, stale search responses, and coordinating asynchronous visible state; no library-specific API recall',
      'Accessible interaction: keyboard operation and focus management for a modal or dynamically updated control',
    ],
    topicKeywords: [
      ['render', 'component', 'update', 'rendering'],
      ['event loop', 'microtask', 'timer', 'promise', 'debounce', 'debouncing', 'throttle', 'throttling'],
      ['cors', 'cross-origin', 'preflight', 'untrusted', 'scripting', 'security'],
      ['image', 'asset', 'lazy', 'loading', 'layout shift'],
      ['propagation', 'bubbl', 'state', 'search', 'response', 'event'],
      ['keyboard', 'focus', 'modal', 'accessible'],
    ],
    hardExamples: [
      'How does a long chain of promise microtasks delay the browser from responding to user input?',
      'Why should an image reserve layout space before loading on a page with buttons below it?',
      'How does server rendering differ from client rendering in delivering initially visible content over a slow connection?',
      'With the current browser task finished and one promise microtask and one timer task ready, what happens to their execution order?',
      'Name two test cases for keeping search results consistent when requests finish in a different order from typing?',
      'A modal closes while keyboard focus is inside it; what should happen to focus to keep navigation usable?',
      'An expensive component redraws on every keystroke although its displayed data is unchanged; what should you check first?',
      'Why would you prefer treating untrusted comments as text over inserting them as page markup?',
    ],
  },
  backend: {
    topicScope: [
      'Database consistency: atomic transactions, rollback, lost updates, and optimistic versus pessimistic concurrency control; no vendor-specific locking internals',
      'Database performance: index read versus write trade-offs, bounded cache freshness, connection pool exhaustion, and evidence from slow queries',
      'API security: record ownership authorization, parameterized database queries, and bounded rate limiting; no OAuth protocol or cryptographic internals',
      'Password security: unique salts, slow password hashing, and the distinction between transport encryption and stored-credential protection',
      'Request handling: middleware order, asynchronous errors, and CPU-bound work blocking other requests; no runtime phase trivia',
      'Retry safety: duplicate writes after timeouts, idempotency keys, and atomic deduplication for a single service',
    ],
    topicKeywords: [
      ['transaction', 'rollback', 'atomic', 'lock', 'locking', 'concurrent', 'concurrency', 'consistency', 'lost update'],
      ['index', 'query', 'cache', 'caching', 'pool', 'performance'],
      ['authorization', 'ownership', 'parameter', 'injection', 'rate limit', 'api'],
      ['password', 'salt', 'hash', 'credential'],
      ['middleware', 'async', 'error', 'cpu', 'event loop', 'request handling'],
      ['retry', 'retries', 'idempotency', 'idempotent', 'duplicate', 'timeout', 'deduplication'],
    ],
    hardExamples: [
      'How does an atomic database transaction protect a transfer when the debit succeeds but the matching credit encounters an error?',
      'Why should identical passwords receive different salts before their hashes are stored?',
      'How does optimistic concurrency control differ from pessimistic locking when two requests edit the same record?',
      'Two requests read stock of one before either saves a new value of zero; what outcome is possible without concurrency control?',
      'Name two test cases for authorization on an endpoint that returns a private record by its identifier?',
      'A create request may be retried after its response times out; what safeguard should prevent a second record from being created?',
      'A connection pool is exhausted although database queries finish quickly; what should you check first?',
      'Why would you prefer parameterized queries to joining untrusted input into database query text?',
    ],
  },
  fullstack: {
    topicScope: [
      'Session boundaries: expired sessions, server authorization, cookie protections, and keeping private credentials out of browser bundles',
      'Browser and server coordination: credentialed cross-origin requests, preflight, and distinguishing browser restrictions from server authorization',
      'Application performance: initial rendering trade-offs, request costs, and cache invalidation after confirmed writes',
      'Data consistency: concurrent edits, version checks, transactions, and safe retries for a single application',
      'Application security: untrusted content display, injection prevention, and authorization enforced independently of interface controls',
      'Async user feedback: optimistic updates, rollback on rejection, stale responses, and showing confirmed save outcomes',
    ],
    topicKeywords: [
      ['session', 'token', 'credential', 'cookie', 'expired'],
      ['cors', 'cross-origin', 'preflight', 'browser', 'origin'],
      ['render', 'rendering', 'cache', 'caching', 'performance', 'loading'],
      ['concurrent', 'version', 'transaction', 'database', 'retry', 'duplicate', 'consisten'],
      ['untrusted', 'scripting', 'injection', 'authorization', 'access', 'security'],
      ['optimistic', 'rollback', 'feedback', 'search', 'response', 'rejected', 'save'],
    ],
    hardExamples: [
      'How does checking record ownership on the server protect data when a user bypasses a hidden edit button?',
      'Why should a browser bundle never contain a private service credential even if its source code is minified?',
      'How does an optimistic interface update differ from waiting for server confirmation when a save is rejected?',
      'A server confirms a price update but the next read uses an unchanged cache entry; what happens to the price displayed after reload?',
      'Name two test cases for preserving an unsaved form when its session expires during submission?',
      'Two users submit edits based on the same record version; what safeguard should stop the later save silently overwriting the earlier change?',
      'A credentialed cross-origin request reaches the server but its response is blocked with a wildcard allowed origin; what could cause this?',
      'Why would you prefer rolling back an optimistic update to showing saved data after the server rejects the write?',
    ],
  },
};

const HARD_TECHNICAL_QUESTION_STYLE = `ADVANCED JUNIOR TECHNICAL VARIETY STANDARD:
- Assume strong academic or personal-project understanding with no required commercial experience.
- Ask ONE focused task in the selected format, requiring at most THREE connected reasoning steps and two to four short spoken answer sentences or exactly two requested test cases.
- Hardness comes from explaining a mechanism, evaluating a consequence or trade-off, considering a failure risk, or using evidence. Do not merely define a term, recall an API name, or disguise a medium question with advanced vocabulary.
- Vary mechanisms, purposes, comparisons, predictions, testing, applications, diagnoses, and justified decisions across the session. Do not turn every question into a bug followed by naming a fix.
- State all timing, concurrency, ownership, cache, browser, and persistence assumptions that affect the answer. Do not imply transactions alone prevent every lost update, CORS provides authorization, or transport encryption replaces password hashing.
- Use direct spoken English in one sentence, aiming for 18 to 35 words and never exceeding 45. A brief reason connected to the same answer is allowed; do not stack unrelated tasks or request a full walkthrough.
- Keep security and performance questions within one bounded behavior. No enterprise design, mandatory framework hooks, runtime-phase trivia, code reading, or senior operational experience.
- Avoid repeating the same tested mechanism or decision by changing only names or fields. Use less-covered topics and formats independently. Calibration examples do not override the selected topic.`;

// Scoring rules live in evaluatorRubrics.js; this file configures generation.
module.exports = { HARD_TECHNICAL_ROLE_PROFILES, HARD_TECHNICAL_QUESTION_STYLE };
