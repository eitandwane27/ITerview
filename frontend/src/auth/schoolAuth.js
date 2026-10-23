import { createContext, useContext } from 'react';

export const SchoolAuthContext = createContext(null);

export function useSchoolAuth() {
  return useContext(SchoolAuthContext);
}
