// Original spoken practice; research and boundaries: docs/ui-ux-developer-interview.md.
function scope(entries) {
  return { topicScope: entries.map(([topic]) => topic), topicKeywords: entries.map(([, words]) => words) };
}
function applied(base, descriptions) {
  return { ...base, topicScope: base.topicScope.map((topic, i) => `${topic}: ${descriptions[i]}`) };
}
const easy = scope([
  ['User needs', ['user need', 'user goal', 'user experience', 'UX', 'UI']],
  ['Wireframes', ['wireframe', 'sketch']],
  ['Visual hierarchy', ['visual hierarchy', 'heading', 'emphasis']],
  ['Navigation', ['navigation', 'menu', 'link']],
  ['Form labels', ['label', 'form field', 'placeholder']],
  ['Accessibility basics', ['accessibility', 'color', 'text alternative']],
]);
const medium = scope([
  ['Usability tasks', ['usability', 'task', 'participant', 'moderator']],
  ['Information architecture', ['card sort', 'category', 'tree testing', 'information architecture']],
  ['Interactive prototypes', ['prototype', 'interaction', 'wireframe']],
  ['Form feedback', ['error', 'validation', 'message', 'form field']],
  ['Responsive layout', ['responsive', 'viewport', 'reflow', 'narrow screen']],
  ['Component states', ['component', 'button', 'disabled', 'loading']],
]);
const hard = scope([
  ['Research evidence', ['sample', 'research evidence', 'observation', 'participant']],
  ['Experiment validity', ['A B test', 'randomization', 'random assignment', 'conversion', 'experiment', 'prototype test']],
  ['Accessible focus', ['focus', 'modal', 'keyboard', 'dialog']],
  ['Design system consistency', ['design token', 'design system', 'color token', 'contrast', 'theme']],
  ['Error recovery', ['draft', 'recovery', 'retry', 'preserved', 'retained input']],
  ['Ethical interaction', ['consent', 'cancellation', 'deceptive', 'choice']],
]);
const easyExamples = {
  focus_clarity: [
    'What does a user goal describe in user experience design?',
    'What is a wireframe used for?',
    'What does visual hierarchy help a reader notice?',
    'What is a navigation menu used for?',
    'What is a visible form field label used for?',
    'What is a text alternative used for in accessibility?',
  ],
  focus_correctness: [
    'How does UI design differ from the broader user experience?',
    'How does a wireframe differ from a finished visual mockup?',
    'How does a heading differ from body text in visual hierarchy?',
    'How does a navigation link differ from a form submission button?',
    'How does a visible label differ from a disappearing placeholder?',
    'How does a text alternative differ from a decorative image caption?',
  ],
  focus_completeness: [
    'Name two ways to learn about a user need?',
    'Name two page elements commonly shown in a wireframe?',
    'Name two visual hierarchy cues for emphasizing a heading?',
    'Name two familiar navigation elements?',
    'Name two familiar form fields that need a label?',
    'Name two accessibility supports for someone who cannot distinguish colors?',
  ],
};
const mediumExamples = {
  focus_clarity: [
    'Why should a usability task avoid telling the participant which control to use?',
    'How does a card sort reveal expected content categories?',
    'How does an interactive prototype help explore a sequence before implementation?',
    'Why should a validation error message identify the affected form field?',
    'How does responsive reflow keep content readable in a narrow viewport?',
    'Why should a loading button communicate that its requested action is still pending?',
  ],
  focus_correctness: [
    'How does observing a usability task differ from asking whether a participant likes a page?',
    'How does card sorting differ from tree testing an existing category structure?',
    'How does an interactive prototype differ from a static wireframe when exploring a sequence?',
    'How does a validation error message differ from a successful submission message?',
    'A responsive layout stacks cards instead of clipping them in a narrow viewport; what happens to content visibility?',
    'A loading button blocks repeated submissions until completion; what happens to another press while pending?',
  ],
  focus_completeness: [
    'Name two observations to record while a participant attempts a usability task?',
    'Name two details to review when a card sort produces inconsistent categories?',
    'Name two interaction details to specify in a prototype handoff?',
    'Name two details that make a form validation error message actionable?',
    'Name two responsive layout checks at a narrow viewport?',
    'Name two component states to document for a submission button?',
  ],
};
const hardExamples = {
  focus_clarity: [
    'Why does a small convenience sample limit claims about all users?',
    'Why does randomization help an A B test compare conversion between designs?',
    'Why should keyboard focus return to an available modal trigger after the dialog closes?',
    'Why can changing a shared design token require checking contrast in multiple themes?',
    'Why should a failed save preserve a draft when recovery permits another attempt?',
    'Why does hiding cancellation behind misleading labels undermine an informed choice?',
  ],
  focus_correctness: [
    'How does a repeated observation in a small sample differ from a population prevalence estimate?',
    'How does a randomized A B test differ from comparing conversion before and after a seasonal promotion?',
    'A modal closes and its trigger still exists; which focus destination preserves the keyboard user previous context?',
    'How does a shared design token change differ from a local component override in its review scope?',
    'A save encounters a network error but the draft is preserved locally; what recovery remains possible?',
    'How does an explicit consent choice differ from preselecting optional consent without an affirmative action?',
  ],
  focus_completeness: [
    'Name three research evidence details needed before generalizing a usability observation?',
    'Name three experiment conditions to inspect before attributing a conversion difference to a design?',
    'Name three keyboard focus checks across opening and closing a modal?',
    'Name three design system checks after changing a shared color token across themes?',
    'Name three recovery checks for retrying a failed draft save?',
    'Name three consent interface details that support an informed choice?',
  ],
};
const focusDescriptions = {
  easy: {
    focus_clarity: ['explain a user goal', 'explain sketch purpose', 'explain visual emphasis', 'explain menu purpose', 'explain label purpose', 'explain an accessibility support'],
    focus_correctness: ['distinguish UI from broader UX', 'distinguish structure from polished appearance', 'distinguish heading and body roles', 'distinguish moving between pages and submitting data', 'distinguish persistent labels and placeholders', 'distinguish alternatives and visible captions'],
    focus_completeness: ['name two ways to learn needs', 'name two sketch elements', 'name two emphasis cues', 'name two navigation elements', 'name two labeled fields', 'name two supports beyond color'],
  },
  medium: {
    focus_clarity: ['explain neutral study tasks', 'explain grouping evidence', 'explain exploring linked screens', 'explain actionable field feedback', 'explain narrow-screen reflow', 'explain pending action feedback'],
    focus_correctness: ['compare behavior and preference evidence', 'compare grouping and findability studies', 'compare linked screens and static structure', 'compare invalid input and saved confirmation', 'predict visibility under stated reflow', 'predict repeated press handling under an explicit rule'],
    focus_completeness: ['name two observed task details', 'name two grouping study checks', 'name two handoff interaction details', 'name two actionable feedback details', 'name two narrow-screen checks', 'name two submission states'],
  },
  hard: {
    focus_clarity: ['explain sampling limits', 'explain randomized comparison', 'explain restored focus context', 'explain shared token review scope', 'explain retained input for recovery', 'explain informed cancellation'],
    focus_correctness: ['compare qualitative observations and prevalence', 'compare randomized and confounded comparisons', 'select focus return under an existing trigger', 'compare shared token and local override scope', 'predict recovery with retained unsaved input', 'compare explicit and preselected consent'],
    focus_completeness: ['name three evidence limitations to inspect', 'name three experimental validity conditions', 'name three modal focus checks', 'name three cross-theme token checks', 'name three retry recovery checks', 'name three informed consent details'],
  },
};
function focused(base, tier) {
  return { ...base, focusTopics: Object.fromEntries(Object.entries(focusDescriptions[tier]).map(([focus, descriptions]) => [focus, applied(base, descriptions)])) };
}
module.exports = {
  id: 'ui-ux-developer', label: 'UI/UX Developer',
  avoidList: `UI AND UX DEVELOPER SCOPE:
- Target students and graduates designing small websites or apps and handing interactions to developers. Use original spoken questions about needs, wireframes, prototypes, visual hierarchy, navigation, usability, accessibility and component states.
- This is verbal design reasoning, not a portfolio critique, drawing task or visual talent rating. Never require seeing an image, creating a Figma file, remembering tool shortcuts, writing code or prior commercial experience. Tool-neutral prototyping is preferred; Figma may be a familiar example, not required expertise.
- Accept multiple defensible approaches under the stated user need. Ask for a specific observable effect or evidence, not the prettiest layout, best color, universal design style or one mandatory design process.
- Set 1 clarity explains one purpose or mechanism, correctness compares or predicts one bounded behavior, and completeness names two distinct items in easy and medium or three in hard. Do not give those items in the premise.
- UI is interface presentation and interaction; UX is the broader experience of accomplishing a goal. Do not claim UI is only colors or UX excludes visual design.
- A wireframe sketches structure; a prototype explores behavior at varying fidelity. Neither proves final production behavior or accessibility. An interactive prototype need not have a functioning backend.
- Hierarchy uses relative emphasis, spacing and grouping, not universally larger or brighter controls. Navigation helps find destinations; labels communicate a control purpose. A placeholder alone is not a persistent visible label or necessarily an accessible name.
- Accessibility is not equivalent to usability, and automated checks do not prove full accessibility. Do not ask for exact WCAG criterion numbers, contrast arithmetic, legal compliance or claim one support works for everyone. Meaning must not rely only on color; useful text alternatives depend on image purpose and context, while purely decorative images may need empty alternatives.
- Usability studies observe realistic tasks with relevant participants. Neutral instructions do not disclose the control being tested. Preference, stated intention and successful task behavior are different evidence; leading questions and coaching can bias observations.
- Card sorting explores expected groupings; tree testing evaluates findability in a hierarchy. Neither alone proves the whole interface is usable. Personas must be grounded in evidence rather than stereotypes; avoid fixed participant counts that supposedly find every problem.
- Reflow adapts content to available space; no universal device breakpoint or blanket horizontal scrolling rule. Preserve reading order and controls. Error feedback names the affected field and a correction without blaming users; retain useful input where safe.
- Document interactive components across relevant idle, focus, loading, disabled, error and success states. State whether repeated actions are blocked before predicting duplicate submissions. Disabled controls are not always focusable; do not assume one keyboard behavior without naming the control type and rule.
- A small convenience sample can reveal problems but cannot establish population prevalence. Task observation alone does not prove the participant motive. Distinguish observed behavior, interpretation and proposed change.
- Random allocation helps compare variants but does not guarantee balanced groups or a valid result. Conversion changes may reflect seasonality, audience, instrumentation or concurrent changes. No sample-size arithmetic, significance calculation or claim that a small numerical lift automatically wins.
- Modal keyboard behavior requires focus entering the dialog, staying within it while open and returning to an available trigger or logical destination after close. State the trigger still exists when predicting return. Do not claim one focus target suits every dialog or ignore dismissal and visible focus.
- A shared design token may affect many components and themes. Check actual rendered combinations and states; sharing a token does not guarantee sufficient contrast or consistent behavior.
- Preserving a local draft supports retry but does not prove the server saved it. A retry may duplicate a server action when the previous response was lost; distinguish a known rejected save from an unknown result. Do not assume browser persistence, cross-device storage or guaranteed offline syncing.
- Consent must communicate the actual optional choice and consequences. Do not claim one interface proves legal compliance. Ask ethical reasoning about misleading labels and coercive cancellation, not optimization of deceptive patterns or collecting sensitive research data without informed participation.
- Use one clear short task, minimal necessary conditions and varied topics. Avoid repeating a label or color task with different app names. Handoff checks must concern observable interaction, states or acceptance behavior, not export settings.
- Never infer that a visible label vanishes because a placeholder vanishes. For a prediction, explicitly say there is a separate persistent label, or that the placeholder is the only visible field description. Otherwise ask a focused label comparison.
- Repeated-submission predictions must say all additional activations occur while the first request is still pending. Several quick presses alone do not establish completion timing.
- A large survey is not automatically representative or a measure of observed task success. Do not equate reported ease with actual success or generalize without recruitment and sampling evidence. Ask one evidence distinction with no invented numerical study sizes.
- Prefer direct How or Why tasks without invented teammates, office studies, discounts or multi-sentence histories. Use about 8 to 18 words in easy, 12 to 24 in medium, and 18 to 30 in hard. Do not add given or assuming after a completeness task. Ask checks from one category without listing the exact states or checks in the premise.
- A modal must restore focus according to an explicit intended focus policy; closing a buggy dialog does not automatically guarantee good focus behavior. Ask where focus should go or state the implemented return rule before predicting what happens.
- In every focus-return explanation or preference, say the original trigger still exists and is available. Never say focus must always return to a missing trigger. If it was removed, ask for a logical available destination without guessing one hidden replacement.
- Consent questions concern informed affirmative choice, not legal validity or compliance. Do not ask for both consent validity and a separate risk comparison. Use explicit choice, clear consequences and optional participation as the bounded concepts.
- A survey of reported ease does not measure observed task success, even with random recruitment. Ask the evidence distinction without implying either source proves actual success or exact prevalence.
- Describe color perception as cannot distinguish the warning color, not cannot see color. A blind user may also need programmatic access; visible text alone does not guarantee their access.
- Never predict successful recovery merely because a person retries after a network error. If predicting a retry result, explicitly state the server accepted or rejected the retry. Otherwise ask which confirmation to check or compare preserved input with confirmed saving. Prefer that bounded distinction over invented retry scenarios.
- Do not predict what people will choose because a button is faint or bright. Ask how equal discoverability supports an optional choice, or ask for a change that makes declining easy to find; actual behavior requires observed evidence.
- Hard stays bounded advanced-junior reasoning. Exclude full product strategy, entire redesigns, senior design operations, research methodology lectures and backend implementation architecture. Set 3 stays shared behavioral practice.`,
  difficultyAvoidLists: {
    easy: 'One introductory fact, purpose, distinction or direct action. No experiment validity, sampling inference, modal focus lifecycle, cross-theme token analysis or multi-step research diagnosis.',
    medium: 'One applied mechanism, comparison, outcome or focused check with at most two connected reasoning steps. No statistical inference, causal experiment claims, modal focus lifecycle or senior strategy.',
    hard: 'One bounded evidence limit, conditional behavior or justified choice with at most three reasoning steps. State relevant sampling, assignment, focus and save conditions. No statistics calculations or entire design plans.',
  },
  set1: { ...medium, difficultyTopics: { easy: focused(easy, 'easy'), medium: focused(medium, 'medium'), hard: focused(hard, 'hard') }, easyExamples, mediumExamples, hardExamples },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: applied(easy, ['identify a familiar goal or need', 'use a structural sketch', 'apply relative visual emphasis', 'select a destination control', 'check a persistent input label', 'communicate meaning beyond color']),
      medium: applied(medium, ['observe neutral task attempts', 'choose grouping or findability evidence', 'explore and hand off linked interactions', 'provide actionable field feedback', 'check readable narrow-screen content', 'document action states under a stated rule']),
      hard: applied(hard, ['qualify conclusions from observed evidence', 'check causal limits in design experiments', 'verify modal focus under stated lifecycle conditions', 'review shared tokens across themes and states', 'support retry while distinguishing retained input from confirmed saving', 'evaluate clear optional consent and cancellation choices']),
    },
    easyExamples: [
      'What does a wireframe show about a page?',
      'Why does a navigation menu use meaningful destination names?',
      'How does a persistent form label differ from placeholder text?',
      'A heading gains visual emphasis relative to body text; what happens to its visual hierarchy?',
      'Name two checks for accessibility when a warning is communicated only by color?',
      'A student needs to learn a user goal; which research activity could help?',
    ],
    mediumExamples: [
      'How does a card sort help organize content into expected categories?',
      'Why should a usability moderator avoid coaching a participant toward the intended control?',
      'How does an interactive prototype differ from a static wireframe for exploring linked screens?',
      'A responsive layout wraps cards instead of clipping them in a narrow viewport; what happens to content visibility?',
      'Name two test cases for a form validation message on a required field?',
      'A component must prevent repeated submissions while pending; what button state should communicate that wait?',
      'Participants cannot locate content in an existing category hierarchy; what information architecture method should you check first?',
      'Why would you prefer neutral usability task wording over naming the control when measuring unaided discovery?',
    ],
    hardExamples: [
      'How does a convenience sample limit the conclusions supported by research evidence?',
      'Why does randomization reduce systematic audience differences between variants in an A B test?',
      'How does a shared design token change differ from a local override in cross-theme review scope?',
      'A failed save leaves the unsaved draft preserved locally; what happens to the ability to retry those edits?',
      'Name two keyboard focus checks for closing a modal whose trigger still exists?',
      'Optional consent must require an affirmative choice; what default should avoid assuming that choice?',
      'Conversion rises after a redesign and a simultaneous promotion; what experiment condition should you check first before attributing causation?',
      'Why would you prefer observing task attempts over relying only on participant preference when investigating a usability barrier?',
    ],
  },
};
