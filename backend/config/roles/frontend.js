const { HARD_SET1_ROLE_PROFILES } = require('../hardSet1Config');
const { HARD_TECHNICAL_ROLE_PROFILES } = require('../hardTechnicalConfig');
// Frontend Developer interview topics, restrictions, and difficulty examples.
// Keep the existing set1 and set2 shapes when editing this role.
const easyTopics = {
  topicScope: [
    'HTML basics: the purpose of HTML, headings, paragraphs, links, and images',
    'HTML forms: labels, text inputs, and buttons',
    'CSS basics: colors, fonts, class selectors, margin, and padding',
    'Simple layout concepts: the purpose of flexbox and of adapting a page to a smaller screen; no layout property or value recall',
    'JavaScript basics: variables, strings, numbers, booleans, functions, conditions, and loops',
    'Simple page interaction concepts: the purpose of a click event, an input value, or changing visible text; no implementation steps',
  ],
  topicKeywords: [
    ['html', 'heading', 'paragraph', 'link', 'image'],
    ['form', 'label', 'input', 'button'],
    ['css', 'color', 'font', 'class', 'margin', 'padding'],
    ['layout', 'row', 'flexbox', 'screen', 'responsive'],
    ['javascript', 'variable', 'string', 'number', 'boolean', 'function', 'condition', 'loop'],
    ['click', 'event', 'input', 'text'],
  ],
};
// Set 2 covers introductory technical concepts through several spoken formats.
const easyTechnicalTopics = {
  topicScope: [
    'HTML content: purposes and distinctions of headings, paragraphs, links, and images; familiar element names without tag syntax',
    'Form controls: labels, text inputs, and submit buttons; purposes, basic differences, expected behavior, and simple checks for ordinary fields',
    'CSS styling: color, font size, margin, and padding; purposes, simple differences, and expected visual effects',
    'Simple layout: why pages adapt to smaller screens, readable arrangements, and basic checks for phone layouts; no layout property or value recall',
    'JavaScript basics: familiar value types, variables, functions, conditions, and repetition; no specific loop variants or implementation tracing',
    'Page interaction: purposes and differences of click and typing events, reading entered text, and changing visible text; no implementation steps',
  ],
  topicKeywords: [
    ['html', 'heading', 'paragraph', 'link', 'image', 'content'],
    ['form', 'label', 'text input', 'submit button', 'registration'],
    ['css', 'color', 'font', 'margin', 'padding', 'class', 'styling'],
    ['layout', 'row', 'flexbox', 'screen', 'responsive'],
    ['javascript', 'type', 'variable', 'string', 'number', 'boolean', 'condition', 'loop', 'repeat'],
    ['event', 'listen', 'click', 'press', 'typing', 'interaction', 'visible text'],
  ],
};
// Listing should test familiar categories, not force a property list from every topic.
const easyCompletenessTopics = {
  topicScope: [
    'HTML text elements: naming two familiar elements for headings or paragraphs',
    'Form information: naming two everyday details a student registration form could collect, not two text-entry controls',
    'CSS text styling: naming two basic properties for text color, size, or font',
    'JavaScript value types: naming two basic types such as strings, numbers, or booleans',
    'Page content: naming two kinds of content a simple HTML page can display, such as text, images, or links',
  ],
  topicKeywords: [
    ['heading', 'paragraph', 'text element', 'tag'],
    ['form', 'registration', 'detail', 'information', 'email'],
    ['css', 'property', 'properties', 'color', 'size', 'font'],
    ['javascript', 'type', 'variable', 'string', 'number', 'boolean'],
    ['content', 'page', 'image', 'link'],
  ],
};
const mediumTopics = {
  topicScope: [
    'Semantic HTML: choosing meaningful elements for navigation or main content and their accessibility purpose',
    'CSS behavior: box model, class selectors, source order for two normal equally specific rules in the same stylesheet, display set to none versus visibility set to hidden',
    'Responsive layout: flexbox alignment, wrapping with flex wrap set to wrap, relative positioning, and simple media queries; state any relevant setting value',
    'JavaScript behavior: reassignment, basic strict equality, conditions, and loops without coercion puzzles; for scope, explicitly state let or const and where the declaration occurs, ask whether the variable is accessible instead of asking for a value outside its scope',
    'DOM events: listening for clicks or input, changing visible text, and the purpose of preventing default form submission',
    'Form validation: required fields and simple input checks before submission',
  ],
  topicKeywords: [
    ['semantic', 'navigation', 'main', 'accessibility', 'html'],
    ['css', 'box model', 'selector', 'specificity', 'display', 'visibility', 'rule'],
    ['responsive', 'layout', 'flexbox', 'wrap', 'position', 'media query', 'screen'],
    ['javascript', 'variable', 'scope', 'reassign', 'equality', 'condition', 'loop'],
    ['dom', 'event', 'listener', 'click', 'text', 'prevent', 'default'],
    ['validation', 'validate', 'required', 'field', 'email', 'submit'],
  ],
};
const mediumTechnicalTopics = {
  topicScope: [
    'CSS behavior: class selectors, margin versus padding, display versus visibility, and source order of normal equally specific rules in one stylesheet; state relevant settings',
    'Responsive layout: flexbox wrapping and alignment for a stated direction, simple media queries, phone-layout testing and small layout decisions',
    'JavaScript behavior: conditions, strict equality with explicitly stated value types, and simple input checks; no coercion puzzles or code reading',
    'Page interaction: explaining event listeners, distinguishing click from input events, and expected visible changes without exact DOM method recall',
    'Form behavior: explaining default submission, preventing page reload, validating explicitly required fields, and testing input boundaries',
    'Script timing: explaining when page elements become available, comparing early selection with selection after the page is ready, and diagnosing early selection',
  ],
  topicKeywords: [
    ['css', 'rule', 'selector', 'specificity', 'class'],
    ['layout', 'flexbox', 'wrap', 'phone', 'screen', 'alignment', 'row'],
    ['javascript', 'condition', 'comparison', 'equality', 'number', 'string', 'boolean'],
    ['interaction', 'event', 'listener', 'click', 'text', 'typing'],
    ['form', 'submit', 'reload', 'required', 'validation', 'field'],
    ['script', 'timing', 'loaded', 'ready', 'early', 'exists', 'selection', 'page head', 'body'],
  ],
};
const mediumClarityTopics = {
  ...mediumTopics,
  topicScope: [
    'Semantic HTML explanation: how a navigation landmark helps a screen reader identify the page menu; explain one purpose without a comparison',
    'CSS behavior explanation: why display set to none removes an element from layout; explain one behavior without adding visibility as a second concept',
    'Responsive layout explanation: how one media query adapts a page to a smaller screen, or how wrapping keeps a flexbox row inside its container',
    'JavaScript scope explanation: why a variable explicitly declared with let inside a block cannot be accessed outside that block; no contrast with another variable',
    'DOM event explanation: how an input event lets a page react while someone types, or why preventing default submission avoids reloading; one mechanism only',
    'Validation explanation: why checking a required field prevents sending incomplete input; explain one purpose only',
  ],
};
const mediumCompletenessTopics = {
  topicScope: [
    'Semantic page regions: naming two semantic elements for distinct page regions',
    'CSS selector checks: naming two focused checks when a class style does not apply',
    'Responsive adjustments: naming two small layout adjustments for a page too wide for a phone',
    'Form validation checks: naming two checks for an explicitly required email field',
    'Interactive events: naming two distinct user events a form can respond to',
  ],
  topicKeywords: [
    ['semantic', 'region', 'navigation', 'main', 'html'],
    ['css', 'selector', 'class', 'style'],
    ['responsive', 'layout', 'phone', 'screen', 'width'],
    ['validation', 'required', 'email', 'field'],
    ['event', 'interaction', 'typing', 'submit event'],
  ],
};
const hardTopics = HARD_SET1_ROLE_PROFILES.frontend;
module.exports = {
    id: "frontend",
    label: "Frontend Developer",
    avoidList: `STRICT FRONTEND-SPECIFIC TOPIC BAN:
- Database internals: indexing, normalization, transactions, or query optimization`,
    difficultyAvoidLists: {
      easy: `ENTRY-LEVEL FRONTEND LIMITS:
- Browser rendering engine internals or detailed page rendering lifecycle
- CSS specificity calculation edge cases or selector weights
- Event propagation internals: event bubbling, event capturing, or stopPropagation
- JavaScript hoisting details, temporal dead zone, function expressions versus declarations, or closures
- Script loading or placement rules, CSS cascade and specificity, positioning edge cases, and exact DOM method or property names
- Framework knowledge, equality coercion, or comparisons of var, let, and const behavior
- Naming flexbox or responsive-layout properties or values; their simple purpose is sufficient
- Implementation procedures for click handlers, reading inputs, or updating text`,
      medium: 'Do not ask about advanced rendering internals, event-loop scheduling, or complex closure mechanics.',
    },

    set1: {
      difficultyTopics: {
        easy: { ...easyTopics, focusTopics: { focus_completeness: easyCompletenessTopics } },
        medium: { ...mediumTopics, focusTopics: { focus_clarity: mediumClarityTopics, focus_completeness: mediumCompletenessTopics } },
        hard: hardTopics,
      },
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
          "What is HTML used for?",
          "What does CSS do for a webpage?",
          "What is a JavaScript function?",
          "What is a form label used for?",
          "What is a click event?",
          "What does padding do inside an element?",
        ],
        focus_correctness: [
          "What is the difference between margin and padding in CSS?",
          "What is an HTML link used for?",
          "What is a boolean value in JavaScript?",
          "What is a loop used for in JavaScript?",
          "What is a click event on a webpage?",
        ],
        focus_completeness: [
          "Name two HTML elements used to display text on a webpage.",
          "Name two CSS properties that change how text looks.",
          "Name two basic data types in JavaScript.",
          "Name two details a student registration form could collect.",
          "Name two kinds of content an HTML page can display.",
        ],
      },

      mediumExamples: {
        focus_clarity: [
          "How does a media query adapt a page layout to a smaller screen?",
          "Why does preventing default submission keep a JavaScript form from reloading the page?",
          "How does semantic HTML help someone navigate a page using a screen reader?",
        ],
        focus_correctness: [
          "How does hiding an element with visibility differ from hiding it with display in a page layout?",
          "Which rule applies when two CSS rules target the same property with equal specificity?",
          "What result does strict equality produce when comparing the number five with the text five?",
        ],
        focus_completeness: [
          "Name two checks for a CSS class style that does not appear on an element?",
          "List two layout adjustments for a page that is too wide for a phone?",
          "Name two checks for an email field that is required before form submission?",
          "Name two semantic HTML elements for distinct regions of a page?",
          "List two user events a form can respond to?",
        ],
      },

      hardExamples: hardTopics.hardExamples,
    },

    set2: {
      difficultyTopics: { easy: easyTechnicalTopics, medium: mediumTechnicalTopics, hard: HARD_TECHNICAL_ROLE_PROFILES.frontend },
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
        ["event", "listener", "click", "prevent", "default", "form", "submit", "input", "value"],
        ["debug", "typo", "method", "error", "html", "css", "javascript"],
        ["css", "rule", "cascade", "specificity", "display", "visibility"],
        ["script", "head", "body", "placement", "defer", "async", "load", "early", "bottom"],
        ["button", "listener", "fire", "show", "hide", "toggle", "click"],
      ],

      // ── Flat pool of difficulty-anchor questions (TTS-safe) ──────────────────
      easyExamples: [
        "What does a click event represent on a webpage?",
        "Why does a text input need a label?",
        "How does margin differ from padding around a button?",
        "What happens to text when its font size increases?",
        "Name two checks for whether a page fits a phone screen?",
        "Which basic value type would hold a person's name?",
      ],

      mediumExamples: [
        "How does preventing default submission keep a JavaScript form on the current page?",
        "Why should a page check a required field before submitting its form?",
        "How does hiding an element with display differ from hiding it with visibility in the layout?",
        "What happens to overflowing items when a flexbox row allows wrapping?",
        "Name two test cases for a form that requires a nonempty name?",
        "A preview must change while someone types; which event should update the preview?",
        "A script selects an element before the page creates it; what could cause the empty selection?",
        "Why would you prefer wrapping cards to a fixed row when a phone screen cannot fit all cards?",
      ],

      hardExamples: HARD_TECHNICAL_ROLE_PROFILES.frontend.hardExamples,
    },
};
