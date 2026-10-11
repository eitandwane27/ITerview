// Original spoken questions; sources and limits: docs/android-interview.md.
function scope(entries) {
  return { topicScope: entries.map(([topic]) => topic), topicKeywords: entries.map(([, words]) => words) };
}
function applied(base, descriptions) {
  return { ...base, topicScope: base.topicScope.map((topic, i) => `${topic}: ${descriptions[i]}`) };
}
const easy = scope([
  ['App components', ['activity', 'component', 'app screen']],
  ['Interface resources', ['layout', 'resource', 'string', 'drawable']],
  ['Navigation intents', ['intent', 'navigation', 'destination']],
  ['Local storage', ['storage', 'preference', 'database', 'stored']],
  ['Device permissions', ['permission', 'camera', 'location']],
  ['Testing devices', ['emulator', 'device', 'test']],
]);
const medium = scope([
  ['Lifecycle state', ['lifecycle', 'rotation', 'recreation', 'view model']],
  ['State driven interfaces', ['Compose', 'recomposition', 'observable state', 'state update']],
  ['Asynchronous work', ['coroutine', 'main thread', 'background thread', 'request']],
  ['Local data choices', ['Room', 'data store', 'local data', 'persistence']],
  ['Navigation history', ['back stack', 'intent', 'navigation', 'destination']],
  ['Runtime permission access', ['runtime permission', 'permission', 'denial', 'access']],
]);
const hard = scope([
  ['State restoration', ['process death', 'saved state', 'restoration', 'restore']],
  ['Structured concurrency', ['cancellation', 'coroutine', 'scope', 'lifecycle']],
  ['Offline consistency', ['offline', 'cache', 'sync', 'retry', 'pending write']],
  ['Composition effects', ['recomposition', 'side effect', 'effect key', 'composition', 'effect', 'key']],
  ['Persistent work', ['work manager', 'background work', 'worker', 'constraint']],
  ['Performance and accessibility evidence', ['jank', 'frame time', 'profiler', 'accessibility', 'screen reader']],
]);
const easyExamples = {
  focus_clarity: [
    'What is an activity used for in an Android app?',
    'What is a string resource used for in an Android interface?',
    'What is an intent used for in Android?',
    'What is local storage used for in an Android app?',
    'What is a camera permission used for?',
    'What is an Android emulator used for?',
  ],
  focus_correctness: [
    'How does an activity differ from a background service?',
    'How does a text string resource differ from a drawable resource?',
    'How does an explicit intent differ from an implicit intent?',
    'How does a stored preference differ from a temporary variable in memory?',
    'Camera permission is denied; what access does the app have to the protected camera capability?',
    'How does an emulator differ from a physical Android device?',
  ],
  focus_completeness: [
    'Name two familiar Android app components?',
    'Name two kinds of Android interface resources?',
    'Name two familiar actions an implicit intent can request?',
    'Name two user preferences suitable for local storage?',
    'Name two device capabilities that can require Android permissions?',
    'Name two device characteristics useful when testing an Android interface?',
  ],
};
const mediumExamples = {
  focus_clarity: [
    'How does an activity scoped view model preserve screen data during ordinary rotation recreation?',
    'How does an observable state update make Compose refresh the content that reads it?',
    'Why does moving blocking work off the main thread help an Android interface respond to input?',
    'Why does Room suit local data that needs queries across related records?',
    'How does a navigation back stack preserve the order of visited destinations?',
    'Why should an app handle runtime permission denial without repeatedly forcing the same prompt?',
  ],
  focus_correctness: [
    'How does an activity scoped view model differ from an activity field during ordinary rotation recreation?',
    'How does updating observable Compose state differ from mutating an ordinary unobserved list for interface refresh?',
    'A blocking request occupies the main thread; what happens to processing user input until that thread becomes available?',
    'How does Room differ from data store for querying related local records?',
    'Navigation adds a details destination above a list; what destination is revealed when the details entry is popped?',
    'Runtime permission was denied and no grant followed; what protected access should the app assume it has?',
  ],
  focus_completeness: [
    'Name two lifecycle checks for preserving screen data across ordinary rotation recreation?',
    'Name two Compose state details to inspect when changed data is not reflected on screen?',
    'Name two request outcomes an asynchronous loading interface should handle?',
    'Name two local data requirements to compare before choosing Room or data store?',
    'Name two navigation checks when Back returns to an unexpected destination?',
    'Name two runtime permission outcomes an app should handle?',
  ],
};
const hardExamples = {
  focus_clarity: [
    'Why does a view model alone fail to restore unsaved screen data after system initiated process death?',
    'How does lifecycle scoped coroutine cancellation prevent obsolete screen work from continuing after its owner is destroyed?',
    'Why must an offline pending write remain distinguishable from a server confirmed save?',
    'Why can performing a side effect directly during recomposition repeat that operation unexpectedly?',
    'Why does work manager suit deferrable background work that must remain scheduled after process recreation?',
    'Why can a high average frame rate hide jank visible in individual frame times?',
  ],
  focus_correctness: [
    'How does saved state restoration differ from view model memory retention after system initiated process death?',
    'An owner is destroyed and its lifecycle coroutine scope is cancelled; what happens to a cooperative suspended child operation?',
    'An offline edit is queued locally without server confirmation; what synchronization status should the interface report?',
    'How does a stable effect key differ from a changing key in restarting a composition scoped coroutine effect?',
    'Background work requires network connectivity and that constraint remains unmet; what execution outcome should work manager permit?',
    'How does a visual icon label differ from screen reader evidence that its action has an accessible name?',
  ],
  focus_completeness: [
    'Name three restoration checks for a draft after system initiated process death?',
    'Name three coroutine cancellation checks when a screen owner is destroyed?',
    'Name three offline synchronization checks before reporting a queued edit as saved remotely?',
    'Name three composition effect checks when a request repeats during recomposition?',
    'Name three background work checks when a constrained worker has not executed?',
    'Name three accessibility checks for an icon action used with a screen reader?',
  ],
};
const focusDescriptions = {
  easy: {
    focus_clarity: ['explain component purpose', 'explain resource purpose', 'explain intent purpose', 'explain storage purpose', 'explain permission purpose', 'explain emulator purpose'],
    focus_correctness: ['distinguish foreground interface and background components', 'distinguish text and image resources', 'distinguish explicit and implicit intent targeting', 'distinguish stored preferences from temporary variables', 'predict protected access under an explicit denial', 'distinguish emulation from a physical device'],
    focus_completeness: ['name two app components', 'name two resource types', 'name two implicit intent actions', 'name two stored preference examples', 'name two protected capabilities', 'name two device test characteristics'],
  },
  medium: {
    focus_clarity: ['explain scoped screen data retention during configuration recreation', 'explain observed state driven refresh', 'explain responsiveness with nonblocking main thread work', 'explain queried record storage', 'explain destination history', 'explain respectful handling of a denied grant'],
    focus_correctness: ['compare activity fields with retained view model data', 'compare observed state changes with unobserved mutation', 'predict input responsiveness under blocking work', 'compare record queries with small preference storage', 'predict popping a stated top destination', 'predict access under an explicitly denied grant'],
    focus_completeness: ['name two recreation checks', 'name two observable state checks', 'name two asynchronous request outcomes', 'name two persistence requirements', 'name two back stack checks', 'name two grant outcomes'],
  },
  hard: {
    focus_clarity: ['explain limits of memory after process death', 'explain cooperative child cancellation with destroyed ownership', 'explain local pending versus remote confirmation', 'explain repeated side effect risk', 'explain persistent deferrable scheduling', 'explain aggregate performance evidence limits'],
    focus_correctness: ['compare saved state with in-memory retention after process death', 'predict cooperative suspended cancellation', 'predict pending status without server confirmation', 'compare stable and changing composition effect keys', 'predict eligibility while a required constraint remains unmet', 'compare visual labeling with programmatic screen reader evidence'],
    focus_completeness: ['name three draft restoration checks', 'name three cancellation checks', 'name three remote synchronization checks', 'name three repeated effect checks', 'name three worker eligibility checks', 'name three screen reader action checks'],
  },
};
function focused(base, tier) {
  return { ...base, focusTopics: Object.fromEntries(Object.entries(focusDescriptions[tier]).map(([focus, descriptions]) => [focus, applied(base, descriptions)])) };
}
module.exports = {
  id: 'android', label: 'Android Developer',
  avoidList: `ANDROID DEVELOPER SCOPE:
- Target students and graduates building small native Android apps. Use original spoken tasks about components, resources, navigation, lifecycle, Compose state, coroutines, local data, runtime permissions and bounded reliability.
- Use plain English names: view model, data store, work manager, saved state and screen reader. No code, XML markup, callback spelling, method recall, exact dependency versions, target SDK numbers, command syntax or required production experience. Kotlin may supply familiar conceptual context; no syntax quizzes or null assertion tricks.
- Ask one task. Set 1 clarity explains a purpose or mechanism, correctness predicts one precise behavior or compares related concepts, completeness asks two items in easy and medium and three in hard. Do not append and why, and does or extra tasks. Never leak requested list items in an assuming or given clause.
- Easy correctness must select an accurate behavior or compare related concepts; a what is the purpose question belongs to clarity. Hard completeness should use a short category request like Name three restoration checks for a draft, not a clause claiming restoration under every termination condition.
- Keep hard explanations to one why or how probe: do not combine why work remains scheduled with how constraints work, or how cancellation works with why a server write remains. Completeness must leave all requested items for the student: no covering clause or prefilled name, role and activation list.
- An activity hosts UI and lifecycle; modern apps may have many destinations within one activity. Do not claim every screen must have its own activity. A service is not automatically a background thread or guaranteed indefinite execution.
- An explicit intent names a target component; an implicit intent describes an action for a suitable handler. Supply a matching installed handler if predicting successful launch. Intents are not required for every in-app Compose navigation change.
- Resources support reusable text and images and configuration alternatives. A separate resource does not automatically translate itself. App-private local storage is distinct from shared media; permission requirements depend on the operation and Android version.
- State explicitly that a capability requires a runtime permission when predicting access. A manifest declaration or request does not grant permission. Denial does not necessarily crash the app; ask about unavailable access or respectful fallback. Avoid exact prompt counts and version-specific permission groups.
- A normally scoped view model survives configuration recreation but does not survive system initiated process death. Specify owner scope and ordinary rotation recreation, not every activity replacement. Finishing or clearing the owner is distinct from temporary recreation.
- Keep ordinary rotation retention in medium. Hard draft restoration questions must explicitly concern system initiated process death; requesting three checks does not make an ordinary rotation task hard.
- Saved UI state restores small serializable values under supported system restoration; it is not durable user-data storage and does not guarantee restoration after force stop, explicit dismissal or device reboot. Room and data store supply persistent local data; completed saves are required before predicting retained data.
- Compose refresh depends on observed state read by relevant content. Mutation of an ordinary unobserved collection alone does not notify Compose. Recomposition does not necessarily redraw every element or rerun every effect, and a local temporary variable is not persistent state.
- When predicting displayed contents after unobserved mutation, explicitly exclude other recomposition triggers; otherwise ask which notification the mutation alone supplies. Never imply an effect can avoid restarting while its key actually changes: key changes intentionally cancel and restart the coroutine effect.
- Coroutines do not automatically execute on a background thread. Blocking work still blocks its actual dispatcher thread; suspending is not synonymous with blocking. Specify a main-safe operation or dispatcher switch when applying background execution, without asking for API spelling.
- Cancellation is cooperative. Say cooperative or cancellable explicitly for a suspended child before predicting cancellation. State that the relevant scope is cancelled or cleared. A view model scope is cleared with the view model, not automatically when a screen disappears or pauses; screen destruction alone does not establish that its retained model is cleared. Cancellation of a client request does not prove a server write was undone.
- Distinguish Room relational record queries from data store small settings or typed objects. Neither makes network data current automatically. Avoid saying storage guarantees encryption, schema compatibility or cross-device sync without an explicit mechanism.
- For Back outcomes, provide the ordered navigation entries and state that the top entry is popped. Do not mix Up navigation, gesture cancellation, app task history or unspecified launch flags into the same task.
- An offline queued edit is pending synchronization, not a confirmed server save. Unknown network outcomes require checking confirmation or safe retry semantics; a retry alone does not prove success. Accept alternative safeguards consistent with the supplied conflict or confirmation policy.
- A sync worker reporting success does not by itself establish server acceptance. Supply an explicit server acknowledgement before predicting a remotely confirmed save. For deferrable work, ask about eligibility under constraints; never demand a guaranteed execution time when connectivity returns.
- Composition effects follow their supplied ownership and key behavior. A coroutine effect restarts when its key changes and cancels when it leaves composition; a stable key does not mean it runs only once for the whole app lifetime. Explain repeat risk without claiming every recomposition restarts every effect.
- Work manager schedules persistent deferrable work, not exact-time alarms or guaranteed immediate execution. Required constraints make work eligible only when satisfied; eligibility is not an exact start-time guarantee. Persistent work is not immunity to force stop, uninstall or revoked access.
- Profile actual slow frames before choosing an optimization. Average frame rate can hide jank. A visible icon alone does not establish a screen reader name, role or activation behavior; use programmatic semantics and observed assistive interaction.
- Read history and prefer an unasked category. Different wording for the same retention rule or item-list category is repetition. Do not start every question with In an Android app or In a student project. Prefer direct How or Why explanations when scenarios add no useful premise.
- Keep easy to one introductory fact, medium to at most two connected reasoning steps and hard to at most three. Prefer 8 to 18 words in easy, 12 to 24 in medium and 18 to 30 in hard. Do not disguise definitions as hard by adding unfamiliar names.
- Exclude custom rendering engines, advanced dependency injection, full architecture design, build-system troubleshooting, signing pipelines, root exploits, native internals and certification trivia. Set 3 stays shared behavioral practice.`,
  difficultyAvoidLists: {
    easy: 'One familiar purpose, fact, comparison or direct action. No lifecycle callback ordering, configuration retention internals, Compose recomposition, coroutine dispatchers, Room migrations or background scheduling.',
    medium: 'One focused applied mechanism, outcome, comparison or check with at most two connected reasoning steps. No process-death restoration, cooperative cancellation edge cases, repeated composition effects, offline conflict design or constrained persistent workers.',
    hard: 'One bounded advanced-junior mechanism, evidence limit, conditional outcome or trade-off. Supply owner, cancellation, restoration, effect-key and scheduling conditions; no whole application designs, production incidents or engine internals.',
  },
  set1: { ...medium, difficultyTopics: { easy: focused(easy, 'easy'), medium: focused(medium, 'medium'), hard: focused(hard, 'hard') }, easyExamples, mediumExamples, hardExamples },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: applied(easy, ['explain familiar component roles', 'select a reusable interface resource', 'apply a familiar intent purpose with a stated handler', 'choose storage for a simple retained preference', 'predict access under a stated protected permission', 'check one interface behavior on a device or emulator']),
      medium: applied(medium, ['preserve screen data across scoped rotation recreation', 'apply observable state changes to content refresh', 'keep blocking work away from main thread input handling', 'choose local record or preference persistence', 'apply a stated destination push or pop', 'handle a grant result without assuming authorization']),
      hard: applied(hard, ['restore supported lightweight state after system process death', 'apply cooperative coroutine cancellation to explicit ownership', 'distinguish local pending edits and confirmed synchronization', 'control repeated operations with supplied composition effect keys', 'evaluate deferrable worker eligibility under stated constraints', 'test frame timing or programmatic screen reader action evidence']),
    },
    easyExamples: [
      'What does an activity provide for an Android app?',
      'Why is a string resource useful for interface text?',
      'How does a stored preference differ from a temporary variable?',
      'A feature needs camera permission and the user denies it; what happens to its permitted camera access?',
      'Name two device test cases for text that must remain readable on different screen sizes?',
      'An installed browser handles web links; which intent type requests opening a link without naming its recipient?',
    ],
    mediumExamples: [
      'How does an activity scoped view model retain screen data across ordinary rotation recreation?',
      'Why does observable state help Compose refresh content after a state update?',
      'How does Room differ from data store when local data needs relational queries?',
      'A blocking request runs on the main thread; what happens to input handling until that request returns?',
      'Name two runtime permission test cases for a feature requiring a protected capability?',
      'Navigation must return from details to the preceding list; what back stack action fits?',
      'Compose reads a plain list that is mutated without observable state updates; what state detail should you check first?',
      'Why would you prefer background execution over main thread execution for a blocking database operation?',
    ],
    hardExamples: [
      'How does saved state restoration recover a lightweight draft after system process death when its view model memory is gone?',
      'Why must a cooperative coroutine use an appropriate lifecycle owner when its result only matters to that screen?',
      'How does a locally queued offline edit differ from a server confirmed edit in synchronization status?',
      'A composition scoped coroutine effect has a new key value; what happens to its previous execution?',
      'Name two background work checks for a worker waiting on a required network constraint?',
      'An icon must be understandable to a screen reader; what accessibility evidence should verify its action name?',
      'A screen has a smooth average frame rate but intermittent jank; what profiler evidence should you check first?',
      'Why would you prefer work manager over a screen scoped coroutine for deferrable work that must remain scheduled after process recreation?',
    ],
  },
};
