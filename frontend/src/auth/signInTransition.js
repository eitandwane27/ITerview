import { createContext, useContext } from 'react';

export const SignInTransitionContext = createContext(null);

export function useSignInTransition() {
  return useContext(SignInTransitionContext);
}
