import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@probe/trpc';

export const trpc = createTRPCReact<AppRouter>();
