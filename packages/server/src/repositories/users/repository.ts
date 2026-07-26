import { db, eq, like, users } from '@probe/db';

const publicColumns = {
  id: true,
  email: true,
  name: true,
  role: true,
  avatarUrl: true,
  avatarType: true,
  createdAt: true,
  updatedAt: true,
} as const;
const publicReturning = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  avatarUrl: users.avatarUrl,
  avatarType: users.avatarType,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export function createUserRepository(database = db) {
  return {
    findById(id: number) {
      return database.query.users.findFirst({ where: eq(users.id, id) });
    },
    findPublicById(id: number) {
      return database.query.users.findFirst({
        where: eq(users.id, id),
        columns: publicColumns,
      });
    },
    findByEmail(email: string) {
      return database.query.users.findFirst({ where: eq(users.email, email) });
    },
    async create(values: typeof users.$inferInsert) {
      const [user] = await database
        .insert(users)
        .values(values)
        .returning(publicReturning);
      return user;
    },
    async updatePublic(id: number, values: Partial<typeof users.$inferInsert>) {
      const [user] = await database
        .update(users)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning(publicReturning);
      return user;
    },
    async updatePassword(id: number, passwordHash: string) {
      await database
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, id));
    },
    search(query: string, limit: number) {
      return database.query.users.findMany({
        where: like(users.email, `%${query}%`),
        columns: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
        limit,
      });
    },
  };
}
