// Sample account data belongs in the API test harness, never in the product.
export const savedQuestions = [
  ['frontend', 1, 'Easy', 'What is the difference between let, const, and var?'],
  ['frontend', 2, 'Medium', 'How would you make a website more accessible?'],
  ['frontend', 1, 'Easy', 'How do you debug a page that feels slow?'],
  ['fullstack', 2, 'Medium', 'Tell me about a challenging technical project.'],
  ['frontend', 1, 'Easy', 'When would you use Flexbox instead of Grid?'],
  ['fullstack', 2, 'Medium', 'How do you handle an API request that fails?'],
  ['backend', 2, 'Medium', 'When would you add an index to a database table?'],
  ['backend', 3, 'Easy', 'Tell me about a time you resolved a technical disagreement with a teammate.'],
].map(([role, set, difficulty, text], index) => ({
  id: String(index + 1).padStart(24, '0'), role, set, difficulty, text, questionIndex: 0,
  tip: 'Answer the question directly, then give one concrete example.',
  savedAt: `2026-10-22T01:00:0${index}Z`,
}));
