const express = require('express');
const { isSchoolEmail } = require('../middleware/schoolAuth');
const User = require('../models/User');
const PreTestSession = require('../models/PreTestSession');
const PostTestSession = require('../models/PostTestSession');

const router = express.Router();
const studentFields = 'firebaseUid displayName email officialName -_id';
const dimensions = ['clarity_score', 'correctness_score', 'completeness_score'];

function savedScore(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function assessment(session, percentageField) {
  const percentage = savedScore(session?.[percentageField], 0, 100);
  const scores = dimensions.map((field) => {
    if (percentage === null || !session.answers?.length) return null;
    const values = session.answers.map((answer) => savedScore(answer[field], 1, 5));
    return values.includes(null) ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  });
  return { percentage, clarity: scores[0], correctness: scores[1], completeness: scores[2] };
}

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/session', (_req, res) => res.sendStatus(204));
router.use('/scoring-study', require('./scoringStudyRoutes'));
router.use('/hr-tester', require('./debugRoutes'));

router.get('/research-data', async (req, res) => {
  try {
    const users = await User.find()
      .select('firebaseUid email confidenceScore postConfidenceScore -_id')
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const participants = users.filter(({ firebaseUid, email }) =>
      firebaseUid && firebaseUid !== req.auth.uid && isSchoolEmail(email)
    );
    const filter = { firebaseUid: { $in: participants.map(({ firebaseUid }) => firebaseUid) } };
    const fields = `firebaseUid ${dimensions.map((field) => `answers.${field}`).join(' ')} -_id`;
    const [preTests, postTests] = await Promise.all([
      PreTestSession.find(filter).select(`${fields} baseline_score_percentage`).lean(),
      PostTestSession.find(filter).select(`${fields} final_score_percentage`).lean(),
    ]);
    const preByUid = new Map(preTests.map((session) => [session.firebaseUid, session]));
    const postByUid = new Map(postTests.map((session) => [session.firebaseUid, session]));
    res.json({ participants: participants.map(({ firebaseUid, email, confidenceScore, postConfidenceScore }) => {
      const digits = email.split('@')[0].replace(/\D/g, '');
      return {
        participantId: digits.length >= 4 ? digits.slice(-4) : null,
        email,
        preTest: assessment(preByUid.get(firebaseUid), 'baseline_score_percentage'),
        postTest: assessment(postByUid.get(firebaseUid), 'final_score_percentage'),
        preLikert: savedScore(confidenceScore, 5, 25),
        postLikert: savedScore(postConfidenceScore, 5, 25),
      };
    }) });
  } catch (error) {
    console.error('Could not load research data', error.name);
    res.status(500).json({ message: 'Could not load research data. Please try again.' });
  }
});

router.get('/students', async (_req, res) => {
  try {
    const students = await User.find()
      .select(studentFields)
      .sort({ email: 1, firebaseUid: 1 })
      .lean();
    res.json({ students });
  } catch (error) {
    console.error('Could not load the admin student roster', error.name);
    res.status(500).json({ message: 'Could not load students. Please try again.' });
  }
});

router.patch('/students/:firebaseUid/official-name', async (req, res) => {
  const name = req.body?.officialName;
  if (typeof name !== 'string' || /[\u0000-\u001f\u007f]/u.test(name) || name.trim().length > 160) {
    return res.status(400).json({ message: 'Enter a name of 160 characters or fewer, or leave it blank.' });
  }

  const officialName = name.trim();
  const update = officialName ? { $set: { officialName } } : { $unset: { officialName: '' } };
  try {
    const student = await User.findOneAndUpdate(
      { firebaseUid: req.params.firebaseUid },
      update,
      { returnDocument: 'after', runValidators: true }
    ).select(studentFields).lean();
    if (!student) return res.status(404).json({ message: 'This student account could not be found.' });
    return res.json({ student });
  } catch (error) {
    console.error('Could not save the official name', error.name);
    return res.status(500).json({ message: 'Could not save the official name. Please try again.' });
  }
});

module.exports = router;
