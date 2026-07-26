import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@probe/server';

export const trpc = createTRPCReact<AppRouter>();
