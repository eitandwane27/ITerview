import { useEffect, useState, useCallback } from 'react';
import { fetchRoleCatalogue } from '../utils/roleCatalogue';

export default function useRoleCatalogue() {
  const [roles, setRoles] = useState([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetchRoleCatalogue({ signal: controller.signal })
      .then((catalogue) => {
        if (disposed) return;
        setRoles(catalogue);
        setStatus('ready');
      })
      .catch(() => {
        if (!disposed) setStatus('error');
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return { roles, status, retry };
}
