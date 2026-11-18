const { createHash } = require('node:crypto');
const express = require('express');
const { isSchoolEmail } = require('../middleware/schoolAuth');
const User = require('../models/User');
const PreTestSession = require('../models/PreTestSession');
const ScoringStudyResult = require('../models/ScoringStudyResult');

const router = express.Router();
const difficulty = 'easy';
const trialCount = 3;
const dimensions = ['clarity_score', 'correctness_score', 'completeness_score'];
const completed = { $type: 'date' };
const assessmentFields = 'firebaseUid sessionId answers.questionIndex answers.question answers.transcript';

function hash(values) {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

function participantId(email) {
  const digits = email.split('@')[0].replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function sourceResponse(assessment, email, answer) {
  const { questionIndex, question, transcript } = answer;
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 4 ||
      !question?.trim() || !transcript?.trim()) return null;
  const assessmentId = String(assessment._id);
  return {
    id: hash([assessmentId, assessment.sessionId, questionIndex, question, transcript]),
    participantKey: hash([assessmentId]).slice(0, 16),
    participantId: participantId(email),
    assessmentId, questionIndex, question, transcript,
  };
}

function withStatus(source, result) {
  return {
    id: source.id,
    participantKey: source.participantKey,
    participantId: source.participantId,
    assessmentId: source.assessmentId,
    questionIndex: source.questionIndex,
    trialsSaved: result?.trials.length ?? 0,
    rated: Boolean(result?.rating),
  };
}

function responseDetail(source, result, showTrials = false) {
  return {
    ...withStatus(source, result),
    question: source.question,
    transcript: source.transcript,
    trials: showTrials || result?.rating ? result?.trials ?? [] : [],
    rating: result?.rating ?? null,
    ratingRevision: result?.ratingHistory?.length ?? 0,
  };
}

async function loadCohort(adminUid) {
  const users = await User.find({ firebaseUid: { $ne: adminUid } })
    .select('firebaseUid email -_id').sort({ createdAt: 1, _id: 1 }).lean();
  const eligible = new Map(users.filter(({ email }) => isSchoolEmail(email))
    .map(({ firebaseUid, email }) => [firebaseUid, email]));
  const assessments = await PreTestSession.find({
    firebaseUid: { $in: [...eligible.keys()] }, completedAt: completed,
  }).select(assessmentFields).lean();
  const byUid = new Map(assessments.map((assessment) => [assessment.firebaseUid, assessment]));
  const sources = [...eligible].flatMap(([uid, email]) => {
    const assessment = byUid.get(uid);
    return (assessment?.answers ?? []).slice().sort((a, b) => a.questionIndex - b.questionIndex)
      .map((answer) => sourceResponse(assessment, email, answer)).filter(Boolean);
  });
  const results = await ScoringStudyResult.find({ _id: { $in: sources.map(({ id }) => id) } }).lean();
  return { sources, byResponse: new Map(results.map((row) => [row._id, row])) };
}

router.get('/', async (req, res) => {
  const { sources, byResponse } = await loadCohort(req.auth.uid);
  res.json({ trialCount, responses: sources.map((source) => withStatus(source, byResponse.get(source.id))) });
});

router.get('/export', async (req, res) => {
  const { sources, byResponse } = await loadCohort(req.auth.uid);
  const fields = (entry) => dimensions.map((key) => entry?.[key] ?? '');
  const header = [
    'participant_key', 'participant_id', 'response_id', 'pre_test_question', 'difficulty', 'model', 'scoring_protocol',
    ...Array.from({ length: trialCount }, (_, index) => [
      ...dimensions.map((key) => `ai_${index + 1}_${key}`), `ai_${index + 1}_scored_at`,
    ]).flat(),
    'hr_rater_code', ...dimensions.map((key) => `hr_${key}`), 'hr_rated_at',
  ];
  const rows = sources.flatMap((source) => {
    const result = byResponse.get(source.id);
    if (!result?.trials.length && !result?.rating) return [];
    return [[source.participantKey, source.participantId ?? '', source.id, source.questionIndex + 1,
      difficulty, result.modelName, result.protocol,
      ...Array.from({ length: trialCount }, (_, index) => {
        const trial = result.trials[index];
        return [...fields(trial), trial?.scoredAt.toISOString() ?? ''];
      }).flat(),
      result.rating?.raterCode ?? '', ...fields(result.rating), result.rating?.ratedAt.toISOString() ?? '',
    ]];
  });
  // Quote every cell and neutralize formula prefixes in configured identifiers.
  const csv = [header, ...rows].map((row) => row.map((value) => {
    const cell = String(value).replace(/^[\s]*[=+@-]/, "'$&");
    return `"${cell.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n') + '\r\n';
  res.json({ csv });
});

const responsePath = '/:assessmentId/:questionIndex';
router.use(responsePath, async (req, res, next) => {
  const { assessmentId, questionIndex } = req.params;
  if (!/^[a-f0-9]{24}$/.test(assessmentId) || !/^[0-4]$/.test(questionIndex)) {
    return res.status(400).json({ message: 'Choose a saved pre-test response.' });
  }
  const assessment = await PreTestSession.findOne({ _id: assessmentId, completedAt: completed })
    .select(assessmentFields).lean();
  if (assessment && assessment.firebaseUid !== req.auth.uid) {
    const student = await User.findOne({ firebaseUid: assessment.firebaseUid }).select('email -_id').lean();
    const answer = assessment.answers.find((item) => item.questionIndex === Number(questionIndex));
    if (isSchoolEmail(student?.email) && answer) {
      const source = sourceResponse(assessment, student.email, answer);
      if (source) {
        res.locals.studySource = source;
        return next();
      }
    }
  }
  res.status(404).json({ message: 'This completed pre-test response is no longer available.' });
});

router.get(responsePath, async (req, res) => {
  const source = res.locals.studySource;
  const result = await ScoringStudyResult.findById(source.id).lean();
  res.json({ response: responseDetail(source, result, req.query.showTrials === '1') });
});

async function ensureStudyRecord(source) {
  const { create3CScoringRequest } = require('../services/aiEvaluator');
  const request = create3CScoringRequest('', '', difficulty);
  const protocol = hash(request);
  const result = await ScoringStudyResult.findOneAndUpdate(
    { _id: source.id },
    { $setOnInsert: { protocol, modelName: request.model } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  return { protocol, result };
}

router.post(`${responsePath}/trial`, async (req, res) => {
  const source = res.locals.studySource;
  const showTrials = req.query.showTrials === '1';
  const { id, trial } = req.body ?? {};
  if (id !== source.id) return res.status(409).json({ message: 'The response changed. Open it again.' });
  if (!Number.isInteger(trial) || trial < 1 || trial > trialCount) {
    return res.status(400).json({ message: 'Choose a valid AI trial.' });
  }
  const { protocol, result } = await ensureStudyRecord(source);
  if (result.trials.length >= trial) return res.json({ response: responseDetail(source, result, showTrials) });
  if (result.trials.length !== trial - 1) return res.status(409).json({ message: 'Run the AI trials in order.' });
  if (result.protocol !== protocol) {
    return res.status(409).json({ message: 'The AI scoring settings changed after this response entered the study.' });
  }

  let scores;
  try {
    const { evaluate3CScores } = require('../services/aiEvaluator');
    scores = await evaluate3CScores(source.question, source.transcript, difficulty, { timeout: 20000, maxRetries: 0 });
  } catch {
    return res.status(502).json({ message: 'The AI scorer could not finish this trial. Retry to continue.' });
  }
  const saved = await ScoringStudyResult.findOneAndUpdate({
    _id: source.id, [`trials.${trial - 1}`]: { $exists: false },
  }, { $push: { trials: { ...scores, scoredAt: new Date() } } },
  { returnDocument: 'after', runValidators: true }).lean();
  res.json({ response: responseDetail(source, saved ?? await ScoringStudyResult.findById(source.id).lean(), showTrials) });
});

async function saveRating(req, res) {
  const source = res.locals.studySource;
  const { id, scores, revision } = req.body ?? {};
  if (id !== source.id) return res.status(409).json({ message: 'The response changed. Open it again.' });
  if (!dimensions.every((key) => Number.isInteger(scores?.[key]) && scores[key] >= 1 && scores[key] <= 5)) {
    return res.status(400).json({ message: 'Enter a whole-number score from 1 to 5 for each criterion.' });
  }
  const rating = { ...Object.fromEntries(dimensions.map((key) => [key, scores[key]])), ratedAt: new Date() };
  const filter = { _id: source.id, rating: null };
  const update = { $set: { rating } };
  const correcting = req.method === 'PATCH';
  const conflictMessage = correcting
    ? 'The saved HR rating changed. Refresh the study before correcting it.'
    : 'An HR rating is already saved for this response. Open it again.';

  if (correcting) {
    if (!Number.isSafeInteger(revision) || revision < 0) {
      return res.status(400).json({ message: 'Refresh the study before correcting this rating.' });
    }
    const current = await ScoringStudyResult.findById(source.id).lean();
    if (!current?.rating || (current.ratingHistory?.length ?? 0) !== revision) {
      return res.status(409).json({ message: conflictMessage });
    }
    if (dimensions.every((key) => current.rating[key] === rating[key])) {
      return res.json({ response: responseDetail(source, current) });
    }
    if (current.rating.raterCode !== undefined) rating.raterCode = current.rating.raterCode;
    filter.rating = { $ne: null };
    filter[`ratingHistory.${revision}`] = { $exists: false };
    update.$push = { ratingHistory: {
      previousRating: current.rating,
      correctedAt: rating.ratedAt,
      correctedBy: req.auth.uid,
    } };
  } else {
    await ensureStudyRecord(source);
  }

  const saved = await ScoringStudyResult.findOneAndUpdate(filter, update,
    { returnDocument: 'after', runValidators: true }).lean();
  if (!saved) return res.status(409).json({ message: conflictMessage });
  res.json({ response: responseDetail(source, saved) });
}

router.route(`${responsePath}/rating`).post(saveRating).patch(saveRating);

router.use((error, _req, res, _next) => {
  console.error('[Scoring Study] Request failed', error.name);
  res.status(500).json({ message: 'The scoring study could not save or load data. Try again.' });
});

module.exports = router;
