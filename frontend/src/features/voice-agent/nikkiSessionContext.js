import { createContext, useContext } from 'react';

export const NikkiSessionContext = createContext(null);
export const NikkiVoiceTimeContext = createContext('Voice time');

export function useNikkiSession() {
  const session = useContext(NikkiSessionContext);
  if (!session) throw new Error('Nikki must be inside NikkiSessionProvider.');
  return session;
}
