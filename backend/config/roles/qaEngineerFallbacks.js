// Original reviewed recovery questions, separate from Set 2 prompt calibration.
// Prefixes must match qa-engineer.js. No questions are shared with other roles.
const easy = [
  ['Requirements', 'What is expected behavior in an application requirement?'],
  ['Requirements', 'Why should a requirement describe something the tester can observe?'],
  ['Test cases', 'How does a passed test case differ from one with an unexpected actual result?'],
  ['Test cases', 'Name two checks for whether a test case records its result clearly?'],
  ['Input checks', 'A required email input is empty and the rule rejects empty entries; what happens to the submission?'],
  ['Input checks', 'A form requires an email input; what should the tester try to check that an empty entry is rejected?'],
  ['Defect reports', 'What is a screenshot used for in a defect report?'],
  ['Defect reports', 'How does the observed problem differ from the expected behavior recorded in a defect report?'],
  ['Retesting', 'Why should a reported problem be retested after its fix is available?'],
  ['Retesting', 'A fix is installed but its affected behavior has not been retested; what outcome remains unconfirmed?'],
  ['Test environments', 'Name two checks for whether the browser environment matches the one requested for testing?'],
  ['Test environments', 'A check was requested on a phone and a laptop; which device environments should the tester use?'],
];
const medium = [
  ['Acceptance coverage', 'How does linking a check to acceptance criteria make its expected result clear?'],
  ['Acceptance coverage', 'An acceptance criterion requires a saved confirmation message; what observation should verify that requirement?'],
  ['Test data', 'Name two boundary test cases around an inclusive minimum age of eighteen?'],
  ['Test data', 'An inclusive age range runs from eighteen to sixty; what happens to acceptance when the input is sixty-one?'],
  ['Defect evidence', 'A defect occurs only with a previously registered email; what reproduction condition should you check first?'],
  ['Defect evidence', 'How does defect severity differ from priority when a low-impact issue must be addressed before a demonstration?'],
  ['Regression selection', 'Why should regression checks cover behavior related to a changed password reset feature?'],
  ['Regression selection', 'Why would you prefer confirmation testing before calling a reported defect fixed?'],
  ['Test isolation', 'How does restoring a known starting state keep a check independent of earlier changes?'],
  ['Test isolation', 'A check passes alone but observes a missing shared record after another check; what isolation condition should you check first?'],
  ['Automation basics', 'How does an automated assertion differ from simply performing the action being checked?'],
  ['Automation basics', 'Name two checks for whether an automated registration check observes the requested saved result?'],
];
const hard = [
  ['Risk coverage', 'How does weighting coverage by likelihood and impact make a limited set of checks more useful for reducing release risk?'],
  ['Risk coverage', 'Why would you prefer testing a high-impact risk with little coverage over repeating a low-impact check when verification time is limited?'],
  ['Boundary combinations', 'How does checking an age boundary for members and nonmembers differ from checking age alone when a discount requires membership?'],
  ['Boundary combinations', 'Name two boundary test cases distinguishing membership eligibility at the inclusive minimum discount age of eighteen?'],
  ['State transitions', 'A delayed approval arrives after a request is cancelled, and cancelled requests cannot reopen; what happens to the request state?'],
  ['State transitions', 'A rejected state transition must leave the saved account unchanged; what observation should verify that requirement?'],
  ['Reliable automation', 'Automation intermittently reads an earlier message while a save is still pending; what observable wait condition should you check first?'],
  ['Reliable automation', 'How does waiting for the current operation to complete prevent automation from accepting a confirmation left by an earlier operation?'],
  ['Integration contracts', 'Why should an integration contract check verify the real response against agreed fields when a test double uses an outdated response?'],
  ['Integration contracts', 'How does verifying an integration contract against the real provider differ from verifying only a test double after the provider changes?'],
  ['Failure evidence', 'Name two checks for separating a new application failure from an environment difference when comparing builds?'],
  ['Failure evidence', 'A failure reproduces on both builds with identical input data but different environments; what evidence should you check first before blaming a code change?'],
  ['Failure evidence', 'Why would you prefer comparing builds with controlled data and environment over attributing a failure to the newest build from one observation?'],
  ['Failure evidence', 'A failure appears only with a changed environment; what controlled comparison should gather evidence before attributing it to an application regression?'],
];

module.exports = { easy, medium, hard };
