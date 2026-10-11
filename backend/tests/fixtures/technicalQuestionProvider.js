// Synthetic spoken responses for controller-boundary tests, not a question bank.
function technicalQuestionProvider(prompt, registry, roleId, difficulty, index) {
  const format = prompt.match(/SELECTED QUESTION FORMAT: (\w+)/)?.[1];
  if (!format) return `Generated question ${index}?`;
  // Avoid numeric fixture IDs being mistaken for the requested test-case count.
  index = String.fromCharCode(64 + index);
  const { getRoleSetConfig } = require('../../config/roleConfig');
  const config = getRoleSetConfig(registry[roleId], 'set2', difficulty);
  const selected = prompt.match(/targeting this topic: "([^"]+)"/)[1];
  const topicIndex = config.topicScope.indexOf(selected);
  const term = config.topicKeywords[topicIndex][0];
  if (difficulty === 'hard') {
    // Deliberately synthetic: exercise selected topic/format and persistence,
    // not real technical correctness (covered by the reviewed content tests).
    return {
      concept: `How does the ${term} mechanism protect consistent behavior when operations overlap in application ${index}?`,
      purpose: `Why should ${term} behavior be verified before accepting concurrent operations in application ${index}?`,
      comparison: `How does checking ${term} before saving differ from checking it afterward for concurrent operations in application ${index}?`,
      prediction: `Concurrent operations overlap before ${term} handling finishes in application ${index}; what outcome is possible without coordination?`,
      testing: `Name two test cases for ${term} behavior when concurrent operations overlap in application ${index}?`,
      application: `Overlapping operations must preserve ${term} consistency in application ${index}; what safeguard should coordinate them?`,
      diagnosis: `An operation changes ${term} unexpectedly while a concurrent operation is pending in application ${index}; what should you check first?`,
      decision: `Why would you prefer verifying ${term} before saving over checking it afterward when concurrent operations overlap in application ${index}?`,
    }[format];
  }
  const questions = {
    concept: `What does ${term} mean in this application ${index}?`,
    purpose: `Why is ${term} useful in this application ${index}?`,
    comparison: `How does ${term} differ from another approach in this application ${index}?`,
    prediction: `An application uses the ${term} startup setting; what happens to its initial behavior when the supplied setting changes before startup in application ${index}?`,
    testing: `Name two checks for required ${term} behavior in application ${index}?`,
    application: `An application needs ${term}; what should it do for task ${index}?`,
    diagnosis: `An expected ${term} is absent in application ${index}; what should you check first?`,
    decision: `Why would you prefer checking ${term} before accepting input in application ${index}?`,
  };
  return questions[format];
}

module.exports = { technicalQuestionProvider };
