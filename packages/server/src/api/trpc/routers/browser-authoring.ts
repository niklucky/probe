import {
  browserAuthoringIdInputSchema,
  browserAuthoringSessionSchema,
  listBrowserAuthoringInputSchema,
  startBrowserAuthoringInputSchema,
} from '@probe/shared/schemas/browser-authoring';
import { z } from 'zod';
import { protectedProcedure, router } from '../../../trpc';

export const browserAuthoringRouter = router({
  start: protectedProcedure
    .input(startBrowserAuthoringInputSchema)
    .output(browserAuthoringSessionSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.browserAuthoring.start(input, ctx.user.id),
    ),
  get: protectedProcedure
    .input(browserAuthoringIdInputSchema)
    .output(browserAuthoringSessionSchema)
    .query(({ ctx, input }) =>
      ctx.services.browserAuthoring.get(input.id, ctx.user.id),
    ),
  list: protectedProcedure
    .input(listBrowserAuthoringInputSchema)
    .output(z.array(browserAuthoringSessionSchema))
    .query(({ ctx, input }) =>
      ctx.services.browserAuthoring.list(input.testCaseId, ctx.user.id),
    ),
  cancel: protectedProcedure
    .input(browserAuthoringIdInputSchema)
    .output(browserAuthoringSessionSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.browserAuthoring.cancel(input.id, ctx.user.id),
    ),
});
