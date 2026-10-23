const express = require('express');
const { requireSchoolUser } = require('../middleware/schoolAuth');
const service = require('../services/savedQuestionService');
const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

function createPracticeAgainRouter({ authenticate = requireSchoolUser, library = service } = {}) {
  const router = express.Router();
  router.use(authenticate);
  router.use(express.json({ limit: '8kb' }));
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if ([req.query.uid, req.body?.uid, req.body?.firebaseUid].some(uid => uid && uid !== req.auth.uid)) {
      return res.status(403).json({ error: 'You can only access your own saved questions.' });
    }
    next();
  });
  router.get('/questions', async (req, res, next) => {
    try { res.json({ questions: await library.list(req.auth.uid) }); } catch (error) { next(error); }
  });
  router.post('/questions', async (req, res, next) => {
    const { set, questionIndex, text } = req.body || {};
    if (![1, 2, 3].includes(set) || !Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 4
        || typeof text !== 'string' || !text.trim() || text.length > 4000) {
      return res.status(400).json({ error: 'Choose a revealed interview question to save.' });
    }
    try { res.json({ question: await library.save(req.auth.uid, { set, questionIndex, text }) }); }
    catch (error) { next(error); }
  });
  for (const [method, suffix, isSaved] of [['delete', '', false], ['post', '/restore', true]]) {
    router[method](`/questions/:id${suffix}`, async (req, res, next) => {
      if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid saved question.' });
      try {
        const question = await library.setSaved(req.auth.uid, req.params.id, isSaved);
        if (!question) return res.status(404).json({ error: 'Saved question not found.' });
        res.json({ question });
      } catch (error) { next(error); }
    });
  }
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : error.status || 503;
    res.status(status).json({ error: status === 409 ? error.message : 'Your saved questions could not be updated or loaded. Please try again.' });
  });
  return router;
}
module.exports = createPracticeAgainRouter();
module.exports.createPracticeAgainRouter = createPracticeAgainRouter;
