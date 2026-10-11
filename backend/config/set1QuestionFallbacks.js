// Supplement the reviewed role calibration examples where fewer than five
// distinct tasks exist. These questions are never used for another role/tier.
const SET1_FALLBACK_SUPPLEMENTS = {
  'data-analyst': {},
  'ai-engineer': {},
  'it-support': {},
  ios: {},
  devops: {},
  android: {},
  // Six reviewed UI/UX Developer questions per tier and focus.
  'ui-ux-developer': {},
  // Six reviewed Game Developer examples per difficulty and focus.
  'game-developer': {},
  // Each QA calibration bank already contains six distinct checked questions.
  'qa-engineer': {},
  // Six reviewed Cybersecurity questions per difficulty and focus.
  'cyber-security': {},
  // Six reviewed Network Engineer questions per difficulty and focus.
  'network-engineer': {},
  frontend: { easy: { focus_completeness: ['Name two HTML text elements used to organize written content?'] }, medium: {
    focus_clarity: [
      'Why does hiding an element with display set to none remove the space it occupied in the page layout?',
      'Why is a variable declared with let inside a block unavailable outside that block?',
    ],
    focus_correctness: [
      'What happens to flexbox items that exceed the container width when wrapping is enabled?',
      'Which event reports changes while someone types into an input field?',
    ],
  } },
  backend: {
    easy: {
      focus_clarity: ['What is JSON used for between a client and server?'],
      focus_completeness: ['Name two HTTP methods used to retrieve and submit data?'],
    },
    medium: {
      focus_clarity: [
        'Why does checking required fields before saving prevent incomplete database records?',
        'How do environment variables keep database credentials separate from application source code?',
      ],
      focus_correctness: [
        'What should a route do when a required email field is missing before saving a record?',
        'Which request detail identifies the record when its identifier is included in the path?',
      ],
    },
  },
  fullstack: {
    easy: {
      focus_clarity: ['Why does the frontend show a message after receiving a server response?'],
      focus_completeness: [
        'Name two basic operations an application can perform on stored records?',
        'Name two basic kinds of messages exchanged when a page asks a server for data?',
      ],
    },
    medium: {
      focus_clarity: ['How does session storage keep a non-sensitive preference available during a browser tab session?'],
      focus_correctness: [
        'Which side should hold a private API key when a browser page needs data from an external service?',
        'What should the frontend show when the backend rejects a submission because a required field is missing?',
      ],
    },
  },
};

module.exports = { SET1_FALLBACK_SUPPLEMENTS };
