import { createContext, useContext } from 'react';

export const NikkiSessionContext = createContext(null);

export function useNikkiSession() {
  const session = useContext(NikkiSessionContext);
  if (!session) throw new Error('Nikki must be inside NikkiSessionProvider.');
  return session;
}
