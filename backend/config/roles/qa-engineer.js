// Original spoken interview content. Role reference: https://roadmap.sh/qa
// Topic calibration: ISTQB CTFL v4.0.1; see docs/qa-engineer-interview.md.
// All tiers assume academic or personal-project experience, never employment.
function scope(entries) {
  return { topicScope: entries.map(([topic]) => topic), topicKeywords: entries.map(([, keywords]) => keywords) };
}

const easy = scope([
  ['Requirements: the purpose of a stated requirement and expected application behavior', ['requirement', 'expected behavior']],
  ['Test cases: the purpose of a test case, expected result, actual result, and a pass or fail result', ['test case', 'expected result', 'actual result']],
  ['Input checks: required fields, empty inputs, and familiar valid or invalid input examples', ['input', 'required', 'empty', 'email']],
  ['Defect reports: recording an observed problem clearly with a screenshot and enough information to repeat it', ['defect report', 'screenshot', 'observed problem']],
  ['Retesting: checking a reported problem after a fix and checking familiar behavior after a change', ['retesting', 'fix', 'regression', 'change']],
  ['Test environments: checking the same simple behavior on named browsers or devices and recording the version used', ['environment', 'browser', 'device', 'version']],
]);
const easyLists = scope([
  ['Requirement details: naming two details that make a familiar requirement checkable', easy.topicKeywords[0]],
  ['Test case details: naming two pieces of information recorded in a simple test case', easy.topicKeywords[1]],
  ['Required input examples: naming two inputs for a field explicitly requiring an email address', easy.topicKeywords[2]],
  ['Defect report details: naming two useful details describing an observed problem', easy.topicKeywords[3]],
  ['Retesting checks: naming two familiar behaviors to check after a registration form change', easy.topicKeywords[4]],
  ['Environment details: naming two details identifying where a simple check was performed', easy.topicKeywords[5]],
]);
const medium = scope([
  ['Acceptance coverage: connecting acceptance criteria to specific checks and expected results', ['acceptance', 'requirement', 'coverage']],
  ['Test data: boundary values and representative valid or invalid groups for an explicitly stated range', ['boundary', 'partition', 'age', 'range']],
  ['Defect evidence: reproducible conditions, observed versus expected behavior, severity versus priority', ['defect', 'reproduce', 'severity', 'priority']],
  ['Regression selection: confirmation of a fix versus checking related unchanged behavior after a change', ['regression', 'confirmation', 'fix']],
  ['Test isolation: controlled starting state, independent records, and keeping one check from changing another', ['isolation', 'starting state', 'shared record', 'independent']],
  ['Automation basics: suitable repeatable checks, clear assertions, and waiting for an observable result; no tool syntax', ['automation', 'assertion', 'automated', 'waiting']],
]);
const mediumLists = scope([
  ['Acceptance evidence: naming two distinct pieces of evidence linking checks to acceptance criteria', medium.topicKeywords[0]],
  ['Boundary inputs: naming two inputs at a stated boundary without listing every possible partition', medium.topicKeywords[1]],
  ['Defect reproduction details: naming two useful details for repeating an observed failure', medium.topicKeywords[2]],
  ['Regression behaviors: naming two related behaviors worth checking after a stated change', medium.topicKeywords[3]],
  ['Isolation safeguards: naming two ways to keep checks from changing each other through shared records', medium.topicKeywords[4]],
  ['Automation assertion details: naming two observations an automated check could verify for one stated action', medium.topicKeywords[5]],
]);
const hard = scope([
  ['Risk coverage: prioritizing checks by likelihood and impact and explaining why passing checks cannot prove absence of defects', ['risk', 'coverage', 'likelihood', 'impact']],
  ['Boundary combinations: using partitions and boundary values while considering one explicitly stated interaction between conditions', ['boundary', 'partition', 'combination']],
  ['State transitions: checking permitted and rejected transitions with explicit starting state, event, and rules', ['state', 'transition', 'locked', 'attempt']],
  ['Reliable automation: observable waits, stable assertions, independent data, and intermittent failures; no tool APIs', ['automation', 'assertion', 'wait', 'intermittent']],
  ['Integration contracts: checking agreed response fields and error behavior between components, including test-double limitations', ['integration', 'contract', 'response field', 'test double']],
  ['Failure evidence: separating an application regression from changed test data or environment with controlled comparisons', ['evidence', 'environment', 'data', 'reproduce']],
]);
const hardLists = scope([
  ['Risk prioritization factors: naming three distinct factors for ordering checks when verification time is limited', hard.topicKeywords[0]],
  ['Boundary and partition inputs: naming three representative inputs for a stated inclusive numeric range', hard.topicKeywords[1]],
  ['State transition evidence: naming three details needed to reproduce a rejected transition', hard.topicKeywords[2]],
  ['Automation reliability safeguards: naming three safeguards for independent observable automated checks', hard.topicKeywords[3]],
  ['Integration contract checks: naming three distinct aspects of an agreed component response to verify', hard.topicKeywords[4]],
  ['Failure evidence details: naming three controlled details to record when an intermittent failure occurs', hard.topicKeywords[5]],
]);

