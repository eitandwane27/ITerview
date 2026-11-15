const library = require('../services/savedQuestionService');
const { createDeepgramLiveSession } = require('../services/sttService');
const { synthesizeSpeech } = require('../services/ttsService');
const User = require('../models/User');
const { resolveInterviewerVoice } = require('../config/interviewerVoices');
const { performance } = require('node:perf_hooks');

// Reuse the interview wire protocol and evaluators, with no assessment writes.
function createPracticeAgainHandler({ find = library.find, stt = createDeepgramLiveSession,
  speak = synthesizeSpeech,
  loadVoice = async firebaseUid => (await User.findOne({ firebaseUid }).select('interviewerVoice'))?.interviewerVoice,
  reportTiming = timing => console.info('[PracticeAgain timing]', JSON.stringify(timing)),
  evaluate = async (question, text) => {
    const evaluator = require(`../services/aiSet${question.set}Generator`)[`evaluateSet${question.set}Answer`];
    return evaluator(question.text, text, question.difficulty,
      question.set === 3 ? question.competency : undefined);
  } } = {}) {
  return async function handlePracticeAgainSocket(ws, request) {
    let closed = false, ready = false, busy = false, complete = false, recording = null;
    let transcript = '';
    const send = message => { if (!closed && ws.readyState === ws.OPEN) ws.send(JSON.stringify(message)); };
    const stop = () => { const previous = recording; recording = null; previous?.session?.finish(); };
    const close = () => { closed = true; stop(); };
    ws.on('close', close);
    ws.on('error', close);
    const params = new URL(request.url, 'http://localhost').searchParams;
    const id = params.get('questionId');
    let question;
    try {
      if (!request.auth?.uid || !/^[a-f\d]{24}$/i.test(id || '')) throw new Error('Invalid question');
      question = await find(request.auth.uid, id);
      if (!question) throw new Error('Missing question');
    } catch {
      send({ type: 'error', message: 'This saved question could not be loaded. Return to Practice Again and try again.' });
      ws.close();
      return;
    }
    const savedVoice = await loadVoice(request.auth.uid).catch(() => null);
    const voice = resolveInterviewerVoice(params.get('voice'), savedVoice);
    if (closed) return;
    ws.on('message', async (data, isBinary) => {
      if (closed || complete) return;
      if (isBinary) { recording?.session?.sendAudio(data); return; }
      if (data.length > 24000) { send({ type: 'error', message: 'Please keep your answer under 12,000 characters.' }); return; }
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'stop_recording') { stop(); return; }
      if (!ready || busy) return;
      if (message.type === 'start_recording' && !recording) {
        transcript = '';
        const current = { session: null };
        recording = current;
        const fail = () => {
          if (recording !== current) return;
          stop();
          send({ type: 'error', message: 'Could not connect to speech service. Please try again.' });
        };
        try {
          const session = stt((text, isFinal) => {
            if (recording !== current) return;
            if (isFinal && text) transcript = `${transcript} ${text}`.trim().slice(0, 12000);
            send({ type: 'transcript', text, isFinal });
          }, fail);
          if (recording !== current) { session?.finish(); return; }
          current.session = session;
          if (!session) fail();
        } catch { fail(); }
      } else if (message.type === 'submit_answer') {
        const text = typeof message.final_text === 'string' ? message.final_text.trim() : transcript.trim();
        stop();
        if (!text || text.length > 12000) {
          send({ type: 'error', code: 'EMPTY_ANSWER', message: 'Record an answer of 1–12,000 characters, then submit it.' });
          return;
        }
        busy = true;
        const submittedAt = performance.now();
        send({ type: 'status', message: 'Your coach is evaluating your practice answer...' });
        try {
          const feedback = await evaluate(question, text);
          if (closed) return;
          const evaluatedAt = performance.now();
          reportTiming({ phase: 'evaluation', set: question.set, durationMs: Math.round(evaluatedAt - submittedAt) });
          complete = true;
          send({ ...feedback, type: 'coach_tip' });
          // This standalone answer is finished as soon as evaluation succeeds.
          // MainSets can show feedback and the return action while speech loads.
          send({ type: 'session_complete', audioPending: true });
          const reply = feedback.interviewer_reply || feedback.tip || '';
          const sentences = (reply.match(/[^.!?]+[.!?]*/g) || [reply]).map(sentence => sentence.trim()).filter(Boolean);
          // Match the main sets: synthesize concurrently, deliver in speech
          // order. The first sentence can play before later clips are ready.
          const clips = sentences.map(sentence => Promise.resolve().then(() => {
            if (closed) return null;
            return speak(sentence, voice);
          }).catch(() => null));
          let firstAudioMs = null;
          for (const clip of clips) {
            const audio = await clip;
            if (closed) return;
            if (audio) {
              firstAudioMs ??= Math.round(performance.now() - submittedAt);
              send({ type: 'tts_audio', data: audio.toString('base64') });
            }
          }
          reportTiming({ phase: 'speech', set: question.set, firstAudioMs,
            durationMs: Math.round(performance.now() - evaluatedAt), totalMs: Math.round(performance.now() - submittedAt) });
          send({ type: 'feedback_audio_complete' });
        } catch {
          send({ type: 'error', code: 'EVALUATION_FAILED', message: 'Could not score your answer. Retry evaluation to submit the same answer again.' });
        } finally { busy = false; }
      }
    });
    send({ type: 'session_meta', role: question.role, difficulty: question.difficulty, mode: 'drill', totalQuestions: 1, voice });
    send({ type: 'question_text', text: question.text, index: 1 });
    try {
      const audio = await speak(question.text, voice);
      if (audio) send({ type: 'tts_audio', data: audio.toString('base64') });
    } catch {
      send({ type: 'audio_unavailable', message: 'Read the question above, then record your answer.' });
    }
    ready = true;
    send({ type: 'status', message: 'Question ready. Click Answer to respond.' });
  };
}
module.exports = { handlePracticeAgainSocket: createPracticeAgainHandler(), createPracticeAgainHandler };
