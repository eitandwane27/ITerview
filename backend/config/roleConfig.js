// backend/config/roleConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// Central Role Registry — Single source of truth for all role-specific
// prompt data consumed by aiSet1Generator and aiSet2Generator.
//
// HOW TO ADD A NEW ROLE:
//   1. Add a new entry to ROLE_CONFIG below following the same shape.
//   2. That's it. Both generators will pick it up automatically.
//
// SHAPE OF EACH ROLE ENTRY:
//   id          {string}   - machine key, matches dropdown value (e.g. "frontend")
//   label       {string}   - human-readable label for prompt injection
//   set1        {object}   - data for Set 1 (Personalized / Weakness Engine)
//     topicScope   {string[]} - allowed topics the LLM may draw questions from
//     topicKeywords{string[][]} - keyword lists for topic-repetition scoring (parallel to topicScope)
//     easyExamples {object}   - curated difficulty anchors, keyed by weakness tag
//       focus_clarity      {string[]}
//       focus_correctness  {string[]}
//       focus_completeness {string[]}
//   set2        {object}   - data for Set 2 (Technical Mastery)
//     topicScope   {string[]} - allowed topics
//     topicKeywords{string[][]} - keyword lists (parallel to topicScope)
//     easyExamples {string[]}  - flat pool of difficulty-anchor questions
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {

  // ───────────────────────────────────────────────────────────────────────────
  frontend: {
    id: "frontend",
    label: "Frontend Developer",
    avoidList: `STRICT FRONTEND-SPECIFIC TOPIC BAN:
- Database internals: indexing, normalization, transactions, or query optimization
- Browser rendering engine internals or detailed page rendering lifecycle
- CSS specificity calculation edge cases, cascade logic details, or selector weights
- Event propagation internals: event bubbling, event capturing, or stopPropagation
- Form submission mechanics and event.preventDefault
- JavaScript hoisting details, temporal dead zone, function expressions versus declarations, or closures
- The defer and async script attributes (too advanced for entry level)`,

    set1: {
      // ── Topic scope ─────────────────────────────────────────────────────────
      topicScope: [
        "HTML structure, semantic elements (header, nav, main, section, article, footer), and basic tags",
        "CSS fundamentals: box model, selectors, specificity, display (block, inline, inline-block, none), visibility",
        "CSS layout: position (static, relative, absolute, fixed), flexbox basics, simple responsive design with media queries",
        "Vanilla JavaScript basics: variables (var, let, const), data types, operators, functions, conditionals, loops",
        "DOM manipulation: selecting elements, adding event listeners, changing text or styles with JavaScript",
        "Browser basics: how the browser renders a page, what HTML/CSS/JS each does, difference between client and server (surface level only)",
      ],

      // ── Keyword lists for anti-repetition scoring (index-aligned to topicScope) ─
      topicKeywords: [
        ["html", "semantic", "tag", "element", "header", "nav", "main", "section", "article", "footer"],
        ["css", "box model", "selector", "specificity", "display", "visibility", "block", "inline"],
        ["position", "flexbox", "layout", "responsive", "media query", "align"],
        ["variable", "let", "const", "var", "data type", "operator", "function", "conditional", "loop"],
        ["dom", "event", "listener", "click", "manipulate"],
        ["browser", "render", "client", "server"],
      ],

      // ── Difficulty-anchored example questions ────────────────────────────────
      easyExamples: {
        focus_clarity: [
          "Can you walk me through what happens step-by-step when a user clicks a button in a web page?",
          "How would you explain the difference between HTML, CSS, and JavaScript to someone who has never coded?",
          "Can you describe in your own words how the browser renders a webpage from start to finish?",
        ],
        focus_correctness: [
          "What is the difference between `var`, `let`, and `const` in JavaScript?",
          "What does CSS `position: absolute` do, and how is it different from `position: relative`?",
          "What is the difference between `display: none` and `visibility: hidden` in CSS?",
          "What is an HTML semantic element? Can you give an example?",
          "What does `===` (triple equals) do differently from `==` in JavaScript?",
        ],
        focus_completeness: [
          "What are three different HTML semantic tags you can use to structure a webpage?",
          "What are some of the different values you can use for the CSS display property?",
          "What are three different CSS selectors you can use to style elements on a page?",
        ],
      },

      mediumExamples: {
        focus_clarity: [
          "How would you explain the difference between a block element and an inline element to a teammate?",
          "How would you describe the difference between the relative and absolute positioning values in CSS?",
          "Can you explain how a media query works to make a website responsive on smaller screens?",
        ],
        focus_correctness: [
          "What is the difference between using the text content property and the inner HTML property in JavaScript?",
          "What does the prevent default method on the event object do inside a form submit listener?",
          "What is the difference between using the query selector method and the get element by ID method in JavaScript?",
        ],
        focus_completeness: [
          "What are three common CSS layout properties you can use to position elements on a webpage?",
          "What are three different values you can use for the CSS position property?",
          "What are three different types of events you can listen for in JavaScript besides a click event?",
        ],
      },
    },

    set2: {
      // ── Topic scope ─────────────────────────────────────────────────────────
      topicScope: [
        "DOM manipulation: selecting a single element by ID, reading or changing its textContent or innerHTML, toggling a CSS class",
        "Event handling: adding a click listener to a button, preventing default form submission, reading a value from an input field",
        "Debugging HTML/CSS/JS: spotting typos in method names, identifying why a CSS rule is not applying, reading a simple error message",
        "CSS rules and the cascade: why a rule might not apply to an element, what specificity means, common display and visibility issues",
        "Script placement basics: why a script tag placed at the very end of the body is safer than placing it at the top, and what error you might see if it runs too early",
        "Simple browser scenarios: what happens when a button is clicked, why an event listener might not fire, how to show or hide an element with JavaScript",
      ],

      // ── Keyword lists (index-aligned to topicScope) ──────────────────────────
      topicKeywords: [
        ["dom", "select", "content", "class", "click", "element", "textcontent", "innerhtml"],
        ["css", "layout", "flexbox", "grid", "block", "inline", "responsive", "media query", "specificity", "display", "visibility", "hidden"],
        ["html", "semantic", "tag", "attribute", "form", "structure"],
        ["button", "listener", "fire", "show", "hide", "toggle"],
        ["script", "head", "body", "placement", "defer", "async", "load", "early", "bottom"],
      ],

      // ── Flat pool of difficulty-anchor questions (TTS-safe) ──────────────────
      easyExamples: [
        // Problem Solving
        "If a button on a webpage is not responding to clicks, what are the first two things you would check?",
        "If a CSS rule you wrote is not being applied to an element, what steps would you take to figure out why?",
        "How would you use JavaScript to show a hidden element on the page when a user clicks a button?",
        // Debugging
        "A developer tries to select a button by its ID in JavaScript, but the code cannot find the element even though the ID exists in the HTML. What is a likely cause of this?",
        "A div element is not visible on the page even though the HTML for it exists. What are two CSS properties that could be causing it to be hidden?",
        "A developer adds a JavaScript event listener to a button, but the listener never fires when the button is clicked. What is the first thing you would check?",
        // Technical Depth
        "What is the difference between using textContent and innerHTML to update an element's text in JavaScript?",
        "What is the difference between display none and visibility hidden in CSS?",
        "If you add a CSS class to an element using JavaScript but the element's appearance does not change, what are two things you would check?",
      ],

      mediumExamples: [
        "If you add a CSS class to an element using JavaScript but the page styling does not change, what are two things you would check?",
        "If a JavaScript file runs before the HTML body has loaded, what error is likely to occur when selecting elements?",
        "If a form is reloading the entire page when a user clicks the submit button, how do you prevent that using JavaScript?",
        "What is the difference between the double equals and triple equals comparison operators in JavaScript?",
        "How would you use CSS flexbox properties to center a child container inside a parent container?",
        "If an element with absolute positioning is not aligning correctly, what CSS position property must be added to its parent container?",
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  backend: {
    id: "backend",
    label: "Backend Developer",
    avoidList: `STRICT BACKEND-SPECIFIC TOPIC BAN:
- Frontend layout, CSS styling, selectors, visibility, flexbox, or grid
- DOM manipulation, event listeners, HTML tag attributes, or script tags placement
- JavaScript hoisting details, temporal dead zone, function expressions versus declarations, or closures
- Advanced database performance optimization: database transactions, query optimization, or indexing internals (keep to simple CRUD, SQL vs NoSQL differences)`,

    set1: {
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
          "Can you walk me through what happens when a client sends a GET request to a REST API?",
          "How would you explain the difference between a GET request and a POST request to a teammate?",
          "Can you describe in simple terms how a user login system works from start to finish?",
        ],
        focus_correctness: [
          "What is the difference between SQL and NoSQL databases?",
          "What is an HTTP status code? What does a 404 mean versus a 500?",
          "What is the purpose of an environment variable, and why should you not hardcode API keys in your code?",
          "What is the difference between authentication and authorization?",
          "What is JSON and when would you use it in a backend application?",
        ],
        focus_completeness: [
          "What are three common HTTP status codes and what basic message does each represent?",
          "What are the four main HTTP methods used in REST APIs?",
          "What are three different data types you can store in a JSON object?",
        ],
      },

      mediumExamples: {
        focus_clarity: [
          "How would you explain what a route parameter is to someone who is new to building backend APIs?",
          "How would you describe the flow of an HTTP request passing through a logging middleware in Express?",
          "Can you explain the difference between asynchronous code and synchronous code using a real world example?",
        ],
        focus_correctness: [
          "What is the difference between path parameters and query parameters in a REST API?",
          "What is the difference between a client error status code like four hundred and four and a server error status code like five hundred?",
          "What is the purpose of an environment variable and why should you not hardcode API keys in your code?",
        ],
        focus_completeness: [
          "What are three common HTTP status codes and what basic message does each represent?",
          "What are the four main HTTP methods used in REST APIs?",
          "What are three different data types you can store in a JSON object?",
        ],
      },
    },

    set2: {
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
        // Problem Solving
        "If your server returns a 500 error every time a specific route is hit, what are the first things you would check?",
        "A user reports they can log in fine but their data is not saving. What parts of the backend would you check first?",
        "How would you write a simple route that receives a number from the request and sends back double that number in the response?",
        // Debugging
        "A developer sets up a route meant to return all users, but every time it is called it only returns one user. What is a likely cause of this mistake?",
        "An API route is returning a 404 error even though the developer is sure the route is defined. What are two things you would check first?",
        "A backend function that reads from a database crashes with an error saying it cannot read a property of undefined. What is most likely going wrong?",
        // Technical Depth
        "What is middleware in Express, and can you give a simple example of when you would use it?",
        "Why do you need to use async and await when reading data from a database instead of writing regular synchronous code?",
        "What does a dot env file do in a Node project and why should it never be uploaded to GitHub?",
      ],

      mediumExamples: [
        "If your Express server returns a internal server error code five hundred for a route, what is the first thing you would check?",
        "Why do we need to use the await keyword when making a database query in an asynchronous function?",
        "If a database query returns undefined in your route handler, how would you handle it to prevent the server from crashing?",
        "What is middleware in Express and when would you use it in your application?",
        "Why should configuration secrets like database passwords never be committed to a public Git repository?",
        "If a user reports that they can log in but their profile data is not saving, what backend layers would you check?",
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  fullstack: {
    id: "fullstack",
    label: "Fullstack Developer",
    avoidList: `STRICT FULLSTACK-SPECIFIC TOPIC BAN:
- Browser rendering engine internals or detailed page rendering lifecycle
- CSS specificity calculation edge cases, cascade logic details, or selector weights
- Event propagation internals: event bubbling, event capturing, or stopPropagation
- Form submission mechanics and event.preventDefault
- JavaScript hoisting details, temporal dead zone, function expressions versus declarations, or closures
- Advanced database performance optimization: database transactions, query optimization, or indexing internals (keep to simple CRUD, SQL vs NoSQL differences)`,

    set1: {
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
          "Can you explain in simple terms what happens from when you type a URL in a browser to when the page appears?",
          "How would you explain the difference between the frontend and the backend of a web application to a non-developer?",
          "Can you walk me through how data typically flows from a user action on a webpage all the way to a database?",
        ],
        focus_correctness: [
          "What is CORS and why would a browser block a request because of it?",
          "What is the difference between a cookie and a session?",
          "What is Git and why is version control important in software development?",
          "What is the difference between HTTP and HTTPS?",
          "What is a REST API and what makes it 'RESTful'?",
        ],
        focus_completeness: [
          "What are three of the basic Git commands you use when working on a project?",
          "What are three common HTTP methods used to communicate between client and server?",
          "What are three different places where you can store data on the client side in a web application?",
        ],
      },

      mediumExamples: {
        focus_clarity: [
          "How would you explain the difference between client side rendering and server side rendering to a non technical person?",
          "How would you describe how the frontend communicates with the backend using fetch requests?",
          "Can you explain why a browser might block a frontend request due to cross origin resource sharing policies?",
        ],
        focus_correctness: [
          "What is the difference between storing data in local storage and storing it in session storage?",
          "What is the difference between the JSON dot stringify method and the JSON dot parse method in JavaScript?",
          "What does the cross origin resource sharing policy do and why do browsers enforce it?",
        ],
        focus_completeness: [
          "What are three basic Git commands you use to save and push your code to a remote repository?",
          "What are three common HTTP status codes that a server might send back to a client?",
          "What are three different places where you can store data or state in a fullstack web application?",
        ],
      },
    },

    set2: {
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
        // Problem Solving
        "A user fills out a form and clicks Submit but nothing happens. Where do you start debugging — the frontend or the backend, and why?",
        "Your frontend is calling an API but the browser is blocking the request with a CORS error. What does that mean and how would you fix it?",
        "How would you design a simple flow so that after a user logs in, their name is shown on every page of the app?",
        // Debugging
        "A fetch request from the frontend is returning undefined instead of the expected user data. What are two things you would check?",
        "The frontend sends data to the backend but the backend receives an empty object instead of the data. What is the most likely cause?",
        "A developer saves user passwords as plain text in the database. Why is this a serious problem and what should be done instead?",
        // Technical Depth
        "What is the difference between JSON dot stringify and JSON dot parse, and when would you use each one?",
        "What is the difference between a synchronous and an asynchronous function, and why does it matter in web development?",
        "Why would a developer store data in localStorage instead of always fetching it from the server?",
      ],

      mediumExamples: [
        "If your frontend application gets a cross origin resource sharing block error when calling the API, how do you resolve it on the backend?",
        "What would happen if your frontend sent a post request with JSON data but your Express backend did not use the Express JSON middleware?",
        "If a user logs in successfully but their session is lost when they refresh the browser, what are two things you would check?",
        "Why is it safer to store API keys on the backend server instead of using them directly in the frontend JavaScript code?",
        "If a frontend page is calling an API but the response always returns undefined, what is the best way to trace where the data is failing?",
        "What is the difference between using local storage and sending a request to the database when saving simple user settings?",
      ],
    },
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full registry — use when you need to iterate over all roles
 * (e.g. populating a dropdown, validating an incoming role param).
 */
module.exports.ROLE_CONFIG = ROLE_CONFIG;

/**
 * Ordered list of valid role IDs.
 * Matches the frontend dropdown order.
 */
module.exports.VALID_ROLES = Object.keys(ROLE_CONFIG);

/**
 * Returns the config for a given role ID, or falls back to "fullstack".
 * Use this inside generators instead of repeating the safeRole guard.
 *
 * @param {string} role
 * @returns {{ id, label, set1, set2 }}
 */
module.exports.getRoleConfig = function getRoleConfig(role) {
  return ROLE_CONFIG[role] || ROLE_CONFIG["fullstack"];
};
