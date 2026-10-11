const FOCUS_KEYS = ['focus_clarity', 'focus_correctness', 'focus_completeness'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function validateRoleConfig(registry) {
  function requireValue(condition, field, expectation) {
    if (!condition) throw new Error(`Invalid role configuration: ${field} ${expectation}`);
  }
  function requireText(value, field) {
    requireValue(
      typeof value === 'string' && value.trim().length > 0,
      field,
      'must be a nonempty string.'
    );
  }
  function requireTexts(value, field) {
    requireValue(Array.isArray(value) && value.length > 0, field, 'must be a nonempty array.');
    value.forEach((text, index) => requireText(text, `${field}[${index}]`));
  }
  function requireTopicScope(topics, field) {
    requireValue(
      topics && typeof topics === 'object' && !Array.isArray(topics),
      field,
      'must be an object.'
    );
    requireTexts(topics.topicScope, `${field}.topicScope`);
    requireValue(
      Array.isArray(topics.topicKeywords) &&
        topics.topicKeywords.length === topics.topicScope.length,
      `${field}.topicKeywords`,
      'must contain one keyword list per topic.'
    );
    topics.topicKeywords.forEach((keywords, index) =>
      requireTexts(keywords, `${field}.topicKeywords[${index}]`)
    );
  }

  requireValue(
    registry && typeof registry === 'object' && !Array.isArray(registry),
    'registry',
    'must be an object.'
  );
  requireValue(
    Object.hasOwn(registry, 'fullstack'),
    'fullstack',
    'is required for the existing fallback.'
  );
  for (const [id, role] of Object.entries(registry)) {
    requireValue(/^[a-z][a-z0-9-]*$/.test(id), id, 'must be a lowercase role ID.');
    requireValue(role && role.id === id, `${id}.id`, 'must match its registry key.');
    requireText(role.label, `${id}.label`);
    requireText(role.avoidList, `${id}.avoidList`);
    if (role.difficultyAvoidLists != null) {
      requireValue(
        typeof role.difficultyAvoidLists === 'object' && !Array.isArray(role.difficultyAvoidLists),
        `${id}.difficultyAvoidLists`,
        'must be an object.'
      );
      for (const [difficulty, text] of Object.entries(role.difficultyAvoidLists)) {
        requireValue(
          DIFFICULTIES.includes(difficulty),
          `${id}.difficultyAvoidLists.${difficulty}`,
          'must be a supported difficulty.'
        );
        requireText(text, `${id}.difficultyAvoidLists.${difficulty}`);
      }
    }
    for (const set of ['set1', 'set2']) {
      const data = role[set];
      const field = `${id}.${set}`;
      requireValue(data && typeof data === 'object', field, 'must be an object.');
      requireTexts(data.topicScope, `${field}.topicScope`);
      requireValue(
        Array.isArray(data.topicKeywords) && data.topicKeywords.length === data.topicScope.length,
        `${field}.topicKeywords`,
        'must contain one keyword list per topic.'
      );
      data.topicKeywords.forEach((keywords, index) =>
        requireTexts(keywords, `${field}.topicKeywords[${index}]`)
      );
      if (data.difficultyTopics != null) {
        requireValue(
          typeof data.difficultyTopics === 'object' && !Array.isArray(data.difficultyTopics),
          `${field}.difficultyTopics`,
          'must be an object.'
        );
      }
      for (const [difficulty, topics] of Object.entries(data.difficultyTopics || {})) {
        const topicField = `${field}.difficultyTopics.${difficulty}`;
        requireValue(
          DIFFICULTIES.includes(difficulty),
          topicField,
          'must be a supported difficulty.'
        );
        requireTopicScope(topics, topicField);
        if (topics.focusTopics != null) {
          requireValue(set === 'set1', `${topicField}.focusTopics`, 'is only supported for Set 1.');
          requireValue(
            typeof topics.focusTopics === 'object' && !Array.isArray(topics.focusTopics),
            `${topicField}.focusTopics`,
            'must be an object.'
          );
          for (const [focus, focusTopics] of Object.entries(topics.focusTopics)) {
            requireValue(
              FOCUS_KEYS.includes(focus),
              `${topicField}.focusTopics.${focus}`,
              'must be a supported focus.'
            );
            requireTopicScope(focusTopics, `${topicField}.focusTopics.${focus}`);
          }
        }
      }
      for (const difficulty of DIFFICULTIES) {
        const examples = data[`${difficulty}Examples`];
        const exampleField = `${field}.${difficulty}Examples`;
        if (set === 'set1') {
          requireValue(
            examples && typeof examples === 'object',
            exampleField,
            'must contain examples for each focus.'
          );
          for (const focus of FOCUS_KEYS) requireTexts(examples[focus], `${exampleField}.${focus}`);
        } else {
          requireTexts(examples, exampleField);
        }
      }
    }
  }
}

module.exports = { validateRoleConfig };
