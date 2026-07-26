import { db, eq, products } from '@probe/db';

export function createProductRepository(database = db) {
  return {
    list(projectId: number) {
      return database.query.products.findMany({
        where: eq(products.projectId, projectId),
        orderBy: (table, { asc }) => [asc(table.name)],
      });
    },
    find(id: number) {
      return database.query.products.findFirst({ where: eq(products.id, id) });
    },
    async create(values: typeof products.$inferInsert) {
      const [product] = await database.insert(products).values(values).returning();
      return product;
    },
    async update(id: number, values: Partial<typeof products.$inferInsert>) {
      const [product] = await database
        .update(products)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      return product;
    },
    async delete(id: number) {
      const [product] = await database
        .delete(products)
        .where(eq(products.id, id))
        .returning();
      return product;
    },
  };
}
