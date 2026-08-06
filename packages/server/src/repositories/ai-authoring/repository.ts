import { aiAuthoringJobs, db, eq, testSuites } from '@probe/db';

type Database = typeof db;

export function createAiAuthoringRepository(database: Database = db) {
  return {
    async findSuiteProductId(id: number) {
      return (
        await database.query.testSuites.findFirst({
          where: eq(testSuites.id, id),
          columns: { productId: true },
        })
      )?.productId;
    },

    async create(values: typeof aiAuthoringJobs.$inferInsert) {
      const [job] = await database
        .insert(aiAuthoringJobs)
        .values(values)
        .returning();
      return job;
    },

    async find(id: number) {
      return database.query.aiAuthoringJobs.findFirst({
        where: eq(aiAuthoringJobs.id, id),
      });
    },

    async complete(
      id: number,
      values: Pick<
        typeof aiAuthoringJobs.$inferInsert,
        | 'connectionRef'
        | 'provider'
        | 'model'
        | 'outputSnapshot'
        | 'latencyMs'
        | 'inputTokens'
        | 'outputTokens'
        | 'totalTokens'
      >,
    ) {
      const [job] = await database
        .update(aiAuthoringJobs)
        .set({
          ...values,
          status: 'completed',
          updatedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        })
        .where(eq(aiAuthoringJobs.id, id))
        .returning();
      return job;
    },

    async fail(id: number, errorCode: string, errorMessage: string) {
      const [job] = await database
        .update(aiAuthoringJobs)
        .set({
          status: 'failed',
          errorCode,
          errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(aiAuthoringJobs.id, id))
        .returning();
      return job;
    },

    async accept(id: number, acceptedById: number) {
      const [job] = await database
        .update(aiAuthoringJobs)
        .set({
          status: 'accepted',
          acceptedById,
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiAuthoringJobs.id, id))
        .returning();
      return job;
    },

    async discard(id: number) {
      const [job] = await database
        .update(aiAuthoringJobs)
        .set({ status: 'discarded', updatedAt: new Date() })
        .where(eq(aiAuthoringJobs.id, id))
        .returning();
      return job;
    },
  };
}

export type AiAuthoringRepository = ReturnType<
  typeof createAiAuthoringRepository
>;
