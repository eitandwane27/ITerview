// Original spoken adaptations; research and validation: docs/ios-interview.md.
const scope = entries => ({ topicScope: entries.map(([name]) => name), topicKeywords: entries.map(([, words]) => words) });
const applied = (base, descriptions) => ({ ...base, topicScope: base.topicScope.map((name, i) => `${name}: ${descriptions[i]}`) });
const easy = scope([
  ['Swift values', ['variable', 'constant', 'Boolean', 'integer', 'value type']],
  ['Interface elements', ['button', 'label', 'text', 'image', 'interface element']],
  ['Screen navigation', ['navigation', 'destination', 'screen']],
  ['Local preferences', ['preference', 'user defaults', 'stored setting', 'local storage']],
  ['Device access', ['permission', 'camera', 'microphone', 'access']],
  ['Device testing', ['simulator', 'device', 'test']],
]);
const medium = scope([
  ['Observable interface state', ['Swift UI', 'observable', 'binding', 'state update']],
  ['Value and reference semantics', ['structure', 'class', 'reference type', 'value type', 'copy', 'copied', 'semantics']],
  ['Optional handling', ['optional', 'nil', 'missing value', 'unwrap']],
  ['Main thread responsiveness', ['main thread', 'blocking', 'suspension', 'asynchronous']],
  ['Persistence choices', ['user defaults', 'record', 'file', 'database', 'Swift data']],
  ['Navigation state', ['navigation', 'path', 'destination', 'stack']],
]);
const hard = scope([
  ['Reference ownership', ['weak', 'unowned', 'retain cycle', 'strong reference', 'closure', 'ownership']],
  ['Task cancellation', ['cancellation', 'cancelled', 'cooperative', 'child task', 'task group']],
  ['Asynchronous result ordering', ['stale', 'request identity', 'request identifier', 'older request', 'latest request', 'search result']],
  ['Save confirmation', ['persistent save', 'persistent store', 'save failure', 'save error', 'confirmed save', 'save confirmation', 'persistence', 'persist', 'persisted', 'save fails', 'save call']],
  ['Background eligibility', ['background task', 'scheduler', 'earliest start', 'background refresh', 'eligibility']],
  ['Interface evidence', ['view identity', "view's identity", 'stable identity', 'screen reader', 'accessibility', 'frame time', 'profiler']],
]);
const examples = {
  easy: {
    focus_clarity: [
      'What is a Boolean value used to represent?',
      'What is a button used for in an Apple mobile app?',
      'What is screen navigation used for in an app?',
      'What is user defaults used for in an Apple mobile app?',
      'What is camera permission used for?',
      'What is a simulator used for when developing a mobile app?',
    ],
    focus_correctness: [
      'How does an integer variable differ from an integer constant in Swift?',
      'How does a text label differ from an interactive button?',
      'How does opening a new navigation destination differ from returning to a preceding destination?',
      'How does a saved preference differ from a temporary value in memory?',
      'Camera permission is denied; what protected camera access does the app have?',
      'How does a simulator differ from a physical Apple mobile device?',
    ],
    focus_completeness: [
      'Name two familiar Swift value types?',
      'Name two interface elements in an Apple mobile app?',
      'Name two familiar screen navigation actions?',
      'Name two nonsensitive user preferences suitable for local storage?',
      'Name two device capabilities that can require permission?',
      'Name two device characteristics useful when testing a mobile interface?',
    ],
  },
  medium: {
    focus_clarity: [
      'How does an observable state update help Swift UI refresh content that reads that state?',
      'Why does changing an independent structure copy leave the original structure value unchanged?',
      'Why does checking an optional before using its value avoid assuming missing data is present?',
      'Why does moving blocking work off the main thread help an app respond to taps?',
      'Why does a record database suit local data that needs queries across related entries?',
      'How does a navigation path represent the sequence of presented destinations?',
    ],
    focus_correctness: [
      'How does a binding to existing Swift UI state differ from a separate independent state value?',
      'How does copying a structure containing only integers differ from copying a reference to a class instance?',
      'An optional contains nil; what happens if the app force unwraps that optional?',
      'A blocking operation occupies the main thread; what happens to input processing until that thread becomes available?',
      'How does user defaults differ from a record database for querying related entries?',
      'A navigation stack contains a list followed by details; what destination is revealed when the details entry is removed?',
    ],
    focus_completeness: [
      'Name two observable state checks when Swift UI does not reflect an updated value?',
      'Name two value and reference semantics checks when a copied model unexpectedly shares changes?',
      'Name two optional value cases that a safe input handler should handle?',
      'Name two main thread responsiveness checks for a slow interface action?',
      'Name two persistence requirements to compare before choosing user defaults or a record database?',
      'Name two navigation path checks when Back reveals an unexpected destination?',
    ],
  },
  hard: {
    focus_clarity: [
      'Why can an object and its stored closure keep each other alive through a strong reference cycle?',
      'Why does cancelling a Swift task require its running operation to cooperate with cancellation?',
      'Why can an older request finishing last overwrite a newer search result without a request identity check?',
      'Why does updated in-memory content fail to prove that a persistent save succeeded?',
      'Why does a background task earliest start time fail to guarantee execution at that exact time?',
      'Why can changing view identity reset locally owned interface state despite unchanged visible content?',
    ],
    focus_correctness: [
      'How does a weak reference differ from a checked unowned reference when the referenced object has been deallocated?',
      'A Swift task is cancelled but its computation never checks cancellation; what immediate stopping guarantee does cancellation provide?',
      'An older request finishes after the latest request; what update should a current request identity check reject?',
      'A persistent save fails and no later save succeeds; what confirmed save status should the interface report?',
      'A background task reaches its earliest start time; what execution timing guarantee does the system provide?',
      'How does a visible icon differ from screen reader evidence that its action has an accessible name?',
    ],
    focus_completeness: [
      'Name three ownership checks for an object retained by its stored closure?',
      'Name three cancellation checks for a cooperative child task in a cancelled task group?',
      'Name three request identity checks before an older search result replaces current content?',
      'Name three persistent save checks before reporting an edited draft as saved?',
      'Name three background task eligibility checks for a deferred refresh?',
      'Name three accessibility checks for an icon action used with a screen reader?',
    ],
  },
};
const focusDetails = {
  easy: {
    focus_clarity: ['explain a familiar Swift value purpose', 'explain a familiar interface element purpose', 'explain screen navigation purpose', 'explain nonsensitive preference storage', 'explain protected capability permission', 'explain simulator purpose'],
    focus_correctness: ['compare reassignment of integer variables and constants', 'compare display elements with interactive elements', 'compare opening and returning destinations', 'compare stored preferences with temporary memory', 'predict protected access under denied permission', 'compare simulation with physical testing'],
    focus_completeness: ['name two familiar value types', 'name two interface elements', 'name two familiar navigation actions', 'name two nonsensitive preference examples', 'name two protected capabilities', 'name two device test characteristics'],
  },
  medium: {
    focus_clarity: ['explain observed state refresh', 'explain independent value copying without shared nested references', 'explain safe missing-value handling', 'explain responsiveness without blocking input handling', 'explain queried record persistence', 'explain destination history'],
    focus_correctness: ['compare a binding with independent state', 'compare plain value copies with class references', 'predict forced access to an explicitly nil optional', 'predict input delay during stated main thread blocking', 'compare preferences with relational record queries', 'predict removing a stated top destination'],
    focus_completeness: ['name two state observation checks', 'name two copy-sharing checks', 'name two optional cases', 'name two responsiveness checks', 'name two data storage requirements', 'name two destination history checks'],
  },
  hard: {
    focus_clarity: ['explain strong closure ownership cycles', 'explain cooperative cancellation limits', 'explain stale asynchronous completion hazards', 'explain memory versus confirmed persistence', 'explain earliest scheduling time limits', 'explain identity-bound state lifetime'],
    focus_correctness: ['compare weak and checked unowned lifetime behavior', 'predict limits of cancellation without cooperation', 'predict rejection of explicitly obsolete request results', 'predict confirmed status after a failed save without later success', 'predict earliest start scheduling guarantees', 'compare visual appearance with programmatic accessibility evidence'],
    focus_completeness: ['name three closure ownership checks', 'name three cooperative child cancellation checks', 'name three obsolete result checks', 'name three save confirmation checks', 'name three deferred task eligibility checks', 'name three screen reader action checks'],
  },
};
const focused = (base, difficulty) => ({ ...base, focusTopics: Object.fromEntries(Object.entries(focusDetails[difficulty]).map(([focus, descriptions]) => [focus, applied(base, descriptions)])) });
module.exports = {
  id: 'ios', label: 'iOS Developer',
  avoidList: `IOS DEVELOPER SPOKEN SCOPE:
- Target students building small native Apple mobile apps with Swift, Swift UI and familiar UI kit concepts. Questions must be original, short and answerable verbally. No code, property wrapper spelling, callback names, selectors, build commands, certificates, signing operations, exact operating system versions or production incidents.
- Use spoken names: Swift UI, user defaults, Swift data, main actor, screen reader and Apple mobile app. Avoid camel case brand names such as iOS or iPhone inside the question, as the shared speech guards reject identifier-like casing. The display label remains iOS Developer.
- Ask one task. Clarity explains a purpose or mechanism. Correctness selects one accurate behavior or compares related concepts. Completeness asks two items in easy/medium and three in hard. Do not append another why, how, outcome, example or list. Do not supply requested items through including, covering, given or assuming clauses.
- Omit repeated introductions such as In a small Apple mobile app. Aim for 18 to 30 words in hard and keep the question below 45 words. Never append and state the checks to a comparison.
- For correctness accessibility questions select one behavior, one missing property or one focused comparison; a request for name, role and activation evidence belongs to completeness.
- Do not predict the exact screen reader announcement from an absent explicit label alone. Ask which programmatic naming property is missing or what evidence to inspect; the full announcement also depends on control semantics and supplied accessibility context.
- A Swift integer constant cannot be reassigned, but a constant class reference does not make every property immutable. Value copies are independent only for the stated value content; structures can contain shared class references. Specify integer-only fields before predicting fully independent nested data.
- An optional may contain a value or nil. Forced unwrapping an explicitly nil optional traps. Safe handling checks for presence or provides an appropriate fallback; never assume nil means zero, empty text or automatic success. No operator spelling quizzes.
- Swift UI observes supported state dependencies. Ordinary temporary variables or unobserved collection mutation do not automatically notify it. Do not predict exact displayed contents unless other refresh triggers are excluded. A binding refers to an existing source of truth, not an automatically independent copy.
- Navigation outcomes require the ordered path and an explicit top-entry removal. Not every screen needs its own controller or scene. View identity governs local state lifetime; a new view description alone does not prove new identity or state loss. View appearance is not a globally once-only operation.
- Ask about the navigation path entry, not what happens to the departed screen object. Updating a path can itself push a destination; compare explicit append, remove or replace operations rather than treating path updates and pushing as incompatible mechanisms.
- Replacing a navigation path entry alone does not establish changed view identity. Before predicting local state reset, explicitly state that the view identity changes.
- Reusing the same view identity for a different item can preserve the old local state, rather than reset it. Never describe identity reuse as an identity change. For clarity explain that one mechanism without appending naming tasks.
- User defaults stores small nonsensitive preferences, not secrets or queryable relational records. Swift data and Core Data support model persistence; contexts can also be in-memory. A displayed edit is not a confirmed persistent save. Predict failure status only with a stated failed save and no later successful save; do not assume autosave is disabled or has completed.
- User defaults updates its cache immediately and writes disk asynchronously. Do not ask for checks proving its edit durably persisted from cached readback. Hard save confirmation questions use explicit persistent record save results, or explain the evidence limit.
- Camera or microphone permission requests and usage descriptions do not grant access. State denied or granted authorization when asking about protected access; denial alone does not establish a specific crash or launch result. No exact alert-count or Settings-path recall.
- Main actor isolation and asynchronous syntax do not automatically move blocking work off the main thread. Specify actual main thread blocking or an appropriate background execution context. Suspension can yield execution; it is not equivalent to blocking, guaranteed parallelism or a dedicated thread.
- Swift task cancellation is cooperative. It signals cancellation rather than forcibly killing arbitrary computation. Specify the task relationship and whether the operation checks cancellation or supports it. Do not treat every unstructured task as a structured child, or imply cancellation undoes a server write. Screen disappearance cancels only work linked to that lifetime under the stated mechanism.
- Call cooperative cancellation work a Swift task, not just a background task; operating system background expiration is a separate lifetime mechanism.
- Screen departure alone does not establish cancellation of an independent Swift task. State actual cancellation or an explicit view-linked lifetime. A cancellable operation can respond without a manually written check; never imply explicit polling is the only cooperation mechanism.
- Out-of-order requests need explicit current request identity before applying results. Main actor serialization alone does not guarantee latest-request results win across suspension. Cancellation alone does not prove an obsolete completion cannot publish; ask about identity checks or state supplied in the prompt.
- Strong references keep class instances alive. A stored closure strongly capturing its owning object can form a cycle. Weak references do not retain and become nil after deallocation. Checked unowned references require a valid lifetime and trap when accessing a deallocated target; exclude unsafe unowned variants. Do not claim ARC automatically breaks strong cycles or that every closure leaks.
- For every closure lifetime prediction explicitly name strong, weak or unowned capture and the closure owner. Saying only captures it leaves the lifetime outcome unspecified.
- Hard correctness ownership comparisons use weak versus checked unowned after target deallocation. Never assume a target is deallocated while a stored closure still strongly captures it, unless that capture is explicitly released first.
- Releasing one strong capture does not prove target deallocation while other strong owners may exist. For later weak versus checked unowned access, explicitly state that the target is deallocated; omit unnecessary earlier strong-capture setup.
- Background task scheduling is system controlled. An earliest start date is a lower bound, not an exact start promise or guaranteed launch. State specific unmet eligibility conditions when predicting a delay; do not infer a cause just because execution has not occurred. A foreground timer is not guaranteed to continue during suspension.
- Visual icon appearance does not prove an accessible action name or activation. Ask about screen reader evidence without supplying the requested name, role and action checks. Frame-time evidence can reveal stalls hidden by averages; do not promise a cause from aggregate measurements alone.`,
  difficultyAvoidLists: {
    easy: 'Keep familiar values, controls, navigation purposes, nonsensitive settings, protected access and simulator testing. No ownership cycles, main actor isolation, state identity, stale requests, persistence failures or task scheduling internals.',
    medium: 'Use one applied mechanism or precise comparison. No strong closure cycles, checked unowned lifetime hazards, structured task propagation, stale concurrent result races, background scheduler guarantees or view identity internals.',
    hard: 'Use one bounded advanced-junior lifetime, ordering, persistence or evidence task. Requesting three simple items alone does not make an introductory question hard. No whole-app architecture, exact concurrency annotations, operating-system internals or App Store policy quizzes.',
  },
  set1: { ...medium, difficultyTopics: { easy: focused(easy, 'easy'), medium: focused(medium, 'medium'), hard: focused(hard, 'hard') }, easyExamples: examples.easy, mediumExamples: examples.medium, hardExamples: examples.hard },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: applied(easy, ['apply familiar value meanings', 'choose a familiar interface control', 'apply a familiar destination change', 'choose nonsensitive preference storage', 'predict protected access under stated authorization', 'test one interface behavior on a simulator or device']),
      medium: applied(medium, ['apply supported observed state or bindings', 'reason about value copies and shared class references', 'handle a present or absent optional safely', 'keep blocking work away from input handling', 'choose queried record persistence versus small settings', 'apply a stated destination path change']),
      hard: applied(hard, ['reason about explicit closure ownership and deallocation', 'apply cooperative cancellation to stated task relationships', 'reject obsolete completions using current request identity', 'distinguish edited memory from a confirmed persistent save', 'evaluate deferred background eligibility without exact start promises', 'test identity-bound state or programmatic accessibility evidence']),
    },
    easyExamples: [
      'What does a Boolean value represent in Swift?',
      'Why is a simulator useful when testing a mobile app?',
      'How does a text label differ from an interactive button?',
      'Camera permission is denied; what happens to the app permitted camera access?',
      'Name two navigation test cases for a button that opens a details destination?',
      'An app should remember a nonsensitive theme preference after reopening; which local storage option fits?',
    ],
    mediumExamples: [
      'How does a binding let a child interface update existing Swift UI state?',
      'Why does checking an optional for nil help handle absent data safely?',
      'How does copying a structure with integer fields differ from copying a class reference?',
      'A blocking computation occupies the main thread; what happens to input handling until that thread is available?',
      'Name two navigation test cases for removing details from a path that starts with a list?',
      'An optional may be nil; what safe handling approach should use its value only when present?',
      'Related record queries become difficult in user defaults; what persistence requirement should you check first?',
      'Why would you prefer observable state over an ordinary unobserved variable for Swift UI content updates?',
    ],
    hardExamples: [
      'How does a stored closure strongly capturing its owner form a retain cycle?',
      'Why does an older request need a current request identity check before publishing its search result?',
      'How does cancellation of a task group differ from forcibly terminating a child computation that never checks cancellation?',
      'A persistent save fails and no later save succeeds; what outcome follows for confirmed storage of that edit?',
      'Name two background task tests for a request whose earliest start time has not arrived?',
      'A custom icon needs an accessible action name; what screen reader evidence should verify that requirement?',
      'A draft resets when the interface replaces its view identity; what state lifetime detail should you check first?',
      'Why would you prefer a weak closure capture over a checked unowned capture when the referenced owner may be deallocated first?',
    ],
  },
};
