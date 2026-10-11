// Original spoken adaptations; research and validation: docs/it-support-interview.md.
const scope = entries => ({ topicScope: entries.map(([name]) => name), topicKeywords: entries.map(([, words]) => words) });
const applied = (base, descriptions) => ({ ...base, topicScope: base.topicScope.map((name, i) => `${name}: ${descriptions[i]}`) });
const easy = scope([
  ['Device basics', ['hardware', 'memory', 'RAM', 'storage', 'processor', 'monitor', 'power', 'keyboard']],
  ['Operating systems and apps', ['operating system', 'application', 'software', 'driver', 'install']],
  ['Connectivity basics', ['network', 'Wi-Fi', 'wireless', 'Ethernet', 'DNS', 'DHCP', 'internet', 'IP address']],
  ['Account basics', ['account', 'password', 'sign in', 'sign-in', 'login', 'identity', 'permission']],
  ['Printing basics', ['printer', 'printing', 'print queue', 'print job', 'test page']],
  ['Support tickets', ['ticket', 'support request', 'symptom', 'error message', 'escalation', 'help desk']],
]);
const medium = scope([
  ['Startup and performance', ['startup', 'boot', 'power', 'display', 'slow', 'performance', 'resource', 'memory', 'disk', 'application']],
  ['Connection isolation', ['connection', 'connectivity', 'network', 'Wi-Fi', 'DNS', 'DHCP', 'name lookup', 'IP address']],
  ['Account access', ['account', 'password', 'lockout', 'locked', 'permission', 'access denied', 'sign in', 'sign-in', 'authorization']],
  ['Peripheral diagnosis', ['printer', 'printing', 'print', 'queue', 'peripheral', 'USB', 'device driver']],
  ['Ticket triage', ['ticket', 'incident', 'service request', 'priority', 'impact', 'urgency', 'escalat', 'handoff']],
  ['User support', ['user', 'instruction', 'remote', 'consent', 'screen', 'understand', 'communication', 'control permission']],
]);
const hard = scope([
  ['Evidence isolation', ['controlled', 'comparison', 'profile', 'reproduce', 'reproducing', 'variable', 'cause', 'correlation']],
  ['Name resolution evidence', ['DNS', 'resolver', 'cache', 'hostname', 'name lookup', 'name resolution', 'reachability', 'ping']],
  ['Identity recovery', ['identity', 'reset', 'recovery', 'verification', 'caller', 'MFA', 'authentication', 'impersonat']],
  ['Change safety', ['change', 'rollback', 'driver', 'backup', 'restart', 'unsaved', 'approval', 'reinstall']],
  ['Incident coordination', ['incident', 'outage', 'priority', 'impact', 'workaround', 'escalat', 'handoff', 'shared service']],
  ['Closure verification', ['closure', 'resolved', 'resolution', 'restored', 'intermittent', 'retest', 'retesting', 'recurrence', 'original task', 'original user task']],
]);
const examples = {
  easy: {
    focus_clarity: [
      'What is working memory used for in a computer?',
      'What is an operating system used for?',
      'What is DNS used for on a network?',
      'What is an account password used for?',
      'What is a print queue used for?',
      'What is a support ticket used for?',
    ],
    focus_correctness: [
      'How does working memory differ from persistent storage?',
      'How does an operating system differ from an application?',
      'How does DNS differ from DHCP?',
      'How does signing into an account differ from receiving permission to open a file?',
      'How does a queued print job differ from a printed page?',
      'How does a reported symptom differ from a confirmed cause in a support ticket?',
    ],
    focus_completeness: [
      'Name two hardware components in a desktop computer?',
      'Name two familiar application types used in an office?',
      'Name two ways a laptop can connect to a local network?',
      'Name two account details useful for identifying a sign in problem without sharing secrets?',
      'Name two simple printer readiness checks?',
      'Name two useful details in a support ticket?',
    ],
  },
  medium: {
    focus_clarity: [
      'Why is observing resource use during a slow application useful for troubleshooting?',
      'Why does observing connectivity on another device help narrow a network problem?',
      'Why can signing into an account succeed while opening a restricted file is denied?',
      'Why is a printer test page useful when one application cannot print?',
      'Why does documenting attempted checks make a ticket handoff more useful?',
      'Why should remote support instructions describe one visible action at a time?',
    ],
    focus_correctness: [
      'How does a computer with no power differ from one that powers on but cannot boot?',
      'How does successful network connection differ from successful DNS name lookup?',
      'How does an account lockout differ from a resource permission denial?',
      'A printer queue is paused with a waiting job; what happens to that job until the queue resumes?',
      'How does an unplanned service interruption differ from a routine service request?',
      'Remote control requires user consent; consent is declined; what control permission should the support agent have?',
    ],
    focus_completeness: [
      'Name two resource observations useful while a computer is slow?',
      'Name two connectivity checks for separating one device issue from a wider network issue?',
      'Name two account access checks after a user receives an access denied message?',
      'Name two print queue checks when a document remains waiting?',
      'Name two business impact details useful for prioritizing a support ticket?',
      'Name two user understanding checks during remote support instructions?',
    ],
  },
  hard: {
    focus_clarity: [
      'Why does changing several troubleshooting variables together weaken evidence about which change helped?',
      'Why can a stale local DNS cache disagree with a fresh answer from the configured resolver?',
      'Why does knowing an employee name alone fail to verify a caller requesting account recovery?',
      'Why does a driver rollback require verification of the original task after the change?',
      'Why does a working incident workaround leave the underlying cause unproven?',
      'Why does one successful retest alone fail to establish that an intermittent issue is resolved?',
    ],
    focus_correctness: [
      'How does reproducing a failure under controlled conditions differ from observing it once after an unrelated change?',
      'How does a successful ping differ from evidence that a user application works?',
      'Account recovery requires approved identity verification; a caller provides only public employee details; what recovery authorization is established?',
      'A restart discards unsaved local edits; the user has not saved them; what happens to those edits during that restart?',
      'How does restoring an incident through a workaround differ from establishing its root cause?',
      'How does retesting the original user task differ from checking only that an application opens?',
    ],
    focus_completeness: [
      'Name three context details needed to reproduce an intermittent failure under controlled conditions?',
      'Name three name resolution checks before attributing a hostname failure to a DNS server?',
      'Name three account recovery safeguards against caller impersonation?',
      'Name three change safety checks before an approved driver rollback?',
      'Name three incident handoff details when escalating a shared service outage?',
      'Name three closure evidence checks for an intermittent issue reported as resolved?',
    ],
  },
};
const focusDetails = {
  easy: {
    focus_clarity: ['explain working memory purpose', 'explain operating system purpose', 'explain DNS name lookup purpose', 'explain account password purpose', 'explain print queue purpose', 'explain support ticket purpose'],
    focus_correctness: ['compare temporary memory and retained storage', 'compare operating system and application', 'compare name lookup and automatic address assignment', 'compare sign in and file permission', 'compare waiting print work and physical output', 'compare reported symptom and established cause'],
    focus_completeness: ['name two familiar hardware parts', 'name two office application types', 'name two local network connection methods', 'name two nonsensitive account problem identifiers', 'name two simple printer readiness checks', 'name two useful support record details'],
  },
  medium: {
    focus_clarity: ['explain resource observations during slowness', 'explain comparison of affected and unaffected devices', 'explain authenticated identity without file authorization', 'explain a test page as bounded printing evidence', 'explain documented checks in a handoff', 'explain one visible support instruction at a time'],
    focus_correctness: ['compare no power and failed boot', 'compare network association and name lookup', 'compare lockout and permission denial', 'predict a paused queue under an explicit resume condition', 'compare service interruption and routine request', 'predict remote access under an explicit consent rule'],
    focus_completeness: ['name two resource observations', 'name two device and network comparisons', 'name two permission and identity checks', 'name two queue state checks', 'name two impact details', 'name two comprehension checks'],
  },
  hard: {
    focus_clarity: ['explain one variable evidence limits', 'explain stale local and current resolver answers', 'explain public knowledge versus identity verification', 'explain verification after reversing a driver change', 'explain restoration without proved root cause', 'explain intermittent closure evidence limits'],
    focus_correctness: ['compare controlled reproduction and temporal correlation', 'compare network reachability and application success', 'predict authorization under an explicit verification rule', 'predict unsaved data loss under a stated restart behavior', 'compare workaround restoration and root cause evidence', 'compare original task completion and app launch'],
    focus_completeness: ['name three controlled reproduction context details', 'name three client name lookup checks', 'name three impersonation safeguards', 'name three rollback safety checks', 'name three outage handoff details', 'name three intermittent closure checks'],
  },
};
const focused = (base, difficulty) => ({ ...base, focusTopics: Object.fromEntries(Object.entries(focusDetails[difficulty]).map(([focus, descriptions]) => [focus, applied(base, descriptions)])) });
module.exports = {
  id: 'it-support', label: 'IT Support / Service Desk',
  avoidList: `IT SUPPORT SPOKEN SCOPE:
- Target students and graduates doing first line help desk, desktop and user support. Use original short questions about devices, operating systems, connectivity, account access, printers, support tickets and safe assistance. Do not assume employment, production incidents or vendor certifications. Exclude programming, database query syntax, routing design, enterprise administration, cybersecurity investigations and application delivery pipelines. Set 3 remains shared entry-level behavioral practice.
- Ask one task only. Clarity explains one purpose or mechanism; correctness identifies one behavior or compares two concepts; completeness names exactly two relevant items for easy and medium and three for hard. Set 2 testing always requests two checks. No added examples, and why, full troubleshooting walkthroughs or multiple unrelated failures. Prefer 24 words or fewer for easy, 32 for medium and 45 for hard. Hard requires bounded evidence reasoning, not three introductory definitions.
- Prefer a direct question. If a scenario is necessary, keep its context to about fifteen words and ask one task about the selected topic. Do not copy a full scenario from history or use multiple users, devices, symptoms and time points merely to make hard questions longer. Rewording the same stale DNS cache mechanism is not a new task; use an unasked topic before repeating that mechanism. Do not introduce disk and memory utilization together in easy questions; keep applied resource observation in medium.
- Working memory holds active data; ordinary RAM is volatile and storage normally retains saved data without power. Do not confuse memory capacity and free disk space. CPU, memory, disk and startup observations may narrow slowness but a high resource reading alone does not prove a root cause. No fixed universal utilization threshold or automatic hardware upgrade prescription.
- An open document can have active data in memory and saved copies on storage. Ask about active working data or saved persistent copies explicitly; do not ask which part keeps open documents while the computer is on. For unsaved data outcome questions, explicitly state whether unsaved content is automatically saved or recovered. Session restoration may restore windows without unsaved content; prompting on ordinary close does not define an unexpected restart outcome. When those facts are unknown, ask about data loss risk or the safeguard instead of predicting loss or recovery.
- Separate no power, no display, failed startup and an application failure. A blank display alone does not prove no power or a broken computer. Observe available evidence before replacing parts, reinstalling or forcing a restart. A restart may lose unsaved work; state the saving and application recovery behavior before predicting loss. Do not claim every restart loses every file or repairs every fault. Never prescribe opening a powered device, bypassing electrical safeguards or touching live components.
- An operating system manages resources and runs applications; a driver enables interaction with a device. Updating, rolling back, reinstalling and restarting are different actions. Recent timing is a lead, not proof of causation. Prefer approved reversible checks before destructive recovery. Obtain required authorization and user readiness before disruptive changes, preserve useful evidence and verify the original task after a change. A backup existing is not proof that restoration works.
- DNS resolves names; DHCP supplies network configuration. Wi-Fi association, valid addressing, name lookup, endpoint reachability and a working application are distinct evidence. Another device working narrows scope but does not prove a failed adapter. A self-assigned address can indicate missing automatic configuration, not one unique server failure. Avoid dotted IP addresses, exact port numbers, commands and full network stack diagnosis.
- A successful ping establishes only that the tested endpoint responded to that reachability test at that time; it does not prove web, email, authentication or every application works. A failed ping alone does not prove the endpoint is down, since replies may be blocked. Do not use visiting a website by raw IP as a universal DNS test because TLS, virtual hosting and redirects may differ. Ask about a controlled name lookup test or a known endpoint test instead.
- Local DNS cache and configured resolver answers can differ when cached records are stale or negative. Clearing a client cache affects that client, not every server or other user, and a fresh lookup can still fail. State cache use and the subsequent lookup rule before predicting a particular result. Do not prescribe disabling caching or changing organization DNS servers without authorization.
- Preserve the cached answer and a direct resolver answer before clearing the cache if the question asks which earlier source was wrong. Successful lookup after a clear alone cannot establish whether the earlier cache or resolver caused the original failure; current tests do not reconstruct erased historical evidence. Either specify captured before-change answers or ask about present lookup checks without promising a past root cause.
- Signing in establishes identity, while authorization governs resources; password reset does not grant file permissions. A locked account differs from an access denied resource. State lockout thresholds and configured behavior before predicting a lockout. Directory group changes may require a new session or synchronization; do not promise immediate effect without explicit conditions. Distinguish online sign in from offline cached credentials; avoid guessing domain behavior.
- Follow an approved identity verification and account recovery process before resets or authentication method changes. Knowing an employee name, caller ID, job title or other public details is not sufficient proof. Urgency is not authorization. Use independent trusted records or established verification channels under the stated policy; do not invent an organization verification checklist. Never request actual passwords, recovery codes, one time codes or approval of unsolicited authentication prompts. Never bypass multifactor authentication as a convenience fix.
- Printed output, local print queue state, printer readiness and application printing are separate. A paused queue holds jobs until resumed under the stated conditions; queued does not mean printed. A test page supports a limited printer path check, not proof every app prints. Clearing a queue can discard pending jobs; restarting a spooler can affect other users. State scope and approval before proposing disruptive shared printer actions. Do not assume every paper jam or waiting job has the same cause.
- A successful test page demonstrates only the tested print path at that time; never say it proves the printer works in general or all printer hardware is healthy. A resumed queue makes waiting work eligible to continue, not guaranteed printed output. Avoid context claiming the same account is both successfully signing in and locked out at that sign in; a later lockout and existing session need explicit timing if relevant.
- Tickets preserve reported symptoms, scope, timing, observed errors, attempted checks and outcomes, with only necessary nonsensitive details. Do not store secrets or unrelated personal information. Escalation shares evidence and responsibility with the authorized team; it does not mean guessing a fix or abandoning the user. Distinguish an unplanned incident from a routine service request. Use impact and urgency under the given priority policy; no universal SLA, priority matrix or automatic VIP override. State the decision rule before asking which ticket is first.
- Incident versus service request classification does not by itself determine priority. Two users blocked from existing resources may both report incidents; do not label a permission failure a routine request just because sign in worked. Describe a request for a new standard service or access grant when contrasting it with a current interruption. Never ask what incident classification changes about priority without an explicit organization rule. A high disk reading does not by itself explain slowness better than memory use; ask about one observation or supply comparable evidence.
- Recovery comparisons must state how each source was authenticated. A manager confirmation may be an approved independently verified channel; do not compare all verbal manager confirmations as inherently weaker than all records. Use an unverified caller claim versus an independently authenticated record, or ask about the need to follow the stated recovery policy. An organization rule mentioned by name alone is not a stated rule: include the actual required condition.
- Prefer the short rule recovery requires approved independent identity verification, followed by whether that verification succeeded. A record confirming a request exists is not proof the requester identity was verified. Do not use under the stated policy without stating its condition. Correctness compares one distinction with How does X differ from Y or predicts one specified outcome; never ask what each observation, each result or each source separately proves. Avoid browser-versus-command-line name lookup predictions with unknown resolver paths; ask directly about cache evidence or a specified resolver instead.
- Explain support actions in plain language, one observable step at a time, and check the user understanding and result. Remote control requires the organization approved tool, an independently trusted support contact and informed consent. Consent does not grant unlimited permissions or authorize unrelated data access. Avoid behavioral stories in technical sets; ask one concrete communication or remote access mechanism instead. Do not force personal employment experience.
- Screen viewing and remote control can require separate consent. A declined control request blocks control under the stated policy, not necessarily an already authorized viewing session. Specify which permission is requested. Ask only about preserving work before a disruptive change or verification afterward, not both tasks together. A failed rollback retest shows the task is still affected; it does not prove the original driver was unrelated or that the fault lies elsewhere. Keep restoration evidence and root cause diagnosis distinct.
- A workaround can restore use without eliminating the underlying cause. One successful retest cannot prove an intermittent fault will never return. Closure evidence should address the original task, affected scope and an appropriate observation period under the stated policy. Never guarantee permanent repair from one test, silence, an app opening or a cleared error message alone. Do not prescribe exact observation durations without policy.
- Incident resolution can mean verified service restoration under the stated closure policy even when a separate underlying problem remains. Do not claim root cause elimination is always required to resolve an incident, or that a workaround always prevents closure. Check current business impact, the original user task and the policy; keep root cause evidence separate. Do not ask both incident record accuracy and risk to other users as independent consequences. Ask one short mechanism or one evidence distinction.
- A workaround helping one user and a wider incident affecting other users can both be true. Do not present them as mutually exclusive alternatives, especially when other users are already stated to remain affected. Ask what remaining impact to record or why one restored user does not establish restoration for the full affected scope.
- Keep these topics distinct from specialist Network Engineer, Cybersecurity and DevOps roles: assess safe first line checks, evidence, user assistance and handoff rather than deep protocol internals, threat hunting or infrastructure automation. Do not repeat the same diagnosis or fact under a different device name when it already appears in history.`,
  difficultyAvoidLists: {
    easy: 'Use familiar hardware, operating system and app purposes, basic DNS and DHCP, sign in and permissions, printer readiness and ticket details. One introductory fact or direct action. No fault isolation chains, local DNS cache behavior, identity recovery policies, priority matrices, driver rollback tradeoffs, intermittent evidence limits or resource bottleneck diagnosis.',
    medium: 'Use one focused resource observation, connectivity comparison, permission denial, printer queue state, ticket classification or clear support instruction. At most two connected reasoning steps. No DNS cache versus resolver chains, caller impersonation safeguards, controlled causal evidence, intermittent closure proof or shared outage coordination. State consent and priority policy for outcomes.',
    hard: 'Use one controlled evidence limit, client name resolution boundary, identity recovery rule, reversible change risk, incident coordination decision or closure verification mechanism. At most three connected reasoning steps. Remain advanced junior: no enterprise architecture, registry edits, command syntax, malware forensics, full recovery plans or vendor certification trivia.',
  },
  set1: { ...medium, difficultyTopics: { easy: focused(easy, 'easy'), medium: focused(medium, 'medium'), hard: focused(hard, 'hard') }, easyExamples: examples.easy, mediumExamples: examples.medium, hardExamples: examples.hard },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: applied(easy, ['identify familiar computer parts and memory purpose', 'distinguish operating system and app tasks', 'identify name lookup and local connection basics', 'recognize account sign in without sharing passwords', 'check familiar printer readiness and queue purpose', 'record symptoms and communicate support requests']),
      medium: applied(medium, ['observe resources and distinguish startup symptoms', 'compare affected devices without assuming a unique cause', 'check identity state versus resource permission', 'separate queue state and application printing evidence', 'classify incidents and prioritize under stated rules', 'give bounded instructions and honor remote control consent']),
      hard: applied(hard, ['use controlled comparisons without overclaiming causation', 'interpret cached name lookup and reachability evidence', 'require independent approved recovery verification', 'preserve work and verify reversible approved changes', 'coordinate wider incidents and distinguish workaround evidence', 'validate original task restoration and intermittent behavior']),
    },
    easyExamples: [
      'What is a device driver used for?',
      'Why is recording an error message useful in a support ticket?',
      'How does working memory differ from persistent storage?',
      'A print queue is paused with one waiting job; what happens to that job until printing resumes?',
      'Name two simple printer readiness checks?',
      'You need to connect a laptop to a wireless network; what should you enable?',
    ],
    mediumExamples: [
      'How does a printer test page help narrow a printing problem?',
      'Why is observing resource use during a slow application useful for troubleshooting?',
      'How does an account lockout differ from a file permission denial?',
      'Remote control requires user consent; consent is declined; what happens to the support agent control permission?',
      'Name two connectivity checks for separating one device issue from a wider network issue?',
      'A ticket concerns a check beyond your authorized support scope; what should happen to its handoff?',
      'One application prints blank pages while the printer test page works; what printing path should you check first?',
      'Why would you prefer one visible user instruction at a time over several unexplained steps?',
    ],
    hardExamples: [
      'How does changing one troubleshooting variable at a time strengthen troubleshooting evidence?',
      'Why does a successful ping alone not establish that a user application works?',
      'How does restoring an incident through a workaround differ from establishing its root cause?',
      'Account recovery requires approved identity verification; a caller supplies only public employee details; what outcome follows for reset authorization?',
      'Name two closure checks that address recurrence risk after an intermittent issue temporarily disappears?',
      'A driver rollback needs approval and would interrupt active work; what change safety condition should be satisfied before proceeding?',
      'A hostname lookup uses a stale local DNS cache while its configured resolver returns the current record; what should you check first?',
      'Why would you prefer preserving the current driver and recovery option over an irreversible reinstall when testing a suspected driver change?',
    ],
  },
};
