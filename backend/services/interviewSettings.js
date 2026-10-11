const { VALID_ROLES, getRoleMetadata } = require('../config/roleConfig');
const { DIFFICULTIES, resolveSetDifficulty } = require('../config/interviewConfig');

function resolveUserDifficulty(user = {}) {
  const selected = DIFFICULTIES.includes(user.difficulty) ? user.difficulty : 'easy';
  const unlocked = DIFFICULTIES.includes(user.unlockedDifficulty) ? user.unlockedDifficulty : 'easy';
  return DIFFICULTIES.indexOf(selected) <= DIFFICULTIES.indexOf(unlocked) ? selected : unlocked;
}

function requireRegisteredRole(role) {
  if (!VALID_ROLES.includes(role)) {
    const error = new Error('Your target role is unavailable. Choose an available role on the dashboard.');
    error.code = 'INVALID_ROLE';
    throw error;
  }
  return role;
}

function sessionMetadata(role, difficulty, extra = {}) {
  const data = getRoleMetadata(role);
  const fallbackLabel = String(role).split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return { type: 'session_meta', role, roleLabel: data?.label || fallbackLabel,
    roleTopics: data?.setTopics || {}, difficulty, ...extra };
}

module.exports = { resolveUserDifficulty, requireRegisteredRole, sessionMetadata, resolveSetDifficulty };
