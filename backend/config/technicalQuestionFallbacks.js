// Reviewed spoken questions for Set 2 quality-repair exhaustion only.
// Topic names match the prefix before ':' in each role's difficulty scope.
// Keep this bank separate from prompt examples so calibration edits do not
// silently change the questions served when generation is unsuccessful.
const TECHNICAL_QUESTION_FALLBACKS = {
  'it-support': {
    easy: require('./roles/itSupportFallbacks').easy,
    medium: require('./roles/itSupportFallbacks').medium,
  },
  'data-analyst': {
    easy: require('./roles/dataAnalystFallbacks').easy,
    medium: require('./roles/dataAnalystFallbacks').medium,
  },
  'ai-engineer': {
    easy: require('./roles/aiEngineerFallbacks').easy,
    medium: require('./roles/aiEngineerFallbacks').medium,
  },
  devops: {
    easy: require('./roles/devopsFallbacks').easy,
    medium: require('./roles/devopsFallbacks').medium,
  },
  ios: {
    easy: require('./roles/iosFallbacks').easy,
    medium: require('./roles/iosFallbacks').medium,
  },
  android: {
    easy: require('./roles/androidFallbacks').easy,
    medium: require('./roles/androidFallbacks').medium,
  },
  'ui-ux-developer': {
    easy: require('./roles/uiUxDeveloperFallbacks').easy,
    medium: require('./roles/uiUxDeveloperFallbacks').medium,
  },
  'game-developer': {
    easy: require('./roles/gameDeveloperFallbacks').easy,
    medium: require('./roles/gameDeveloperFallbacks').medium,
  },
  'network-engineer': {
    easy: require('./roles/networkEngineerFallbacks').easy,
    medium: require('./roles/networkEngineerFallbacks').medium,
  },
  'cyber-security': {
    easy: require('./roles/cyberSecurityFallbacks').easy,
    medium: require('./roles/cyberSecurityFallbacks').medium,
  },
  'qa-engineer': {
    easy: require('./roles/qaEngineerFallbacks').easy,
    medium: require('./roles/qaEngineerFallbacks').medium,
  },
  frontend: {
    easy: [
      ['HTML content', 'What does a heading tell a reader about the content below it?'],
      ['HTML content', 'How does a link differ from an image on a webpage?'],
      ['Form controls', 'Why should a text input have a visible label?'],
      ['Form controls', 'Name two checks for a form input that requires an email address?'],
      ['CSS styling', 'What happens to the appearance of text when its font size increases?'],
      ['CSS styling', 'How does margin differ from padding around a button?'],
      ['Simple layout', 'Name two checks for whether a webpage fits a narrow phone screen?'],
      ['Simple layout', 'A row of cards is too wide for a phone; what simple arrangement would fit the cards?'],
      ['JavaScript basics', 'What does a variable let a program store?'],
      ['JavaScript basics', 'How does a string differ from a number in JavaScript?'],
      ['JavaScript basics', 'A variable holds five and is reassigned ten; what will happen to its stored value?'],
      ['Page interaction', 'Why does a page listen for a button click?'],
      ['Page interaction', 'Which event should a page listen for when someone types into a text input?'],
    ],
    medium: [
      ['CSS behavior', 'How does hiding an element with display set to none differ from visibility set to hidden in the layout?'],
      ['CSS behavior', 'What happens to space around an element when its margin increases?'],
      ['Responsive layout', 'Name two checks for whether wrapping cards remain usable on a narrow phone screen?'],
      ['Responsive layout', 'Why would you prefer wrapping cards to a fixed row when a phone screen cannot fit all the cards?'],
      ['JavaScript behavior', 'How does strict equality compare the number five with the text value five?'],
      ['JavaScript behavior', 'An input value is the string five; which value type should you compare it with using strict equality?'],
      ['Page interaction', 'How does an input event listener let a page update a preview while someone types?'],
      ['Page interaction', 'Why is an input event useful for updating a preview while someone types?'],
      ['Form behavior', 'Name two test cases for a form that requires a nonempty name?'],
      ['Form behavior', 'A JavaScript form should stay on the current page after submission; what default browser behavior should it prevent?'],
      ['Script timing', 'A script selects an element before the page creates it; what could cause the empty selection?'],
      ['Script timing', 'How does waiting until page elements exist help a script select them successfully?'],
    ],
  },
  backend: {
    easy: [
      ['Server responsibilities', 'What does a server response provide after a client makes a request?'],
      ['Server responsibilities', 'A requested record exists; what information should the server return?'],
      ['HTTP methods', 'How does retrieving information with GET differ from submitting information with POST?'],
      ['HTTP methods', 'Which HTTP method would retrieve a list of products?'],
      ['API access', 'Why is an API useful when two applications need to exchange information?'],
      ['API access', 'What does an API allow another application to access?'],
      ['Data exchange', 'How does structured JSON data differ from an ordinary paragraph?'],
      ['Data exchange', 'Name two checks for JSON data that must contain a name field and an age field?'],
      ['Database operations', 'What happens to a saved address when its database record is updated?'],
      ['Database operations', 'Which database operation would change the address in an existing record?'],
      ['Input validation', 'Why should a server validate a required field before saving it?'],
      ['Input validation', 'Name two test cases for an email field that is required?'],
    ],
    medium: [
      ['HTTP request handling', 'How does the HTTP method differ from the path when a server matches a request to a route?'],
      ['HTTP request handling', 'Name two checks for whether a request matches a route defined by an HTTP method and a path?'],
      ['Validation', 'Why should a server validate input even when the frontend already checks it?'],
      ['Validation', 'A required email field is empty; what should the server do before saving the registration?'],
      ['Middleware', 'How does validation middleware check input before a route handler runs?'],
      ['Middleware', 'Validation middleware rejects a request without calling the next handler; what happens to the route handler for that request?'],
      ['Async timing', 'Why should a route wait for a database lookup before sending a response that uses its result?'],
      ['Async timing', 'A route responds while its asynchronous lookup is still pending; what could cause the response to lack the lookup result?'],
      ['Database results', 'How does a successful database lookup with no matching record differ from a failed query?'],
      ['Database results', 'Name two test cases for a lookup endpoint that handles both a matching record and a successful empty result?'],
      ['Environment configuration', 'Why would you prefer environment settings to hardcoded credentials when source code is stored in a public repository?'],
      ['Environment configuration', 'How do environment settings keep database credentials separate from application source code?'],
    ],
  },
  fullstack: {
    easy: [
      ['Page presentation responsibilities', 'What does the frontend do with information that should be visible on a webpage?'],
      ['Page presentation responsibilities', 'How does displaying information differ from storing it permanently?'],
      ['Form submission', 'Why does a registration form send entered information to the backend?'],
      ['Form submission', 'Name two checks for whether a form sends the name and email entered by a user?'],
      ['Saving a record', 'What does saving information in a database allow an application to do later?'],
      ['Saving a record', 'What happens to an existing saved address when the app updates that address?'],
      ['Retrieving a record', 'How does reading a saved record differ from creating a new record?'],
      ['Retrieving a record', 'Which database operation would retrieve an existing profile?'],
      ['Displaying an outcome', 'Why should a page display feedback after a form is submitted?'],
      ['Displaying an outcome', 'The backend confirms that a save succeeded; what message should the page display?'],
      ['Shared data', 'Name two test cases for a form field that is required?'],
      ['Shared data', 'A required name field is empty; what should the application request before accepting the form?'],
    ],
    medium: [
      ['Form request agreement', 'How does agreeing on field names help a backend interpret data sent by a frontend?'],
      ['Form request agreement', 'Name two checks for whether a submitted field matches the name and value type expected by the backend?'],
      ['Response handling', 'Why should a page show the field identified by a backend validation error?'],
      ['Response handling', 'The server rejects a form because its required email is empty; what feedback should the page show?'],
      ['JSON handling', 'How does JSON text differ from a parsed object when the frontend needs to access a field?'],
      ['JSON handling', 'How does parsing JSON text make returned fields available to the frontend?'],
      ['Async request timing', 'A page only shows success after server confirmation; what happens to its success message while the save request is pending?'],
      ['Async request timing', 'A page shows success before its save request finishes; what could cause this premature feedback?'],
      ['Preference storage', 'How does local storage differ from session storage in how long a preference lasts?'],
      ['Preference storage', 'A theme preference must survive page reloads but clear when its tab closes; which storage option fits?'],
      ['Server configuration', 'Why would you prefer a private server setting to frontend code for an API key that must remain secret?'],
      ['Server configuration', 'Why does a backend need to allow a browser origin before that origin can read a cross-origin response?'],
    ],
  },
};

module.exports = { TECHNICAL_QUESTION_FALLBACKS };
