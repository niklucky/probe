import { User } from '@probe/shared';

export interface Context {
  user: User | null;
  [key: string]: unknown;
}

export const createContext = (opts: { user: User | null }): Context => {
  return {
    user: opts.user,
  };
};
