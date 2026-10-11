// Original spoken adaptations; sources and validation: docs/devops-interview.md.
const scope = entries => ({ topicScope: entries.map(([name]) => name), topicKeywords: entries.map(([, words]) => words) });
const applied = (base, descriptions) => ({ ...base, topicScope: base.topicScope.map((name, index) => `${name}: ${descriptions[index]}`) });
const easy = scope([
  ['Version control', ['Git', 'version control', 'commit', 'repository', 'branch']],
  ['Delivery automation', ['pipeline', 'build', 'building', 'deploying', 'automated test', 'deployment', 'delivery']],
  ['Containers', ['container', 'image', 'Docker']],
  ['Operating system basics', ['Linux', 'process', 'directory', 'file system']],
  ['Application configuration', ['configuration', 'environment variable', 'setting']],
  ['Monitoring basics', ['log', 'metric', 'monitoring', 'response time']],
]);
const medium = scope([
  ['Pipeline gates', ['pipeline', 'gate', 'prerequisite', 'required test', 'dependent job']],
  ['Artifact consistency', ['artifact', 'digest', 'image tag', 'build output', 'tested build']],
  ['Container storage', ['volume', 'writable layer', 'persistent storage', 'mount']],
  ['Service configuration', ['environment variable', 'configuration', 'startup setting', 'endpoint']],
  ['Access scope', ['permission', 'credential', 'token', 'least privilege', 'read access']],
  ['Troubleshooting evidence', ['log', 'metric', 'timestamp', 'request correlation', 'response time']],
]);
const hard = scope([
  ['Infrastructure coordination', ['Terraform', 'state lock', 'state locking', 'shared state', 'state file', 'infrastructure as code', 'infrastructure plan', 'drift']],
  ['Release safety', ['rollback', 'migration', 'schema', 'release compatibility', 'deployment revision']],
  ['Retry safety', ['retry', 'retries', 'retrying', 'idempotent', 'idempotency', 'idempotency key', 'deduplication', 'operation identifier', 'operation token', 'timeout', 'timed out', 'times out']],
  ['Service health', ['readiness', 'liveness', 'probe', 'traffic eligibility', 'ready for traffic']],
  ['Observability evidence', ['telemetry', 'missing data', 'error rate', 'percentile', 'alert', 'monitoring coverage', 'average response time', 'sampling interval', 'measurement limit']],
  ['Recovery verification', ['backup', 'restore', 'recovery', 'restored data']],
]);
const examples = {
  easy: {
    focus_clarity: [
      'What is version control used for in a shared project?',
      'What is an automated delivery pipeline used for?',
      'What is a container image used for?',
      'What is a Linux process?',
      'What is an environment variable used for in an application?',
      'What is an application log used for?',
    ],
    focus_correctness: [
      'How does a Git commit differ from an uncommitted file edit?',
      'How does building an application differ from deploying it?',
      'How does a container image differ from a running container?',
      'How does a Linux process differ from a directory?',
      'How does an environment variable differ from a setting written directly in application code?',
      'How does an application log differ from a response time metric?',
    ],
    focus_completeness: [
      'Name two useful details in a Git commit record?',
      'Name two familiar activities in a delivery pipeline?',
      'Name two things commonly packaged in a container image?',
      'Name two useful details about a Linux process?',
      'Name two nonsensitive application configuration settings?',
      'Name two useful details in an application log entry?',
    ],
  },
  medium: {
    focus_clarity: [
      'Why does a required test gate help prevent a pipeline from deploying a failing build?',
      'Why does promoting the same tested artifact avoid introducing a different build during deployment?',
      'Why does a retained Docker volume preserve data beyond the lifetime of its removed container?',
      'Why can separate environment configuration let the same application use different service endpoints?',
      'Why does least privilege limit the impact of an exposed automation credential?',
      'Why do timestamps help correlate application logs with a period of slow responses?',
    ],
    focus_correctness: [
      'Deployment requires a successful test job with no bypass; the test fails; what happens to that dependent pipeline job?',
      'How does a fixed image digest differ from an image tag that can be reassigned?',
      'A container is removed but its named volume is retained; what happens to the data stored in that volume?',
      'An application reads configuration only at startup; what value does it keep after an external setting changes without a reload?',
      'An automation token permits reading but not writing a repository; what repository write access does that token provide?',
      'How does a request correlation identifier differ from a timestamp when connecting related log entries?',
    ],
    focus_completeness: [
      'Name two pipeline checks when deployment starts before its required tests finish?',
      'Name two artifact identity checks before deploying a tested build?',
      'Name two volume mounting checks when a replacement container cannot see retained data?',
      'Name two configuration checks when an application connects to the wrong endpoint?',
      'Name two permission checks for an automation job denied access to a repository?',
      'Name two log correlation checks when investigating a specific failed request?',
    ],
  },
  hard: {
    focus_clarity: [
      'Why does supported Terraform state locking prevent cooperating writers from modifying the same state concurrently?',
      'Why does rolling back only an application image leave an already applied database migration unchanged?',
      'Why can retrying a non-idempotent creation request after a timeout produce a duplicate resource?',
      'Why does a running container alone fail to prove that its application is ready for traffic?',
      'Why does an alert remaining silent fail to prove service health when its telemetry is missing?',
      'Why does a successful backup creation report fail to prove that an application can use the restored data?',
    ],
    focus_correctness: [
      'A supported Terraform state lock is held by another writer; what write access should a cooperating runner have until it acquires the lock?',
      'Only the application image is rolled back after a database migration; what happens to the migrated schema?',
      'How does retrying with a server-supported idempotency token differ from repeating a creation request without deduplication?',
      'How does a failed readiness probe differ from a failed liveness probe after its configured restart threshold?',
      'How does a response time percentile differ from an average when a small fraction of requests is very slow?',
      'A backup file exists but no restore test has run; what evidence of successful application recovery is still missing?',
    ],
    focus_completeness: [
      'Name three shared state coordination checks before concurrent infrastructure automation runs?',
      'Name three release compatibility checks before an application rollback after a schema migration?',
      'Name three retry safety checks after a resource creation response is lost?',
      'Name three readiness evidence checks before a new replica receives service traffic?',
      'Name three telemetry checks before interpreting a silent alert as healthy service evidence?',
      'Name three restore verification checks before trusting a database backup for application recovery?',
    ],
  },
};
const focusDetails = {
  easy: {
    focus_clarity: ['explain version history purpose', 'explain automated delivery purpose', 'explain container image purpose', 'explain a familiar Linux process', 'explain runtime settings purpose', 'explain application logging purpose'],
    focus_correctness: ['compare committed and edited project state', 'compare build and deployment', 'compare an image with a running instance', 'compare a process with a directory', 'compare external settings with hardcoded settings', 'compare an event log with a numeric metric'],
    focus_completeness: ['name two commit record details', 'name two familiar pipeline activities', 'name two image contents', 'name two process details', 'name two nonsensitive settings', 'name two log entry details'],
  },
  medium: {
    focus_clarity: ['explain required successful prerequisite gates', 'explain promotion of the same tested output', 'explain retained mounted volume lifetime', 'explain separate startup configuration', 'explain limited credential access', 'explain timestamp and request correlation'],
    focus_correctness: ['predict a dependent job under an explicit failed prerequisite without bypass', 'compare fixed content digests with mutable tags', 'predict retained volume data under stated removal conditions', 'predict startup-only settings without reload', 'predict explicitly limited token access', 'compare timestamps with request identifiers'],
    focus_completeness: ['name two prerequisite checks', 'name two artifact identity checks', 'name two mount checks', 'name two endpoint configuration checks', 'name two access permission checks', 'name two request log checks'],
  },
  hard: {
    focus_clarity: ['explain shared state coordination with supported enabled locking', 'explain image-only rollback limits after migration', 'explain duplicate side effects after uncertain timeout', 'explain process state versus readiness evidence', 'explain missing telemetry and silent alerts', 'explain backup existence versus verified recovery'],
    focus_correctness: ['predict cooperating writer access under a held supported lock', 'predict schema state after image-only rollback', 'compare server-supported deduplication with unsafe repeated creation', 'compare traffic eligibility with configured liveness restart', 'compare percentile and average evidence without inferring a cause', 'select missing evidence from an untested backup'],
    focus_completeness: ['name three shared state coordination checks', 'name three migration rollback compatibility checks', 'name three uncertain retry checks', 'name three replica readiness checks', 'name three alert evidence checks', 'name three restore validation checks'],
  },
};
const focused = (base, difficulty) => ({ ...base, focusTopics: Object.fromEntries(Object.entries(focusDetails[difficulty]).map(([focus, descriptions]) => [focus, applied(base, descriptions)])) });
module.exports = {
  id: 'devops', label: 'DevOps Engineer',
  avoidList: `DEVOPS ENGINEER SPOKEN SCOPE:
- Target students operating small practice applications. Use original short questions about version control, Linux processes, delivery pipelines, Docker, Terraform, Kubernetes and monitoring evidence. No code, commands, file paths, configuration syntax, flag recall, vendor pricing, certification trivia, whole-platform architecture or assumed production incidents.
- Ask one task only. Clarity explains one purpose or mechanism; correctness selects one behavior or compares two related concepts; completeness names two items in easy and medium, three in hard. Never append and why, and how, then compare, name the checks, or a second outcome. Do not supply list answers in context. Prefer direct 18 to 30 word hard questions; omit repeated small-app introductions and stay below 45 words.
- Use spoken names: version control, delivery pipeline, infrastructure as code, image digest, environment variable, readiness probe. Do not write DevOps or GitHub inside questions because camel case brand names trigger speech guards. The catalogue label remains DevOps Engineer.
- A Git commit records project history; it does not itself deploy or prove tests passed. Build, test, approval and deployment are distinct activities. DevOps includes collaboration and automation, not a single tool or a guarantee of release quality.
- Pipeline failure outcomes require a stated successful prerequisite policy and no bypass. Independent jobs can run concurrently, and configured failure handlers can still run. Never claim every failed test automatically blocks every deployment. Promoting the same tested artifact preserves build identity, not identical configuration or guaranteed runtime behavior. A fixed image digest identifies content; mutable tags can be reassigned. No digest spelling or hashing-algorithm quizzes.
- An ordinary Linux container is an isolated process environment sharing the host kernel, not a perfect security boundary. An image differs from its running instance. Removal destroys the container writable layer; retained volume data survives only under stated volume retention. Replacement containers must mount the same volume at the intended path to see that data. Restarting the same container is not removing and recreating it. Persistence is not proof of a tested backup.
- Use ordinary Linux container context for shared-kernel claims. For removal predictions explicitly say the named volume is retained and not deleted. Existing Docker container environment settings are retained by a simple restart; supplying changed environment values requires recreation with the new settings. Do not compare restart versus changing environment variables as interchangeable configuration updates.
- Runtime configuration can differ across environments. Predict updates only when startup-only reads and no reload are explicitly stated. Missing settings do not imply a universal crash, fallback value or destination. Credentials should receive the least required access; state actual permissions when predicting permitted actions. Environment variables are not automatically secure secret storage. Do not quote tokens or request personal secrets.
- Linux process existence does not prove application responsiveness or successful requests. Logs describe recorded events; metrics summarize measurements. Timestamps and request correlation provide evidence, not automatic proof of a single root cause. Avoid numerical permission modes, signals and network protocol trivia.
- State locking only coordinates cooperating writers to the same Terraform state when the backend supports locking and it is enabled. It does not stop manual cloud edits, prove a plan is current, fix drift, reverse partially applied changes or encrypt state. Sensitive output masking does not remove stored state secrets. Do not suggest bypassing a live lock as a routine fix.
- Locking serializes cooperating state access, not one plan overwriting another plan. Ask about a held state lock and a second state writer, not about replacing plan files.
- Image-only or deployment-revision rollback does not undo an already applied database migration or external side effect. State exactly what changes and what remains unchanged; do not infer that old code is compatible with the migrated schema. Ask for compatibility evidence, not a whole rollback procedure or guaranteed zero downtime.
- An unchanged migrated schema does not prove the old application fails or cannot restore its earlier behavior; that depends on schema compatibility. Explain the unchanged schema rather than assuming a behavior failure without supplied incompatibility.
- Do not ask why restoring the old image alone fails to restore previous application behavior unless incompatible schema behavior is explicitly given. Ask why restoring that image alone does not reverse the applied migration.
- A lost response or timeout leaves remote success uncertain. A non-idempotent retry can duplicate effects, but does not always do so. Deduplication requires explicit server support, reuse of the same operation token and equivalent intent within the supported lifetime. A new token describes a new operation; client-side tokens or backoff alone do not guarantee deduplication. Do not promise exact retry counts or automatic recovery.
- When comparing same-token and new-token duplicate effects, explicitly state server-supported deduplication for equivalent requests within the token lifetime. A token comparison without that server contract has no definite duplication guarantee.
- Readiness controls traffic eligibility through the configured service mechanism; liveness failure restarts only after its configured threshold. A readiness failure alone does not restart a container. No exact immediate routing, zero-downtime or whole-app correctness guarantees. Probe success verifies its check, not all dependencies or user journeys. Avoid precise replica-count outcomes without rollout settings.
- If discussing a numbered series of probe failures, explicitly identify which probe fails. Do not say liveness keeps passing and then ambiguously refer to its first two failures.
- Passing liveness with failed readiness does not trigger a restart policy by itself. Ask about investigating readiness evidence instead of waiting for an assumed automatic recreation. Do not treat changing a failing probe to green as a fix for an unverified underlying application fault.
- Silent alerts with missing telemetry are inconclusive. Average response time can hide slow requests; percentiles need a stated percentile and population for numeric conclusions. Monitoring evidence does not by itself identify a root cause. Do not equate absent logs with absent errors or an empty dashboard with healthy traffic.
- Backup existence or a successful copy report does not prove restoration, freshness, completeness or application usability. Ask about isolated restore testing and stated recovery requirements. Replication can copy unwanted deletes and is not automatically historical recovery. No universal recovery time or zero data loss claims.
- Before predicting whether missing writes satisfy a recovery point requirement, state its maximum permitted data loss. If that bound is absent, ask which requirement to inspect rather than assuming a pass or fail outcome.`,
  difficultyAvoidLists: {
    easy: 'Use familiar Git history, pipeline activities, images, Linux processes, external settings and log meanings. No shared state locks, readiness thresholds, migration rollback, uncertain retries, percentiles or restore guarantees.',
    medium: 'Use one applied pipeline prerequisite, artifact identity, retained volume, startup setting, access scope or log correlation task. No concurrent state writers, irreversible migration outcomes, idempotency contracts, probe thresholds or advanced recovery trade-offs.',
    hard: 'Use one bounded advanced-junior coordination, compatibility, retry, health, telemetry or recovery evidence task. Three introductory items alone are not hard. No enterprise architecture, tool syntax, long incident response procedures or cloud-provider policy recall.',
  },
  set1: { ...medium, difficultyTopics: { easy: focused(easy, 'easy'), medium: focused(medium, 'medium'), hard: focused(hard, 'hard') }, easyExamples: examples.easy, mediumExamples: examples.medium, hardExamples: examples.hard },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: applied(easy, ['apply project history meanings', 'choose a familiar pipeline activity', 'apply image and instance distinctions', 'inspect a familiar running process', 'choose an external nonsensitive setting', 'test recorded application events']),
      medium: applied(medium, ['apply explicitly configured prerequisite gates', 'deploy the same identified tested output', 'reason about retained volumes and replacement mounts', 'apply startup configuration without assuming reload', 'choose required access without unnecessary privileges', 'correlate observed logs and measurements']),
      hard: applied(hard, ['coordinate supported shared state writers', 'check compatibility across image rollback and migrated schemas', 'reason about server-supported idempotency after uncertain completion', 'distinguish probe traffic and restart policies', 'evaluate telemetry freshness and measurement limits', 'verify restored data against recovery requirements']),
    },
    easyExamples: [
      'What does a Git commit record in a project?',
      'Why is an automated delivery pipeline useful?',
      'How does a container image differ from a running container?',
      'An application reads an environment variable at startup; what happens to its loaded setting when that supplied value changes before startup?',
      'Name two log checks for an application action that should record success and failure?',
      'A teammate needs earlier project changes; which version control record should they inspect?',
    ],
    mediumExamples: [
      'How does a required successful prerequisite connect two pipeline jobs?',
      'Why does a retained Docker volume help preserve data when a container is removed?',
      'How does a fixed image digest differ from a reassigned image tag?',
      'A deployment job requires successful tests with no bypass; the tests fail; what happens to that dependent job?',
      'Name two configuration checks for an application that reads its service endpoint only at startup?',
      'A repository job only needs read access; what permission scope fits its automation token?',
      'A replacement container cannot see retained data; what volume mounting detail should you check first?',
      'Why would you prefer request correlation over matching only timestamps when connecting logs from one request?',
    ],
    hardExamples: [
      'How does supported Terraform state locking coordinate writers sharing the same state?',
      'Why does image-only rollback leave an applied database migration unchanged?',
      'How does readiness failure differ from liveness failure after the configured restart threshold?',
      'Only an application image is rolled back; what happens to the previously migrated database schema?',
      'Name two retry safety checks after a creation response is lost?',
      'A database backup has never been restored; what evidence should verify its application usability?',
      'An alert is silent while telemetry is missing; what monitoring coverage should you check first?',
      'Why would you prefer a server-supported idempotent retry over repeating an undeduplicated creation after a timeout?',
    ],
  },
};