const easyExamples = {
  focus_clarity: [
    'What is a requirement used for when checking an application?',
    'What is the purpose of an expected result in a test case?',
    'Why should a required email input be checked when it is empty?',
    'What is a defect report used for?',
    'What is the purpose of retesting after a fix?',
    'Why should a tester record the browser used for a check?',
  ],
  focus_correctness: [
    'How does expected behavior differ from observed behavior when checking a requirement?',
    'How does an expected result differ from an actual result in a test case?',
    'What should happen when a required email input is left empty?',
    'Which part of a defect report describes what the tester actually observed?',
    'When should a reported problem be retested after a fix?',
    'Which environment detail identifies the browser release used for a check?',
  ],
  focus_completeness: [
    'Name two details that make a registration requirement clear enough to check?',
    'Name two details recorded in a simple test case?',
    'Name two input examples for a field that requires an email address?',
    'Name two useful details in a defect report?',
    'Name two registration behaviors to check after a form change?',
    'Name two environment details to record when checking an application?',
  ],
};
const mediumExamples = {
  focus_clarity: [
    'How do acceptance criteria help a tester decide whether a feature meets its requirement?',
    'Why can testing a boundary value reveal behavior missed by an input from the middle of a range?',
    'Why do reproducible conditions make a defect easier to investigate?',
    'Why does regression testing check related behavior after a fix?',
    'How does a known starting state help keep a check independent?',
    'How does an assertion show whether an automated check met its expected result?',
  ],
  focus_correctness: [
    'An acceptance criterion requires a confirmation message after saving; what result must the check verify?',
    'An age range includes eighteen through sixty; what should happen to an input of seventeen?',
    'How does the severity of a defect differ from its priority?',
    'How does confirmation testing differ from regression testing after a fix?',
    'Two checks edit a shared record; what can happen if one depends on the result of the other?',
    'What should an automated check wait for before asserting that a confirmation message is visible?',
  ],
  focus_completeness: [
    'Name two details linking an acceptance criterion to its verification evidence?',
    'Name two boundary inputs around a minimum accepted age of eighteen?',
    'Name two details needed to reproduce a defect observed in a registration form?',
    'Name two regression behaviors to check after changing password reset?',
    'Name two safeguards for checks that otherwise edit a shared record?',
    'Name two observations an automated assertion could verify after submitting a valid registration?',
  ],
};
const hardExamples = {
  focus_clarity: [
    'Why does prioritizing checks by likelihood and impact reduce release risk without proving that every defect is absent?',
    'How does combining boundary values with an interacting eligibility condition reveal faults that testing each condition alone can miss?',
    'How does checking a rejected state transition reveal whether an application enforces its rules rather than only displaying a warning?',
    'Why does waiting for an observable completion condition make automation more reliable than waiting a fixed amount of time?',
    'How does an integration contract check reveal mismatched response fields that a separately maintained test double can hide?',
    'How does reproducing a failure with controlled data and environment provide evidence about whether an application change caused it?',
  ],
  focus_correctness: [
    'How does high-impact risk with low likelihood differ from low-impact risk with high likelihood when prioritizing checks?',
    'A discount requires membership and an age of at least eighteen; what outcome should a boundary input of eighteen produce for a nonmember?',
    'A locked account rejects sign-in until reset; what state should remain after another rejected sign-in attempt before reset?',
    'How does automation waiting for a saved confirmation differ from waiting a fixed interval when response times vary?',
    'How does an integration check against a real component differ from checking only a test double when response fields change?',
    'The same failure occurs on old and new builds with identical data and environment; what evidence is missing before calling it a new regression?',
  ],
  focus_completeness: [
    'Name three risk factors that can influence which checks run first before a release?',
    'Name three partition inputs representing below, within, and above an inclusive age range from eighteen to sixty?',
    'Name three state transition details to record when an account rejects a sign-in attempt?',
    'Name three automation safeguards for keeping repeated checks independent and reliable?',
    'Name three integration contract aspects to verify in a component response?',
    'Name three evidence details to record when reproducing an intermittent failure in a controlled environment?',
  ],
};

