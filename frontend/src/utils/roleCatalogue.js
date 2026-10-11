export async function fetchRoleCatalogue({ signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl('/api/recommendations/roles', { signal });
  if (!response.ok) throw new Error('Could not load target roles.');
  const data = await response.json();
  if (!Array.isArray(data.roles) || data.roles.length === 0) {
    throw new Error('No target roles are available.');
  }
  const ids = new Set();
  return data.roles.map((role) => {
    if (!role || typeof role.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(role.id) ||
        typeof role.label !== 'string' || !role.label.trim() || ids.has(role.id)) {
      throw new Error('Invalid target role catalogue.');
    }
    ids.add(role.id);
    const result = { id: role.id, label: role.label };
    const readTopics = (topics) => {
      if (!Array.isArray(topics) || topics.some(topic => typeof topic !== 'string' || !topic.trim())) {
        throw new Error('Invalid target role topics.');
      }
      return topics;
    };
    if (role.topics != null) result.topics = readTopics(role.topics);
    if (role.setTopics != null) {
      result.setTopics = {};
      for (const set of ['set1', 'set2']) {
        result.setTopics[set] = readTopics(role.setTopics[set]);
      }
    }
    if (role.supportedDifficulties != null) {
      result.supportedDifficulties = {};
      for (const set of ['set1', 'set2', 'set3']) {
        const values = role.supportedDifficulties[set];
        if (!Array.isArray(values) || !values.length || values.some(value => !['easy', 'medium', 'hard'].includes(value))) {
          throw new Error('Invalid target role difficulties.');
        }
        result.supportedDifficulties[set] = values;
      }
    }
    return result;
  });
}

export function formatRoleLabel(value, roles = []) {
  if (!value) return 'Target role';
  return roles.find((role) => role.id === value)?.label ||
    String(value).split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function getRoleTopics(roleId, roles = [], setNumber = 1) {
  const role = roles.find(item => item.id === roleId);
  return role?.setTopics?.[`set${setNumber}`] || role?.topics || [];
}

export function getRoleOptions(roles, status, savedRole = '') {
  const placeholder = status === 'loading' ? 'Loading roles…' :
    status === 'error' ? 'Roles unavailable' : 'Select a role...';
  const options = [{ value: '', label: placeholder, disabled: true },
    ...roles.map((role) => ({ value: role.id, label: role.label }))];
  if (savedRole && !roles.some((role) => role.id === savedRole)) {
    options.push({ value: savedRole, label: `${formatRoleLabel(savedRole)} (${status === 'ready' ? 'unavailable' : 'saved role'})`, disabled: true });
  }
  return options;
}

export function getRoleSelectionError(roleId, roles, status) {
  if (!roleId) return 'Select a target role to continue.';
  if (status !== 'ready') return 'Target roles are not available yet. Please retry loading them.';
  if (!roles.some((role) => role.id === roleId)) return 'Choose an available target role to continue.';
  return null;
}
