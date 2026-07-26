import type { User } from '@probe/shared';
import type { Services } from './composition';

export interface Context {
  user: User | null;
  services: Services;
  [key: string]: unknown;
}

export const createContext = (opts: Context): Context => opts;
