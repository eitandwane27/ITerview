// Original spoken questions informed by roadmap.sh, ISC2, CISA, NIST,
// OWASP and LetsDefend. Source mapping: docs/cybersecurity-interview.md.
function scope(entries) {
  return { topicScope: entries.map(([topic]) => topic), topicKeywords: entries.map(([, keywords]) => keywords) };
}
const easy = scope([
  ['Security principles: confidentiality, integrity, availability and familiar protective controls', ['confidentiality', 'integrity', 'availability', 'security goal']],
  ['Identity basics: authentication, authorization, passwords and separate authentication factors', ['authentication', 'authorization', 'password', 'factor']],
  ['Phishing awareness: suspicious messages, trusted verification and reporting without opening attachments', ['phishing', 'suspicious message', 'attachment', 'sender']],
  ['Network basics: the purpose of a firewall, encrypted web connections and familiar network traffic', ['firewall', 'network', 'HTTPS', 'web connection']],
  ['Data protection: backups, encryption and handling private information', ['backup', 'encryption', 'private information', 'data protection']],
  ['Device hygiene: security updates, screen locking and account permissions', ['update', 'screen lock', 'device', 'permission']],
]);
const medium = scope([
  ['Access controls: least privilege, independent authentication factors and account access reviews', ['privilege', 'factor', 'access review', 'permission']],
  ['Web protection: server authorization and treating untrusted input as data', ['authorization', 'untrusted', 'input', 'web']],
  ['Alert triage: authentication logs, false positives and contextual evidence', ['alert', 'log', 'false positive', 'sign-in']],
  ['Vulnerability management: vulnerabilities, threats, exposure and verifying security updates', ['vulnerability', 'threat', 'exposure', 'update']],
  ['Cryptographic purposes: hashing versus encryption, integrity evidence and trusted comparisons', ['hash', 'encryption', 'integrity', 'digest']],
  ['Incident handling: evidence preservation, reporting, authorized containment and recovery checks', ['incident', 'evidence', 'containment', 'recovery']],
]);
const hard = scope([
  ['Authorization lifecycle: cached permissions, session revocation and explicit access enforcement rules', ['authorization', 'permission', 'session', 'revocation']],
  ['Alert correlation: time alignment, source attribution and limits of conclusions from logs', ['alert', 'log', 'timestamp', 'correlation']],
  ['Risk prioritization: exploitability, exposure, impact and bounded mitigation trade-offs', ['risk', 'exposure', 'impact', 'vulnerability']],
  ['Containment trade-offs: authorized isolation, volatile evidence and service dependencies', ['containment', 'isolation', 'evidence', 'dependency']],
  ['Trust boundaries: network segmentation, authenticated encryption and independent security controls', ['trust', 'segmentation', 'encryption', 'control']],
  ['Recovery assurance: trusted integrity evidence, independent backups and verifying restored access', ['recovery', 'backup', 'digest', 'restored']],
]);
function listScope(base, descriptions) {
  return { ...base, topicScope: base.topicScope.map((topic, i) => `${topic.split(':')[0]}: ${descriptions[i]}`) };
}
const easyExamples = {
  focus_clarity: [
    'What does confidentiality protect in a student record?',
    'What is authentication used for during sign-in?',
    'What is phishing intended to trick a message recipient into doing?',
    'What is a firewall used for on a network?',
    'What is a backup used for after a file is lost?',
    'Why are security updates useful for a device?',
  ],
  focus_correctness: [
    'Which security goal protects information from unauthorized changes?',
    'How does authentication differ from authorization?',
    'What should a student avoid opening in a suspicious message?',
    'What does an HTTPS web connection protect while information travels?',
    'How does encryption differ from keeping a backup?',
    'Which device control prevents someone from using an unattended signed-in screen?',
  ],
  focus_completeness: [
    'Name two security goals for protecting student records?',
    'Name two distinct authentication factor categories?',
    'Name two warning signs of a phishing message?',
    'Name two details describing network traffic in a firewall record?',
    'Name two data protection measures for private files?',
    'Name two device hygiene measures for a student laptop?',
  ],
};
const mediumExamples = {
  focus_clarity: [
    'Why does least privilege reduce the harm from a compromised account?',
    'Why should a server enforce authorization instead of trusting a hidden page button?',
    'How does contextual log evidence help an analyst assess a security alert?',
    'Why does exposure matter when prioritizing a known vulnerability?',
    'How does checking a file hash against a trusted reference reveal a changed file?',
    'Why should incident evidence be preserved before routine cleanup?',
  ],
  focus_correctness: [
    'How does using a password and a security key differ from using two passwords as authentication factors?',
    'A signed-in user may read only their own record; what should server authorization do for a private record belonging to another student?',
    'How does a false positive security alert differ from a confirmed malicious event?',
    'How does a vulnerability differ from a threat that could exploit it?',
    'How does hashing differ from reversible encryption?',
    'How does incident containment differ from restoring normal service during recovery?',
  ],
  focus_completeness: [
    'Name two account details to examine during an access review?',
    'Name two authorization checks for a private student record?',
    'Name two log details useful when reviewing a suspicious sign-in alert?',
    'Name two exposure details useful when prioritizing a vulnerability?',
    'Name two conditions needed for a meaningful file hash comparison?',
    'Name two evidence details to record when reporting a suspected incident?',
  ],
};
const hardExamples = {
  focus_clarity: [
    'Why can cached authorization permissions leave a removed privilege usable until the server checks current access?',
    'How does aligning log timestamps improve correlation of events recorded by devices with different clock offsets?',
    'Why can an exposed vulnerability with observed exploitation deserve priority over a higher-rated isolated vulnerability?',
    'Why does authorized network isolation sometimes preserve more volatile incident evidence than powering off a compromised device?',
    'How does network segmentation limit movement between trust zones when each crossing enforces an explicit access rule?',
    'Why does comparing a restored file with an independently trusted digest provide stronger recovery evidence than trusting a digest stored beside it?',
  ],
  focus_correctness: [
    'A session caches permission for an hour and the server never rechecks it; what access remains immediately after that permission is removed?',
    'Two log sources use clocks ten minutes apart; what conclusion about event order remains unsupported before timestamp alignment?',
    'How does a vulnerability severity rating differ from risk that includes exposure and asset impact?',
    'How does network isolation differ from powering off a device when incident evidence exists only in memory?',
    'How does encryption at a trust boundary differ from authorization when a signed-in user requests a private record belonging to another person?',
    'A file and its adjacent digest can both be altered by the same account; what integrity conclusion remains unsupported when those values match?',
  ],
  focus_completeness: [
    'Name three authorization conditions to verify after revoking a student account privilege?',
    'Name three log context details needed before correlating sign-in events from separate devices?',
    'Name three risk factors for prioritizing an exposed vulnerability?',
    'Name three incident factors to consider before authorized isolation of a shared application host?',
    'Name three independent security controls for protecting access across a network trust boundary?',
    'Name three recovery checks before returning a restored student service to normal use?',
  ],
};
module.exports = {
  id: 'cyber-security',
  label: 'Cybersecurity',
  avoidList: `CYBERSECURITY SCOPE:
- Use original student, lab or hypothetical defensive situations; no mandatory commercial experience, certification trivia, tool commands, exploit payloads or malware implementation.
- Assess principles, evidence, defensive controls and authorized decisions. Supply the access rule, observation, permission or dependency that determines a scenario answer.
- Never imply that HTTPS grants authorization, encryption provides backups, a hash proves authenticity without a trusted reference, every alert proves compromise, or resetting a password necessarily revokes every session.
- Separate known observations from hypotheses. A single failed sign-in or a foreign source address cannot establish compromise. Clock alignment supports event ordering, not proof of source identity.
- Do not assume an administrator permission is unnecessary unless the required tasks are stated. A vulnerability can exist without reachable exposure; specify the network access path before asking an exposure decision.
- Revoking a server-enforced session prevents that session from granting access. Ask about delayed revocation only when the premise explicitly says the server continues accepting cached permissions without checking current access or revocation. Never claim a revoked session still grants access merely because the browser has a cache.
- Encrypted transport does not enforce record authorization, but do not assert that unauthenticated access succeeds merely because transport encryption is present; explicitly state the missing or ineffective access check.
- For private-record access questions, prefer a signed-in user requesting a forbidden record under an explicit ownership rule. If using an unauthenticated visitor, explicitly state whether identity verification is absent or bypassed as well as whether record permission checks are absent.
- In Set 1 correctness, request one accurate outcome or a focused comparison. Avoid yes-or-no questions and open-ended reasons or extra-context lists; reserve mechanism explanations for clarity and item lists for completeness.
- Keep scenario context short and necessary. For containment, state authorization and affected service dependencies before treating one action as mandatory; preserve evidence according to the stated playbook rather than claiming one action is always best.
- Do not require an entire investigation, organization-wide strategy, legal advice, cryptographic mathematics or a complete penetration test.`,
  difficultyAvoidLists: {
    easy: 'Use familiar purposes, simple distinctions and one-step protective choices. No investigation, diagnosis, attack chains, cryptographic internals, log correlation or incident prioritization.',
    medium: 'Use one applied control or evidence decision with at most two reasoning steps. No protocol internals, token signature details, advanced forensics, exploit development or enterprise incident ownership.',
    hard: 'Use one bounded advanced-junior mechanism, trade-off, evidence limitation or conditional outcome. State clock offsets, cached-access rules, trusted references and service dependencies when relevant; no senior architecture or full incident plans.',
  },
  set1: {
    ...medium,
    difficultyTopics: {
      easy: { ...easy, focusTopics: { focus_completeness: listScope(easy, [
        'name two familiar security goals', 'name two independent factor categories', 'name two suspicious message warning signs',
        'name two familiar traffic record details', 'name two private-file protective measures', 'name two device hygiene measures',
      ]) } },
      medium: { ...medium, focusTopics: { focus_completeness: listScope(medium, [
        'name two account access review details', 'name two private-record authorization checks', 'name two contextual sign-in log details',
        'name two vulnerability exposure details', 'name two conditions for trusted hash comparison', 'name two incident reporting evidence details',
      ]) } },
      hard: { ...hard, focusTopics: { focus_completeness: listScope(hard, [
        'name three revoked-permission verification conditions', 'name three contextual log correlation details', 'name three vulnerability risk factors',
        'name three factors for an authorized containment decision', 'name three independent trust-boundary protections', 'name three restored-service recovery checks',
      ]) } },
    },
    easyExamples, mediumExamples, hardExamples,
  },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: listScope(easy, [
        'explain a familiar goal or select a protective action for a stated classroom situation',
        'distinguish identity verification from permissions or select independent factor categories',
        'recognize suspicious messages and choose a trusted reporting or verification action',
        'predict traffic allowed or blocked by an explicit firewall rule or explain encrypted transport',
        'choose a backup or encryption for a stated need and check familiar private-file protection',
        'choose an approved security update or screen-lock action for a familiar device',
      ]),
      medium: listScope(medium, [
        'apply least privilege, compare independent factors or identify unnecessary permissions',
        'apply server authorization to a stated ownership rule or treat untrusted input as data',
        'distinguish an alert from confirmed harm and select contextual sign-in log evidence',
        'assess a stated exposure or verify installation of an update addressing a known vulnerability',
        'compare hashing with encryption or check the trust and consistency of a reference digest',
        'select preserved reporting evidence or one authorized containment and recovery action',
      ]),
      hard: listScope(hard, [
        'predict cached authorization outcomes or select a current-access verification safeguard after revocation',
        'align stated log clock offsets or limit one attribution conclusion using source context',
        'justify a bounded priority using stated exploitation, exposure and asset impact',
        'choose approved isolation while reasoning about stated volatile evidence and service dependencies',
        'verify one network trust boundary or distinguish encrypted transport from access enforcement',
        'check restored integrity against an independently trusted reference or verify recovery access controls',
      ]),
    },
    easyExamples: [
      'What does integrity protect in a saved student record?',
      'Why should a student keep their password private?',
      'How does a phishing message differ from a verified message from the school?',
      'A firewall rule blocks incoming connections to a lab computer; what happens to an incoming connection covered by that rule?',
      'Name two checks for whether a backup contains the intended private files?',
      'A student leaves a signed-in device unattended; what protective action should they take?',
    ],
    mediumExamples: [
      'How does a least-privilege access review reduce unnecessary account permissions?',
      'Why should web authorization be enforced by the server for every private-record request?',
      'How does a suspicious sign-in alert differ from confirmed account compromise?',
      'A security update closes a stated vulnerability on an exposed device; what happens to that particular exposure after installation is verified?',
      'Name two checks for whether a file hash comparison uses a trusted reference?',
      'An incident report needs preserved evidence; what should an authorized analyst record before routine cleanup?',
      'An alert flags a scheduled school sign-in exercise as suspicious; what log context should you check first?',
      'Why would you prefer removing unnecessary account permissions over giving every student administrator access?',
    ],
    hardExamples: [
      'How does checking current authorization on each private-record request prevent a cached permission from surviving revocation?',
      'Why does aligning known log clock offsets help distinguish event order from recording-time differences?',
      'How does vulnerability severity differ from risk when an affected service is isolated from untrusted connections?',
      'A revoked permission remains cached in a session and the server never rechecks access; what happens to permitted requests until the cache expires?',
      'Name two checks for whether network segmentation enforces a stated rule denying student devices access to a private records service?',
      'Incident evidence exists only in memory and approved isolation blocks further network spread; what containment action preserves that evidence without continued network access?',
      'Restored records match a digest kept on the same compromised device; what trust condition should you check first before accepting recovery integrity?',
      'Why would you prefer prioritizing an actively exploited exposed vulnerability over a higher-rated isolated vulnerability when their asset impacts are equal?',
    ],
  },
};
