import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSavedQuestions, removePracticeQuestion, restorePracticeQuestion, savePracticeQuestion } from '../utils/practiceAgainApi';

export default function usePracticeBookmarks({ preview, disabled, setNumber, questions, role, difficulty }) {
  const [saved, setSaved] = useState([]);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!preview && !disabled);
  const [updating, setUpdating] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (preview || disabled) return;
    const controller = new AbortController();
    loadSavedQuestions({ signal: controller.signal }).then(questions => {
      if (!controller.signal.aborted) setSaved(questions);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [preview, disabled]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);
  const match = useCallback((index, text) => saved.find(question => question.set === setNumber
    && question.questionIndex === index - 1 && question.text === text
    && (preview || (question.role === role && question.difficulty.toLowerCase() === difficulty))),
  [saved, setNumber, role, difficulty, preview]);
  const toggle = useCallback(async (index, text) => {
    if (!text?.trim() || pending.current || disabled || loading) return;
    pending.current = true;
    setUpdating(true);
    setError('');
    const existing = match(index, text);
    try {
      const question = preview ? existing || { id: `preview-${index}`, set: setNumber, questionIndex: index - 1, text }
        : existing ? await removePracticeQuestion(existing.id) : await savePracticeQuestion(setNumber, index - 1, text);
      if (!mounted.current) return;
      setSaved(current => existing ? current.filter(item => item.id !== existing.id) : [question, ...current]);
      setToast({ id: Date.now(), question, wasSaved: Boolean(existing) });
    } catch (cause) { if (mounted.current) setError(cause.message); }
    finally { pending.current = false; if (mounted.current) setUpdating(false); }
  }, [disabled, loading, match, preview, setNumber]);
  const undo = async () => {
    if (!toast || pending.current) return;
    pending.current = true;
    setUpdating(true);
    setError('');
    try {
      if (!preview) {
        if (toast.wasSaved) await restorePracticeQuestion(toast.question.id);
        else await removePracticeQuestion(toast.question.id);
      }
      if (!mounted.current) return;
      setSaved(current => toast.wasSaved ? [toast.question, ...current.filter(item => item.id !== toast.question.id)]
        : current.filter(item => item.id !== toast.question.id));
      setToast(null);
    } catch (cause) { if (mounted.current) setError(cause.message); }
    finally { pending.current = false; if (mounted.current) setUpdating(false); }
  };
  return { savedQuestionIndexes: questions.filter(question => match(question.index, question.text)).map(question => question.index),
    toggle, undo, toast, dismiss: () => setToast(null), error, busy: loading || updating };
}
