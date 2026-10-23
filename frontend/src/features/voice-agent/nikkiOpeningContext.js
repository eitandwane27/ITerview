import { createContext, useContext } from 'react';

export const NikkiOpeningContext = createContext(null);

export function useNikkiOpening() {
  return useContext(NikkiOpeningContext);
}
