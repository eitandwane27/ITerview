const { HARD_SET1_ROLE_PROFILES } = require('../hardSet1Config');
// Backend Developer interview topics, restrictions, and difficulty examples.
// Keep the existing set1 and set2 shapes when editing this role.
const { HARD_TECHNICAL_ROLE_PROFILES } = require('../hardTechnicalConfig');
const easyTopics = {
  topicScope: [
    'Server basics: the purpose of a server and the difference between a client request and a server response',
    'HTTP basics: using GET to retrieve data, using POST to submit data, and the basic meaning of success or not found responses',
    'API basics: the purpose of an API and an endpoint',
    'JSON basics: exchanging structured data between a client and server without syntax questions',
    'Database basics: storing data in tables and records, and creating, reading, updating, or deleting a record',
    'Input validation basics: checking required fields and whether submitted values have the expected format',
  ],
  topicKeywords: [
    ['server', 'client', 'request', 'response'],
    ['http', 'get', 'post', 'retrieve', 'submit', 'success', 'not found'],
    ['api', 'endpoint'],
    ['json', 'structured data'],
    ['database', 'table', 'record', 'create', 'read', 'update', 'delete', 'crud'],
    ['validation', 'validate', 'required', 'field', 'format', 'input'],
  ],
};
const easyTechnicalTopics = {
  topicScope: [
    'Server responsibilities: what requests and responses do, why a server returns information, and expected outcomes for explicitly existing or missing records',
    'HTTP methods: purposes and differences of GET and POST for retrieving or submitting information; no syntax or numeric status recall',
    'API access: the purpose of an API and its resources; when selecting an existing resource, describe the available resources rather than inventing endpoints',
    'Data exchange: the purpose of JSON and labeled fields, structured data versus ordinary text, and simple checks of expected fields; no parsing or conversion',
    'Database operations: purposes and differences of create, read, update, and delete, expected effects on saved records, and basic storage checks',
    'Input validation: purposes, required versus optional fields, basic format checks, and two simple test cases for an explicitly required field',
  ],
  topicKeywords: [
    ['server', 'process', 'request', 'return'],
    ['http', 'method', 'get', 'post', 'retrieve', 'submit'],
    ['api', 'endpoint', 'access', 'resource', 'schedule'],
    ['json', 'format', 'structured', 'exchange', 'group', 'grouped', 'together', 'pair', 'labeled'],
    ['database', 'store', 'storage', 'record', 'operation', 'create', 'read', 'update', 'delete', 'saved'],
    ['validation', 'validate', 'required', 'field', 'empty', 'missing', 'reject', 'correction'],
  ],
};
const easyCompletenessTopics = {
  topicScope: [
    'Student records: naming two familiar fields a student database record could contain',
    'Database operations: naming two basic operations that change stored records',
    'Input checks: naming two simple checks for a required email field',
    'HTTP methods: naming the two basic methods used to retrieve and submit data, without explaining them',
    'Server responses: naming two general outcomes of a request, successful or unsuccessful; do not constrain the question to an already-missing record or ask for numeric status codes',
  ],
  topicKeywords: [
    ['field', 'student'],
    ['operation', 'change', 'create', 'update', 'delete', 'crud'],
    ['check', 'required', 'email', 'validation'],
    ['http', 'method', 'get', 'post', 'retrieve', 'submit'],
    ['response', 'outcome', 'success', 'not found'],
  ],
};
const mediumTopics = {
  topicScope: [
    'HTTP parameters and responses: path versus query parameters, client errors versus server errors, and missing records',
    'Input validation: checking required fields and formats before saving a record',
    'Middleware basics: one logging or validation stage before a route handler, without framework internals',
    'Asynchronous database calls: waiting for a promise to resolve before using its result; do not imply every database call returns a literal pending state or that a promise exposes its state for direct inspection',
    'Database results: reading or updating records, handling no match versus a failed query, without query syntax',
    'Server configuration: environment variables, missing configuration, and protecting database credentials',
  ],
  topicKeywords: [
    ['http', 'path', 'parameter', 'query parameter', 'response', 'status'],
    ['validation', 'validate', 'required', 'field', 'format', 'email'],
    ['middleware', 'logging', 'log', 'handler'],
    ['asynchronous', 'async', 'await', 'pending', 'wait', 'promise'],
    ['database', 'record', 'query', 'result', 'match', 'update'],
    ['configuration', 'environment', 'credential', 'password', 'secret'],
  ],
};
const mediumTechnicalTopics = {
  topicScope: [
    'HTTP request handling: explaining route matching, comparing request methods, testing method and path agreement, and handling explicitly missing resources; no implementation-dependent numeric status for method mismatches',
    'Validation: explaining server-side checks, comparing required with optional fields, testing invalid input, and rejecting missing required values before saving',
    'Middleware: explaining request logging and validation before a route handler, comparing their responsibilities, and checking execution order; no sessions or token internals',
    'Async timing: explaining why a response waits for its database result, predicting pending operations, and diagnosing an early response',
    'Database results: distinguishing a successful empty lookup from a failed query, predicting a response for one stated result, and testing lookup outcomes; no query syntax',
    'Environment configuration: explaining external settings, comparing settings with hardcoded credentials, testing missing startup settings, and keeping credentials out of public repositories',
  ],
  topicKeywords: [
    ['http', 'method', 'path', 'route', 'resource', 'not found'],
    ['validation', 'validate', 'required', 'field', 'format', 'reject', 'empty', 'email', 'username'],
    ['middleware', 'logging', 'log', 'handler'],
    ['asynchronous', 'async', 'await', 'pending', 'ready', 'wait', 'promise'],
    ['database', 'query', 'result', 'match', 'record', 'error'],
    ['environment', 'configuration', 'setting', 'password', 'credential', 'repository'],
  ],
};
const mediumCompletenessTopics = {
  topicScope: [
    'Route matching checks: naming the two request details that must match a defined route',
    'Input checks: naming two checks for an explicitly required email field before saving',
    'Logging details: naming two useful request details for a basic server log',
    'Database result cases: naming two result cases to handle after a record lookup',
    'Environment settings: naming two database connection settings such as host, port, or database name; ask for setting names, never real credential values',
  ],
  topicKeywords: [
    ['route', 'method', 'path', 'match'],
    ['validation', 'required', 'email', 'field'],
    ['logging', 'log', 'detail'],
    ['database', 'lookup', 'record', 'result', 'case'],
    ['environment', 'setting', 'configuration', 'connection'],
  ],
};
const mediumClarityTopics = {
  ...mediumTopics,
  topicScope: [
    'HTTP parameter explanation: how a path parameter identifies the record requested from an API; do not choose or compare response statuses',
    'Validation explanation: why required-field or format checks happen before saving a submitted record; one purpose only',
    'Logging middleware explanation: how one logging stage records a request before its route handler runs; no authentication or token assumptions',
    'Async explanation: why a route waits for a database promise to resolve before using the result; no direct promise-state inspection',
    'Database result explanation: why a route handles a successful lookup with no matching record; do not append or compare a separate failed query',
    'Configuration explanation: how environment variables separate database credentials from application source code; one mechanism or purpose only',
  ],
};
const hardTopics = HARD_SET1_ROLE_PROFILES.backend;
module.exports = {
    id: "backend",
    label: "Backend Developer",
    avoidList: `STRICT BACKEND-SPECIFIC TOPIC BAN:
- Frontend layout, CSS styling, selectors, visibility, flexbox, or grid
- DOM manipulation, event listeners, HTML tag attributes, or script tags placement`,
    difficultyAvoidLists: {
      easy: `ENTRY-LEVEL BACKEND LIMITS:
- JavaScript hoisting details, temporal dead zone, function expressions versus declarations, or closures
- Advanced database performance optimization: database transactions, query optimization, or indexing internals (keep to simple CRUD and records)
- Framework or runtime knowledge such as Node or Express, middleware, async or await, environment variables, authentication, sessions, or tokens
- REST constraints, SQL versus NoSQL comparisons, database query syntax, or memorizing status code lists`,
      medium: 'Do not ask about database execution plans, locking internals, advanced query optimization, authentication, authorization, sessions, or tokens; middleware questions use logging or required-field validation.',
    },

    set1: {
      difficultyTopics: {
        easy: { ...easyTopics, focusTopics: { focus_completeness: easyCompletenessTopics } },
        medium: { ...mediumTopics, focusTopics: { focus_clarity: mediumClarityTopics, focus_completeness: mediumCompletenessTopics } },
        hard: hardTopics,
      },
      topicScope: [
        "HTTP basics: what HTTP is, GET vs POST requests, common status codes (200, 404, 500)",
        "REST API fundamentals: what an API is, what makes it RESTful, endpoints, request/response",
        "Databases: SQL vs NoSQL at a high level, what a database is, basic CRUD operations",
        "Server basics: what a server does, what Node.js/Express is used for, what an environment variable is",
        "Authentication basics: difference between authentication and authorization, what a session is",
        "JSON: what it is, how it's used to send data between client and server",
      ],

      topicKeywords: [
        ["http", "get", "post", "status code", "request"],
        ["api", "rest", "endpoint", "response"],
        ["database", "sql", "nosql", "crud"],
        ["server", "node", "express", "environment variable"],
        ["auth", "session", "cookie"],
        ["json"],
      ],

      easyExamples: {
        focus_clarity: [
          "What does a server do?",
          "What is a database used for?",
          "What is an API?",
          "Why does a server check submitted input?",
        ],
        focus_correctness: [
          "What is the difference between a GET request and a POST request?",
          "What is a record in a database table?",
          "What is an API endpoint?",
          "What is JSON used for when a client communicates with a server?",
          "What does a not found response mean?",
        ],
        focus_completeness: [
          "Name two database operations that change stored records.",
          "Name two fields a database record for a student might contain.",
          "Name two checks a server could make on a required email field.",
          "Name two general outcomes a server can report after a request.",
        ],
      },

      mediumExamples: {
        focus_clarity: [
          "How does a route parameter identify the student record requested from an API?",
          "How does logging middleware record a request before its route handler runs?",
          "Why must a route wait for an asynchronous database lookup before sending its result?",
        ],
        focus_correctness: [
          "How does a path parameter differ from a query parameter when requesting records?",
          "How does a missing record differ from a failed database query when choosing an API response?",
          "What happens if a route sends its response before an asynchronous database lookup finishes?",
        ],
        focus_completeness: [
          "Name two request details to check when matching a request to a defined route?",
          "List two checks for a required email field before saving a registration?",
          "Name two request details useful in a basic server log?",
          "List two result cases a route should handle after looking up a record?",
          "Name two environment settings needed to configure a database connection?",
        ],
      },

      hardExamples: hardTopics.hardExamples,
    },

    set2: {
      difficultyTopics: { easy: easyTechnicalTopics, medium: mediumTechnicalTopics, hard: HARD_TECHNICAL_ROLE_PROFILES.backend },
      topicScope: [
        "Express.js basics: defining GET/POST routes, using req and res, sending JSON responses",
        "Async fundamentals: why async/await is needed, what happens if you forget to await a database call",
        "Environment variables: what a .env file is, why secrets must not be hardcoded or committed",
        "Common HTTP debugging: understanding 404 vs 500, checking if a route exists, reading error logs",
        "Middleware: what it is in Express, how it sits between a request and a route handler",
        "Basic database interaction: making a query, handling the result, what undefined means when a query fails",
      ],

      topicKeywords: [
        ["express", "route", "get", "post", "req", "res", "json", "response"],
        ["async", "await", "promise", "database", "forget", "call"],
        ["env", "environment", "secret", "hardcode", "commit"],
        ["http", "debugging", "404", "500", "exist", "log"],
        ["middleware", "express", "request", "route handler"],
        ["database", "query", "result", "undefined", "fail"],
      ],

      easyExamples: [
        "What does an API let two applications do?",
        "Why should a server check a required field before saving it?",
        "How does reading a database record differ from deleting it?",
        "What happens to a saved address when its record is updated?",
        "Name two test cases for an email field that is required?",
        "Which HTTP method would retrieve a list of products?",
      ],

      mediumExamples: [
        "How does middleware let a server validate input before its route handler runs?",
        "Why should the server validate input even when the frontend already checks it?",
        "How does a successful database lookup with no record differ from a failed query?",
        "What happens to response data if a route sends it before its database result is ready?",
        "Name two test cases for an API that rejects an empty required email?",
        "A required email field is empty; what should the server do before saving the registration?",
        "A database connection cannot start because its password setting is absent; what should you check first?",
        "Why would you prefer environment settings to hardcoded credentials when code is stored in a public repository?",
      ],

      hardExamples: HARD_TECHNICAL_ROLE_PROFILES.backend.hardExamples,
    },
};