const easyTechnicalExamples = [
  'What does a requirement describe about expected application behavior?',
  'Why is an expected result useful in a test case?',
  'How does a valid input differ from an invalid input for a required email?',
  'A defect report records the observed problem incorrectly; what happens to the information available to the person reading it?',
  'Name two checks for a registration form after a change?',
  'A check must run in two named browsers; what environment detail should the tester record for each run?',
];
const mediumTechnicalExamples = [
  'How do acceptance criteria connect a requirement to a checkable result?',
  'Why should boundary inputs be checked near the ends of an accepted range?',
  'How does defect severity differ from the order in which the team plans to address it?',
  'A fixed behavior passes confirmation testing but a related behavior is untested; what outcome remains unknown?',
  'Name two checks for isolation when two test cases otherwise edit a shared record?',
  'An automated check needs a saved confirmation before continuing; what should it wait for?',
  'A defect report cannot be reproduced on the same build; what conditions should you check first?',
  'Why would you prefer a small focused regression check over rerunning unrelated checks after a narrowly scoped change?',
];
const hardTechnicalExamples = [
  'How does risk-based coverage reduce expected harm when the available testing time cannot cover every behavior?',
  'Why should integration checks verify the real response contract when a test double can pass despite a changed component?',
  'How does checking interacting boundary conditions differ from checking each input independently when eligibility requires both conditions?',
  'An account locks after three rejected sign-in attempts, and an earlier successful attempt returns after locking; only reset permits unlocking; what happens to the account state?',
  'Name two checks for preventing stale failure evidence when comparing old and new builds under controlled conditions?',
  'An operation must reject a transition from a locked state without modifying stored details; what observation should verify that rejection?',
  'Automation passes locally but intermittently observes an old confirmation on a slower machine; what synchronization condition should you check first?',
  'Why would you prefer covering a likely high-impact failure over adding another check for a low-impact behavior already well covered?',
];

function technicalScope(base, descriptions) {
  return { ...base, topicScope: base.topicScope.map((topic, index) => `${topic.split(':')[0]}: ${descriptions[index]}`) };
}

module.exports = {
  id: 'qa-engineer',
  label: 'QA Engineer',
  avoidList: `QA-SPECIFIC LIMITS:
- Assess test reasoning, expected behavior, evidence, and verification; do not ask the candidate to implement application code or fix the application.
- No test-tool command, framework API, selector syntax, certification trivia, employer process, or mandatory commercial experience.
- Supply all acceptance rules, boundaries, starting states, and observations that determine the answer. Passing checks never prove absence of defects.
- Do not imply severity always determines priority, every failure is an application defect, or retrying a check proves reliability.`,
  difficultyAvoidLists: {
    easy: 'Use familiar manual checks, stated requirements, test cases, required inputs, defect reports, retesting, and named environments. No root-cause diagnosis, automation, partition terminology, risk calculations, or interacting state rules. Describe an observed problem without asking for a fix.',
    medium: 'Use one applied test decision with at most two reasoning steps. No framework internals, enterprise strategy, complex concurrency, complete testing plans, or exhaustive decision tables.',
    hard: 'Keep advanced-junior reasoning bounded to one risk, interaction, transition, assertion, contract, or evidence comparison. No senior release ownership, organization-wide strategy, exploit development, or load-tool implementation.',
  },
  set1: {
    ...medium,
    difficultyTopics: {
      easy: { ...easy, focusTopics: { focus_completeness: easyLists } },
      medium: { ...medium, focusTopics: { focus_completeness: mediumLists } },
      hard: { ...hard, focusTopics: { focus_completeness: hardLists } },
    },
    easyExamples, mediumExamples, hardExamples,
  },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: technicalScope(easy, [
        'explain one stated requirement or choose what to observe for a familiar behavior',
        'distinguish actual from expected results, predict a pass result under stated conditions, or choose a useful case detail',
        'choose or check familiar valid and invalid inputs for a required field, without diagnosis',
        'explain the purpose of an observation or choose evidence for a simple report; do not diagnose or fix the application',
        'predict the information gained by retesting a fixed behavior or choose a related simple check after a change',
        'choose a named browser or device check and record the environment used',
      ]),
      medium: technicalScope(medium, [
        'apply a stated acceptance criterion and identify an observable verification result',
        'select boundary or partition inputs for a stated range and predict the stated acceptance outcome',
        'compare severity and priority or identify missing reproduction evidence from a short report',
        'select confirmation or related regression checks after a stated fix',
        'diagnose one shared starting-state dependency and select an independence safeguard',
        'choose repeatable checks, assert an observable result, or diagnose a missing observable wait without tool syntax',
      ]),
      hard: technicalScope(hard, [
        'justify one coverage priority using stated likelihood, impact, and limited verification time',
        'reason about boundary partitions with one stated interacting rule, without exhaustive test design',
        'predict or verify permitted and rejected transitions under explicit event and starting-state rules',
        'explain an observable synchronization safeguard or diagnose one intermittent automation symptom',
        'reason about real versus simulated component contracts and identify a bounded verification safeguard',
        'compare controlled builds, data, and environment to justify or limit one conclusion about a failure',
      ]),
    },
    easyExamples: easyTechnicalExamples,
    mediumExamples: mediumTechnicalExamples,
    hardExamples: hardTechnicalExamples,
  },
};
