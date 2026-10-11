const { HARD_SET1_ROLE_PROFILES } = require('../hardSet1Config');
// Fullstack Developer interview topics, restrictions, and difficulty examples.
// Keep the existing set1 and set2 shapes when editing this role.
const { HARD_TECHNICAL_ROLE_PROFILES } = require('../hardTechnicalConfig');
const easyTopics = {
  topicScope: [
    'Application parts: the basic responsibilities of the frontend, backend, and database',
    'Submitting a form: sending entered data from the frontend to the backend, focusing on one part of the interaction',
    'Saving data: the backend stores or updates a record in a database',
    'Retrieving data: the backend reads a saved record and sends a response to the frontend',
    'Displaying a response: the frontend shows returned data or a simple success or error message',
    'Shared data basics: the purpose of JSON and required-field checks when a form sends data to a server',
  ],
  topicKeywords: [
    ['frontend', 'backend', 'database', 'responsib'],
    ['form', 'submit', 'send', 'input'],
    ['save', 'store', 'update', 'record'],
    ['retrieve', 'read', 'request', 'response'],
    ['display', 'show', 'message', 'success', 'error'],
    ['json', 'required', 'validation', 'field', 'check'],
  ],
};
const easyTechnicalTopics = {
  topicScope: [
    'Page presentation responsibilities: explaining frontend and backend responsibilities, distinguishing presentation from persistence, and simple visible page behavior',
    'Form submission: explaining why entered data is sent to a backend, basic differences between entering and submitting data, and simple submission checks; no complete request-flow walkthrough',
    'Saving a record: explaining database persistence and basic create versus update distinctions, with expected effects on stored information',
    'Retrieving a record: explaining read operations and saved information, distinguishing reading from creating, and simple retrieval checks; no query syntax',
    'Displaying an outcome: purposes and differences of success and error feedback, expected messages after an explicit result, and simple feedback tests',
    'Shared data: explaining JSON and labeled fields, basic data agreement, required versus optional values, and simple field checks; no parsing or conversion',
  ],
  topicKeywords: [
    ['part', 'responsibility', 'presentation', 'page', 'process', 'processing'],
    ['form', 'submission', 'submit', 'send', 'entered', 'input'],
    ['save', 'saving', 'store', 'storage', 'create', 'update', 'delete'],
    ['retrieve', 'read', 'saved', 'existing', 'profile'],
    ['display', 'show', 'message', 'success', 'error', 'confirms'],
    ['json', 'format', 'structured', 'group', 'grouped', 'together', 'pair', 'labeled', 'required', 'validation', 'field', 'check'],
  ],
};
const easyCompletenessTopics = {
  topicScope: [
    'Application parts: naming two main parts of a web application without explaining their responsibilities',
    'Submitted information: naming two everyday details a student registration form could send to the backend',
    'Database operations: naming two basic operations an application can use on stored records',
    'Response messages: naming two simple kinds of messages a frontend could display after a form submission',
    'Client and server communication: naming the two basic kinds of messages exchanged when a page asks a server for data, without tracing the flow',
  ],
  topicKeywords: [
    ['part', 'layer', 'component'],
    ['field', 'detail', 'information'],
    ['operation', 'create', 'read', 'update', 'delete', 'crud'],
    ['message', 'success', 'error', 'notification'],
    ['client', 'server', 'communication', 'exchange', 'exchanged'],
  ],
};
const mediumTopics = {
  topicScope: [
    'Client-server boundaries: how one form request or response connects frontend and backend, without a complete application walkthrough',
    'HTTP outcomes: interpreting an explicitly reported success, invalid required input, or missing-record response; state that an empty field is required before asking for an error status',
    'JSON exchange: converting structured data into JSON text for a request body explicitly using JSON, or interpreting received JSON text; do not claim all data transmission requires text, no exact method recall',
    'Asynchronous requests: waiting for server data before using it or showing a successful result',
    'Browser storage: local versus session storage for non-sensitive preferences with a stated lifetime',
    'Server configuration: keeping private API keys on the backend and basic allowed-origin checks without preflight or authentication internals',
  ],
  topicKeywords: [
    ['client server', 'form submission', 'frontend backend', 'communication', 'boundary'],
    ['http', 'status', 'message', 'success', 'invalid', 'missing', 'status code', 'not found'],
    ['json', 'structured', 'text', 'convert', 'parse'],
    ['asynchronous', 'async', 'await', 'promise', 'wait', 'waiting', 'pending', 'confirmation'],
    ['storage', 'local', 'session', 'preference', 'lifetime'],
    ['configuration', 'origin', 'cors', 'private', 'key', 'secret'],
  ],
};
const mediumTechnicalTopics = {
  topicScope: [
    'Form request agreement: explaining field names and expected types, testing request agreement, and diagnosing explicitly different spoken field names',
    'Response handling: explaining useful success and validation feedback, predicting displayed outcomes, and testing one bounded response behavior',
    'JSON handling: explaining conversion between JSON text and usable structured data, comparing these representations, and testing expected fields without method signatures',
    'Async request timing: explaining pending versus confirmed submissions, predicting feedback, preventing premature success, and testing request states',
    'Preference storage: explaining local and session storage, comparing their lifetimes, and choosing or testing non-sensitive preferences with one consistent lifetime',
    'Server configuration: explaining allowed browser origins and private server settings, comparing public with private configuration, and diagnosing explicitly blocked origins or exposed API keys',
  ],
  topicKeywords: [
    ['field name', 'field names', 'sent field', 'expected field', 'mismatch', 'agreement'],
    ['response', 'message', 'invalid', 'validation', 'reports', 'reject', 'display', 'show', 'feedback'],
    ['json', 'text', 'structured', 'convert', 'parse'],
    ['asynchronous', 'async', 'await', 'pending', 'wait', 'confirmation'],
    ['storage', 'local', 'session', 'preference', 'closed', 'lifetime'],
    ['configuration', 'origin', 'cors', 'key', 'private', 'secret'],
  ],
};
const mediumCompletenessTopics = {
  topicScope: [
    'Form request agreement: naming two field details frontend and backend must agree on',
    'Response feedback: naming two useful details to display after a rejected form submission',
    'Pending request feedback: naming two interface states to manage while a submission is pending',
    'Browser storage options: naming two browser storage options for non-sensitive preferences',
    'Cross-origin checks: naming two origin details to compare when a browser request is blocked, without preflight mechanics',
  ],
  topicKeywords: [
    ['field', 'agreement', 'agree', 'name', 'type'],
    ['response', 'feedback', 'rejected', 'message', 'invalid', 'display', 'show', 'details'],
    ['pending', 'submission', 'loading', 'state'],
    ['storage', 'browser', 'preference', 'local', 'session'],
    ['origin', 'blocked', 'cors', 'allowed', 'configuration'],
  ],
};
const mediumClarityTopics = {
  ...mediumTopics,
  topicScope: [
    'Form request explanation: how one frontend request carries entered fields to the backend; no complete application walkthrough',
    'Response feedback explanation: how a backend validation response helps the frontend show a useful correction message; do not choose or compare status codes',
    'JSON request explanation: why structured fields are encoded as JSON text when a request body explicitly uses JSON; do not claim every transport requires text',
    'Async explanation: why a page waits for server confirmation before showing a successful save; one mechanism only',
    'Preference storage explanation: how session storage keeps a non-sensitive preference during a tab session; no comparison with another storage option',
    'Configuration explanation: why a private API key stays on the backend rather than being included in browser code; explain one security purpose',
  ],
};
const hardTopics = HARD_SET1_ROLE_PROFILES.fullstack;
module.exports = {
    id: "fullstack",
    label: "Fullstack Developer",
    avoidList: `STRICT FULLSTACK-SPECIFIC TOPIC BAN:
- Specialized infrastructure administration or topics outside the listed application-development scope`,
    difficultyAvoidLists: {
      easy: `ENTRY-LEVEL FULLSTACK LIMITS:
- Browser rendering engine internals or detailed page rendering lifecycle
- CSS specificity calculation edge cases or selector weights
- Event propagation internals: event bubbling, event capturing, or stopPropagation
- JavaScript hoisting details, temporal dead zone, function expressions versus declarations, or closures
- Advanced database performance optimization: database transactions, query optimization, or indexing internals (keep to simple CRUD and records)
- Full page loading or end-to-end application walkthroughs; ask about only one connection or responsibility
- CORS, authentication, tokens, cookies, sessions, browser storage choices, promises, or exact JSON conversion methods
- Framework knowledge, Git command recall, REST constraints, or HTTP versus HTTPS mechanics`,
      medium: 'Do not ask about advanced rendering internals, database locking internals, or database execution plans.',
    },

    set1: {
      difficultyTopics: {
        easy: { ...easyTopics, focusTopics: { focus_completeness: easyCompletenessTopics } },
        medium: { ...mediumTopics, focusTopics: { focus_clarity: mediumClarityTopics, focus_completeness: mediumCompletenessTopics } },
        hard: hardTopics,
      },
      topicScope: [
        "Client vs server: what happens when you type a URL, how frontend and backend communicate",
        "HTTP and APIs: what a REST API is, GET vs POST vs PUT vs DELETE",
        "Basic databases: SQL vs NoSQL, what a database is used for, basic queries",
        "Version control: what Git is, why version control matters, basic commands (commit, push, pull)",
        "HTTP vs HTTPS: difference, why HTTPS matters",
        "Cookies vs sessions: what they are and when you'd use them",
      ],

      topicKeywords: [
        ["client", "server", "communicate", "url"],
        ["http", "api", "rest", "get", "post", "put", "delete"],
        ["database", "sql", "nosql", "query"],
        ["git", "version control", "commit", "push", "pull"],
        ["https"],
        ["cookie", "session"],
      ],

      easyExamples: {
        focus_clarity: [
          "What does the frontend do in a web application?",
          "What does the backend do in a web application?",
          "Why does a web application use a database?",
          "What is a server response?",
        ],
        focus_correctness: [
          "What is the difference between the frontend and the backend?",
          "Which part of an application displays a response to the user?",
          "Which part of an application handles a request to save a record?",
          "What is JSON used for between the frontend and backend?",
          "What is a required field in a form?",
        ],
        focus_completeness: [
          "Name two main parts of a web application.",
          "Name two fields a student registration form might send to the backend.",
          "Name two kinds of messages a frontend might display after a form submission.",
        ],
      },

      mediumExamples: {
        focus_clarity: [
          "How does a server response help the frontend show the outcome of a form submission?",
          "Why should a page wait for server confirmation before showing a successful save?",
          "Why should a private API key stay on the backend instead of in browser code?",
          "Why encode structured fields as JSON text when the request body uses JSON?",
        ],
        focus_correctness: [
          "How does local storage differ from session storage when a browser tab is closed?",
          "How does converting data into JSON text differ from reading JSON text into usable data?",
          "What happens when the frontend uses a server result before an asynchronous request finishes?",
        ],
        focus_completeness: [
          "Name two field details the frontend and backend must agree on for a form submission?",
          "List two useful details the frontend can show when the backend rejects a form submission?",
          "Name two interface states to manage while a form submission is waiting for a response?",
          "Name two browser storage options for non-sensitive user preferences?",
          "List two origin details to compare when a browser request is blocked by the server origin policy?",
        ],
      },

      hardExamples: hardTopics.hardExamples,
    },

    set2: {
      difficultyTopics: { easy: easyTechnicalTopics, medium: mediumTechnicalTopics, hard: HARD_TECHNICAL_ROLE_PROFILES.fullstack },
      topicScope: [
        "Client-server flow: what happens end-to-end when a form is submitted — frontend fetch, backend route, database write",
        "CORS: what it is, why browsers block cross-origin requests, how to enable it on the backend",
        "Authentication basics: storing a session or token, checking login state on the frontend",
        "JSON serialization: using JSON.stringify and JSON.parse, what happens if a POST body is not parsed",
        "Async concepts: difference between sync and async code, why fetch returns a Promise",
        "Storage choices: when to use localStorage vs session vs always fetching from the server",
      ],

      topicKeywords: [
        ["client-server", "form", "submit", "fetch", "route", "write", "database"],
        ["cors", "cross-origin", "block", "enable", "backend"],
        ["auth", "session", "token", "login", "state"],
        ["json", "serialization", "stringify", "parse", "body"],
        ["async", "sync", "promise", "fetch"],
        ["storage", "localstorage", "session", "fetch", "server"],
      ],

      easyExamples: [
        "What does saving information in a database allow an application to do later?",
        "Why should a page show feedback after a form is submitted?",
        "How does displaying information differ from saving it permanently?",
        "What happens to an existing record when the app only reads it?",
        "Name two checks for a form field that is required?",
        "Which part of an application should store submitted information permanently?",
      ],

      mediumExamples: [
        "How does parsing JSON text make returned fields available to the frontend?",
        "Why should a page wait for server confirmation before showing that a save succeeded?",
        "How does local storage differ from session storage in how long a preference lasts?",
        "What happens to a theme preference in session storage when its tab closes?",
        "Name two test cases for feedback after an API accepts or rejects a submitted form?",
        "A theme preference must survive page reloads but clear when its tab closes; which storage option fits?",
        "A browser blocks a request because its origin is not allowed; what server setting should you check first?",
        "Why would you prefer a private server setting to frontend code for an API key that must remain secret?",
      ],

      hardExamples: HARD_TECHNICAL_ROLE_PROFILES.fullstack.hardExamples,
    },
};
