// Original spoken adaptations; sources and limitations: docs/game-developer-interview.md.
function scope(entries) {
  return { topicScope: entries.map(([topic]) => topic), topicKeywords: entries.map(([, words]) => words) };
}
function applied(base, descriptions) {
  return { ...base, topicScope: base.topicScope.map((topic, i) => `${topic}: ${descriptions[i]}`) };
}
const easy = scope([
  ['Game loop', ['game loop', 'frame', 'update', 'render']],
  ['Player input', ['input', 'button', 'key', 'controller']],
  ['Object transforms', ['transform', 'position', 'rotation', 'scale']],
  ['Collision basics', ['collision', 'collider', 'trigger']],
  ['Game assets', ['asset', 'sprite', 'texture', 'audio clip']],
  ['Gameplay feedback', ['health', 'score', 'feedback', 'HUD', 'player values', 'game screen']],
]);
const medium = scope([
  ['Timed movement', ['delta time', 'elapsed time', 'movement', 'speed']],
  ['Input events', ['input', 'press', 'held', 'release']],
  ['Coordinate spaces', ['local', 'world', 'parent', 'coordinate']],
  ['Collision filtering', ['collision', 'layer', 'mask', 'overlap']],
  ['Animation transitions', ['animation', 'transition', 'blend', 'clip']],
  ['Gameplay state', ['state', 'cooldown', 'pause', 'timer']],
]);
const hard = scope([
  ['Simulation timing', ['physics', 'timestep', 'interpolation', 'simulation']],
  ['Swept collision', ['projectile', 'swept', 'tunneling', 'thin wall']],
  ['Pooling lifecycle', ['pool', 'pooled', 'pooling', 'reuse', 'lifetime']],
  ['AI navigation', ['navigation', 'path', 'waypoint', 'obstacle']],
  ['Rendering work', ['rendering', 'draw call', 'culling', 'GPU']],
  ['Performance evidence', ['profiler', 'frame time', 'allocation', 'benchmark']],
]);
const easyExamples = {
  focus_clarity: [
    'What is a game loop used for?',
    'What is player input used for in a game?',
    'What does an object position describe?',
    'What is a collider used for in a game?',
    'What is a sprite used for in a game?',
    'What is a health display used for during play?',
  ],
  focus_correctness: [
    'How does updating game logic differ from rendering a frame?',
    'How does pressing a button differ from releasing it?',
    'How does changing position differ from changing scale?',
    'How does detecting a collision differ from displaying a sprite?',
    'How does a texture asset differ from an audio clip?',
    'A score display shows the current total; what happens to that display when the total increases?',
  ],
  focus_completeness: [
    'Name two kinds of work performed by a game loop?',
    'Name two common devices for player input?',
    'Name two properties of an object transform?',
    'Name two familiar shapes used for colliders?',
    'Name two kinds of game assets?',
    'Name two player values commonly shown as gameplay feedback?',
  ],
};
const mediumExamples = {
  focus_clarity: [
    'How does delta time help keep movement speed consistent when frame duration changes?',
    'Why does a press event help prevent a held input from triggering an action every update?',
    'How does a parent transform affect the world position of a child with a fixed local position?',
    'How does a collision mask restrict which layers an overlap query detects?',
    'How does blending make an animation transition less abrupt?',
    'How does a cooldown state prevent an ability from being used again immediately?',
  ],
  focus_correctness: [
    'Movement adds a fixed distance each rendered update without delta time; what happens to speed when the frame rate doubles?',
    'How does a single press event differ from checking held input every update?',
    'How does a local coordinate differ from a world coordinate for an object under a moved parent?',
    'A collision query mask excludes an object layer; what detection result should that query return for the object?',
    'How does blending two animation clips differ from switching between them instantly?',
    'A cooldown timer uses paused game time; what happens to its remaining duration while that time is stopped?',
  ],
  focus_completeness: [
    'Name two observations for comparing movement speed across different frame rates?',
    'Name two input cases for an action intended to fire once per press?',
    'Name two coordinate details to inspect when a child appears at an unexpected world position?',
    'Name two collision filter settings to inspect when an overlap query misses a target?',
    'Name two animation transition details to inspect when a character never enters its running clip?',
    'Name two state conditions to test for an ability with a cooldown?',
  ],
};
const hardExamples = {
  focus_clarity: [
    'How does interpolation between completed physics snapshots smooth rendering when the display updates more frequently than simulation?',
    'How does a swept collision check reduce projectile tunneling through a thin wall between updates?',
    'Why must a pooled object reset its lifetime before reuse when the previous activation nearly expired?',
    'Why can a navigation path become unusable after an obstacle blocks its next segment?',
    'Why can reducing draw calls fail to improve frame time when rendering is limited by expensive pixel shading?',
    'Why does a profiler trace of a slow frame provide stronger evidence than an average frame rate?',
  ],
  focus_correctness: [
    'How does rendering an interpolated physics pose differ from advancing the actual simulation toward a future pose?',
    'A projectile crosses a thin wall between discrete collision samples without swept checks; what collision outcome is possible?',
    'A pooled object retains an almost expired lifetime and resumes its countdown on reuse; what happens to its new activation?',
    'A navigation path is unchanged after an obstacle blocks its next segment; what happens if an agent follows that segment without replanning?',
    'How does reducing draw calls differ from reducing pixel shading work when the GPU is limited by shading?',
    'How does average frame rate differ from the longest frame time as evidence of a brief gameplay hitch?',
  ],
  focus_completeness: [
    'Name three physics timing checks when interpolated visuals jitter despite smooth simulation snapshots?',
    'Name three projectile test conditions for tunneling through thin walls?',
    'Name three per-activation values to reset before reusing a pooled object?',
    'Name three navigation checks when an agent follows an outdated path into a new obstacle?',
    'Name three rendering observations for evaluating whether reducing draw calls addresses a measured bottleneck?',
    'Name three benchmark controls for comparing frame time before and after an optimization?',
  ],
};
const focusDescriptions = {
  easy: {
    focus_clarity: ['explain loop purpose', 'explain input purpose', 'explain position meaning', 'explain collider purpose', 'explain asset purpose', 'explain feedback purpose'],
    focus_correctness: ['distinguish updates from drawing', 'distinguish input actions', 'distinguish transform properties', 'distinguish detection from display', 'distinguish asset types', 'predict displayed player values'],
    focus_completeness: ['name two loop activities', 'name two input devices', 'name two transform properties', 'name two collider shapes', 'name two asset types', 'name two displayed player values'],
  },
  medium: {
    focus_clarity: ['explain elapsed-time movement', 'explain press event behavior', 'explain parent transform influence', 'explain query filtering', 'explain transition blending', 'explain cooldown gating'],
    focus_correctness: ['predict speed under explicit update rules', 'compare press events and held checks', 'compare local and world coordinates', 'predict detection under an explicit mask', 'compare blending and instant switching', 'predict timer behavior under explicit pause rules'],
    focus_completeness: ['name two movement comparison observations', 'name two press action cases', 'name two coordinate checks', 'name two filter settings', 'name two transition details', 'name two cooldown conditions'],
  },
  hard: {
    focus_clarity: ['explain snapshot interpolation', 'explain swept collision protection', 'explain per-activation reset safeguards', 'explain invalidated path consequences', 'explain a shading bottleneck', 'explain slow-frame evidence limits'],
    focus_correctness: ['distinguish visual interpolation from simulation advancement', 'predict possible missed collisions under discrete sampling', 'predict reuse under retained timer state', 'predict following a blocked segment without replanning', 'compare draw submission and shading work', 'compare average and tail frame timing evidence'],
    focus_completeness: ['name three visual timing checks', 'name three tunneling test conditions', 'name three activation reset values', 'name three outdated path checks', 'name three rendering bottleneck observations', 'name three benchmark controls'],
  },
};
function focused(base, tier) {
  return { ...base, focusTopics: Object.fromEntries(Object.entries(focusDescriptions[tier]).map(([focus, descriptions]) => [focus, applied(base, descriptions)])) };
}
module.exports = {
  id: 'game-developer', label: 'Game Developer',
  avoidList: `GAME DEVELOPER SCOPE:
- Target students and graduates building small games. Use original spoken questions about gameplay programming, engine concepts, input, transforms, physics, animation, simple AI and measured performance.
- Remain engine-neutral unless the question explicitly names an engine and its relevant behavior. No exact callbacks, code, formulas, matrix calculations, shader syntax, language trivia, engine API recall or required commercial experience.
- Ask one task. Set 1 clarity explains a purpose or mechanism; correctness predicts one outcome or compares related behaviors, never a causal Why task; completeness names two items in easy and medium, three in hard without giving them away.
- A game loop updates state and produces frames; rendering is distinct from simulation. Delta time scales explicitly manual movement expressed as speed per second; do not multiply engine movement APIs twice when they already handle time.
- Fixed physics steps do not guarantee deterministic replay across engines, platforms or floating-point behavior, and do not guarantee catch-up under arbitrary overload. Interpolation smooths displayed poses between completed snapshots; it does not predict the future or change authoritative collision state.
- State whether input is a press edge or a held check, whether action repeats are enabled, and which time source a cooldown uses. Pausing game time does not automatically pause menus, real-time timers or every engine subsystem.
- State coordinate space and relevant parent transform before predicting motion. Normalizing a nonzero direction preserves direction and sets length to one; handle zero input separately. Specify equal orthogonal axis inputs before claiming faster diagonal movement.
- Collision detection and physical response are distinct. A sprite or visible model alone need not have a collider. A trigger may report overlap without blocking motion; engine trigger rules and body requirements vary. For filter outcomes, supply the queried mask and target layer.
- Discrete collision sampling can miss a fast projectile crossing a thin wall between samples; swept or continuous checks reduce this risk but are not universal guarantees. State sample positions or movement constraints if predicting a miss.
- Animation blending smooths a visual transition; it does not automatically change gameplay state, guarantee foot placement or enable attacks. Avoid unspecified transition priority and root-motion assumptions.
- Object pooling trades retained memory and reset complexity for reduced repeated creation and destruction. Reset per-activation values, subscriptions and references when relevant; pooling alone does not prevent all allocations or guarantee better performance. An available pooled object must not still be active elsewhere.
- A navigation path is a planned route, not guaranteed obstacle avoidance. State whether a new obstacle changes traversability, whether collision stops the agent and whether replanning is enabled. No pathfinding algorithm implementation, graph puzzles or broad AI architecture.
- Culling can avoid rendering work but does not necessarily stop gameplay or physics updates. Fewer draw calls do not guarantee faster frames when shading or another subsystem dominates. Supply profiler evidence before selecting an optimization.
- Average frame rate can hide rare slow frames. Compare frame times under matched hardware, build, workload and settings; one profiler sample suggests a cause but does not prove every hitch has that cause.
- No monetization, entire game design, multiplayer authority or rollback networking, advanced GPU pipelines, certification trivia or senior engine architecture. Set 3 stays shared behavioral practice.
- Use the shortest necessary context. Prefer 8 to 18 words in easy, 12 to 24 in medium, 18 to 30 in hard; avoid repeating in a student project.
- Treat differently worded requests for two player values shown on a screen as the same task. Read all history and choose a previously unasked category; use input devices, transform properties, collider shapes or asset types when feedback values were already asked.
- In easy, ask only basic loop updates or rendering. Do not ask numerical speed, elapsed-time scaling or unspecified per-frame movement outcomes. Contrast collision detection with drawing a visible object, not the vague phrase displaying a collision.
- A held button begins with a press edge too. Never imply only tapping produces a press event. A held-state check misses a short tap only if the whole tap occurs between samples and no buffered press event is available; supply those conditions for that diagnosis.
- Every cooldown pause prediction must explicitly say whether its timer uses paused game time or continuing real time. Merely mentioning that both clocks exist does not identify the timer behavior.
- For coordinate reasoning, prefer a parent translation with fixed child local position; state no parent rotation or scaling when asking for a world offset. No numeric coordinate calculation exercises.
- Do not embed the answer by stating that blending eases a transition and then asking which transition is smooth. Ask for the difference in pose changes or explain how blending works.
- For pooling outcomes, state the retained per-object countdown and when it resumes. Avoid delayed callbacks or timers continuing after deactivation unless callback cancellation and ownership are explicitly specified. Prefer the simpler retained lifetime case.
- Snapshot interpolation questions must identify two completed local physics poses and visual smoothing. Do not introduce received network snapshots or unspecified long-frame catch-up behavior. Keep prediction to a single outcome and never append and does, and why or a second question.
- Hard collision outcomes require discrete overlap checks with the projectile outside the wall at both sample positions. Crossing a wall alone does not guarantee a miss for every collision method.
- Ask about known profiler measurements or a bounded check, not what would confirm a unique cause from one frame. Avoid naming an optimization in the premise and then asking for that named optimization.
- Do not ask numeric score or displacement calculations. A coin score cannot be predicted without its starting total; prefer conceptual changes to a current total instead.
- For input clarity, prefer explaining how a press edge permits one activation while held. Do not ask whether a held check misses a quick tap; detection depends on event buffering and sampling details outside this focused explanation.
- For completeness, give only the category and necessary constraints. Never name requested values through a phrase like assuming its health, timers and subscriptions persist; say per-activation state persists instead.
- For hard rendering correctness, compare submission overhead and shading under ONE explicitly measured bottleneck. Do not compare two separate frames or infer a bottleneck from draw counts alone.
- For pooling predictions say the retained lifetime countdown RESUMES on activation. Merely saying the timer was not reset does not establish whether it resumes or is stopped.
- Navigation predictions must supply whether an alternative route exists if asking about detouring. Prefer collision stops the agent and replanning is disabled, then ask one movement outcome.
- Keep one task even when a sentence is phrased as what changes about collision state and displayed pose. Prefer a focused comparison or a single predicted state.
- Do not begin questions with In a student project. Use a direct How or Why explanation when context adds no condition. Supply no more than one short scenario sentence when conditions matter.`,
  difficultyAvoidLists: {
    easy: 'One familiar fact, purpose, distinction or direct action. No timestep mechanics, normalization, coordinate conversion, collision masks, pooling, navigation diagnosis or performance trade-offs.',
    medium: 'One applied mechanism, outcome or check with at most two connected reasoning steps. No simulation interpolation, swept collision, lifecycle reuse faults, rendering bottleneck analysis or senior architecture.',
    hard: 'One bounded advanced-junior mechanism, conditional outcome, evidence limit or trade-off with at most three connected reasoning steps. State timing, sampling, reuse and bottleneck conditions; no full optimization or incident plans.',
  },
  set1: {
    ...medium,
    difficultyTopics: { easy: focused(easy, 'easy'), medium: focused(medium, 'medium'), hard: focused(hard, 'hard') },
    easyExamples, mediumExamples, hardExamples,
  },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: applied(easy, ['explain a frame update or drawing purpose', 'choose a familiar player input action', 'distinguish moving, turning and resizing', 'apply basic collider detection', 'choose a familiar visual or sound asset', 'test visible feedback for a player value']),
      medium: applied(medium, ['apply elapsed-time scaling to manual movement', 'apply a press event to an action that must not repeat', 'reason about parent-relative and world coordinates', 'apply a stated query mask and target layer', 'apply or inspect one animation transition', 'test a cooldown under explicit time and pause rules']),
      hard: applied(hard, ['reason about fixed physics and interpolated display timing', 'evaluate discrete sampling and swept collision for fast objects', 'prevent retained activation state during reuse', 'evaluate a path invalidated by a changed obstacle', 'select rendering changes using stated bottleneck evidence', 'compare controlled frame-time evidence before accepting an optimization']),
    },
    easyExamples: [
      'What does a game loop update during play?',
      'Why does a game need player input?',
      'How does rotating an object differ from changing its scale?',
      'An enabled collider overlaps another detectable collider; what happens during collision detection?',
      'Name two test cases for a score display that must show the current total?',
      'A character needs a flat image for its appearance; which game asset type fits?',
    ],
    mediumExamples: [
      'How does delta time scale movement specified as distance per second?',
      'Why does a press event suit an input action that must fire only once while a key stays held?',
      'How does local position differ from world position when a parent moves?',
      'A collision query mask excludes the target layer; what happens to detection of that target?',
      'Name two test cases for an animation transition controlled by whether a character is moving?',
      'A cooldown must stop counting during pause; what time source should its timer use?',
      'An action repeats throughout a held key despite requiring one activation; what input condition should you check first?',
      'Why would you prefer delta time scaling over a fixed movement distance per frame when rendering rates vary?',
    ],
    hardExamples: [
      'How does interpolation between completed physics snapshots smooth visual motion without advancing collision simulation?',
      'Why does a swept check help a fast projectile that crosses a thin wall between collision samples?',
      'How does pooling differ from repeated creation in retained memory and per-activation reset responsibilities?',
      'A navigation path crosses a newly blocked segment without replanning; what happens when the agent tries to follow it?',
      'Name two rendering checks for whether fewer draw calls address a measured GPU shading bottleneck?',
      'A pooled object retains its previous target reference; what lifecycle action should prevent reuse from affecting that old target?',
      'Average frame rate is stable but rare slow frames interrupt play; what profiler measurement should you check first?',
      'Why would you prefer physics interpolation over raising simulation frequency solely to smooth visuals when simulation cost is already high?',
    ],
  },
};
