const { createHash } = require('node:crypto');
const SavedQuestion = require('../models/SavedQuestion');
const sessions = [1, 2, 3].map(set => require(`../models/Set${set}Session`));
const { BEHAVIORAL_COMPETENCIES } = require('../config/behavioralInterviewConfig');

const FALLBACK_TIPS = {
  1: 'Answer the specific question first, then add a relevant detail or example.',
  2: 'Explain the concept clearly and cover each part the question asks for.',
  3: 'Use STAR: describe the situation, your task, your own actions, and the result.',
};
function sourceKey(session, set, questionIndex, text) {
  return createHash('sha256').update(JSON.stringify([
    session.attemptId || session.createdAt || String(session._id), set, questionIndex, text,
  ])).digest('hex');
}
function publicQuestion(doc) {
  return { id: String(doc._id), text: doc.text, role: doc.role, set: doc.set,
    questionIndex: doc.questionIndex,
    difficulty: doc.difficulty[0].toUpperCase() + doc.difficulty.slice(1),
    tip: doc.tip || FALLBACK_TIPS[doc.set], savedAt: doc.savedAt };
}
function unavailable(message = 'This question is no longer available in the active interview.') {
  return Object.assign(new Error(message), { status: 409 });
}

function createSavedQuestionService({ Library = SavedQuestion, Sessions = sessions } = {}) {
  async function list(uid) {
    const [questions, ...currentSessions] = await Promise.all([
      Library.find({ firebaseUid: uid, isSaved: true }).sort({ savedAt: -1 }).lean(),
      ...Sessions.map(Model => Model.findOne({ firebaseUid: uid }).lean()),
    ]);
    // A question may be bookmarked before it is answered. Retain its coaching
    // tip once evaluated, so the tip also survives a later new interview run.
    return Promise.all(questions.map(async question => {
      const session = currentSessions[question.set - 1];
      const answer = session?.answers?.find(a => a.questionIndex === question.questionIndex);
      if (answer?.tip && sourceKey(session, question.set, question.questionIndex, answer.question) === question.sourceKey
          && answer.tip !== question.tip) {
        await Library.updateOne({ _id: question._id, firebaseUid: uid }, { $set: { tip: answer.tip } });
        question.tip = answer.tip;
      }
      return publicQuestion(question);
    }));
  }
  async function save(uid, { set, questionIndex, text }) {
    const session = await Sessions[set - 1].findOne({ firebaseUid: uid }).lean();
    const answer = session?.answers?.find(a => a.questionIndex === questionIndex);
    const actualText = session?.questions?.[questionIndex] || answer?.question;
    // Generated future questions are not bookmarkable until revealed.
    if (!session || actualText !== text || questionIndex > (session.answers?.length || 0)) throw unavailable();
    const key = sourceKey(session, set, questionIndex, actualText);
    const snapshot = { set, questionIndex, text: actualText, role: session.role,
      difficulty: session.difficulty, tip: answer?.tip || FALLBACK_TIPS[set],
      competency: set === 3 ? answer?.competency_topic || BEHAVIORAL_COMPETENCIES[questionIndex]?.topic : null,
      isSaved: true };
    let doc;
    try {
      doc = await Library.findOneAndUpdate({ firebaseUid: uid, sourceKey: key },
        { $set: snapshot, $setOnInsert: { savedAt: new Date() } },
        { upsert: true, new: true, runValidators: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      doc = await Library.findOneAndUpdate({ firebaseUid: uid, sourceKey: key }, { $set: snapshot }, { new: true });
    }
    return publicQuestion(doc);
  }
  async function setSaved(uid, id, isSaved) {
    const doc = await Library.findOneAndUpdate({ _id: id, firebaseUid: uid }, { $set: { isSaved } }, { new: true });
    return doc ? publicQuestion(doc) : null;
  }
  async function find(uid, id) {
    return Library.findOne({ _id: id, firebaseUid: uid, isSaved: true }).lean();
  }
  return { list, save, setSaved, find };
}
module.exports = { ...createSavedQuestionService(), createSavedQuestionService, publicQuestion, sourceKey };
