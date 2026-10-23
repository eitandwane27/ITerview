import { authenticatedFetch } from './authenticatedApi';

const BASE = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/practice-again/questions`;
async function request(path = '', options = {}) {
  const response = await authenticatedFetch(`${BASE}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Your saved questions could not be loaded. Please try again.');
  return data;
}
export async function loadSavedQuestions(options) {
  const { questions } = await request('', options);
  if (!Array.isArray(questions)) throw new Error('Your saved questions could not be loaded. Please try again.');
  return questions;
}
export async function savePracticeQuestion(set, questionIndex, text) {
  return (await request('', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set, questionIndex, text }) })).question;
}
export async function removePracticeQuestion(id) {
  return (await request(`/${encodeURIComponent(id)}`, { method: 'DELETE' })).question;
}
export async function restorePracticeQuestion(id) {
  return (await request(`/${encodeURIComponent(id)}/restore`, { method: 'POST' })).question;
}
