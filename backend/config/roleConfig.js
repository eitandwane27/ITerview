// Central registry for role-specific interview content.
// Edit topics, restrictions, and examples in roles/<roleId>.js.
// guardConfig.js holds shared generation rules; evaluatorRubrics.js holds scoring rules.
//
// To register a new role:
// 1. Create a role file with id, label, avoidList, set1, and set2.
//    Each set contains topicScope, topicKeywords, and difficulty examples.
// 2. Add it to ROLE_CONFIG below. Preserve the desired catalogue order.
// 3. Review content at every difficulty. Optional difficultyTopics and
//    difficultyAvoidLists hold overrides; UI labels and topics use this registry.

const { validateRoleConfig } = require('./validateRoleConfig');
const { SET_DIFFICULTIES } = require('./interviewConfig');

const ROLE_CONFIG = {
  frontend: require('./roles/frontend'),
  backend: require('./roles/backend'),
  fullstack: require('./roles/fullstack'),
  'qa-engineer': require('./roles/qa-engineer'),
  'cyber-security': require('./roles/cyber-security'),
  'network-engineer': require('./roles/network-engineer'),
  'game-developer': require('./roles/game-developer'),
  'ui-ux-developer': require('./roles/ui-ux-developer'),
  android: require('./roles/android'),
  ios: require('./roles/ios'),
  devops: require('./roles/devops'),
  'data-analyst': require('./roles/data-analyst'),
  'ai-engineer': require('./roles/ai-engineer'),
  'it-support': require('./roles/it-support'),
};

// Validate once at module load, before serving requests or starting interviews.
validateRoleConfig(ROLE_CONFIG);

/** Full registry for generators and the public role catalogue. */
module.exports.ROLE_CONFIG = ROLE_CONFIG;

/** Ordered list of registered role IDs. */
module.exports.VALID_ROLES = Object.keys(ROLE_CONFIG);

/** Returns the selected role, preserving the existing Fullstack fallback. */
module.exports.getRoleConfig = function getRoleConfig(role) {
  return Object.hasOwn(ROLE_CONFIG, role) ? ROLE_CONFIG[role] : ROLE_CONFIG.fullstack;
};

/** Public display data; full prompts and calibration examples stay private. */
function getRoleMetadata(roleId) {
  if (!Object.hasOwn(ROLE_CONFIG, roleId)) return null;
  const role = ROLE_CONFIG[roleId];
  const compact = (topics) => [...new Set(topics.map((topic) => topic.split(':')[0].trim()))];
  const setTopics = { set1: compact(role.set1.topicScope), set2: compact(role.set2.topicScope) };
  return {
    id: role.id,
    label: role.label,
    topics: [...new Set([...setTopics.set1, ...setTopics.set2])].slice(0, 8),
    setTopics,
    supportedDifficulties: SET_DIFFICULTIES,
  };
}

module.exports.getRoleMetadata = getRoleMetadata;
module.exports.getRoleCatalogue = () => Object.keys(ROLE_CONFIG).map(getRoleMetadata);

/** Difficulty and optional Set 1 focus scopes inherit the role's common scope. */
module.exports.getRoleSetConfig = function getRoleSetConfig(roleData, set, difficulty, focus) {
  const data = roleData[set];
  const difficultyData = data.difficultyTopics?.[difficulty];
  return {
    ...data,
    ...difficultyData,
    ...(set === 'set1' ? difficultyData?.focusTopics?.[focus] : undefined),
  };
};

module.exports.getRoleRestrictions = function getRoleRestrictions(roleData, difficulty) {
  return [roleData.avoidList, roleData.difficultyAvoidLists?.[difficulty]]
    .filter(Boolean)
    .join('\n');
};
