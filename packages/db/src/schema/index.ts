import { pgEnum, pgTable, serial, varchar, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'qa', 'manual_tester', 'viewer']);
export const productTypeEnum = pgEnum('product_type', ['website', 'mobile_app', 'server', 'api', 'desktop_app', 'other']);
export const testPriorityEnum = pgEnum('test_priority', ['low', 'medium', 'high', 'critical']);
export const testStatusEnum = pgEnum('test_status', ['draft', 'ready', 'deprecated']);
export const resultStatusEnum = pgEnum('result_status', ['passed', 'failed', 'skipped', 'blocked', 'not_run']);

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('viewer'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  avatarType: varchar('avatar_type', {
    length: 50,
    enum: ['predefined', 'custom'],
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Projects table
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  logoUrl: varchar('logo_url', { length: 500 }),
  website: varchar('website', { length: 500 }),
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Products table (belongs to project)
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: productTypeEnum('type').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Teams table
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Team members (junction table)
export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: userRoleEnum('role').notNull().default('viewer'),
  invitedAt: timestamp('invited_at').defaultNow().notNull(),
  joinedAt: timestamp('joined_at'),
}, (table) => ({
  uniqueMember: index('unique_team_member').on(table.teamId, table.userId),
}));

// Test suites with versioning - now linked to products instead of projects
export const testSuites = pgTable('test_suites', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  currentVersionId: integer('current_version_id'), // References test_suite_versions
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Test suite versions
export const testSuiteVersions = pgTable('test_suite_versions', {
  id: serial('id').primaryKey(),
  suiteId: integer('suite_id').references(() => testSuites.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueVersion: index('unique_suite_version').on(table.suiteId, table.versionNumber),
}));

// Test cases with versioning
export const testCases = pgTable('test_cases', {
  id: serial('id').primaryKey(),
  suiteId: integer('suite_id').references(() => testSuites.id, { onDelete: 'cascade' }).notNull(),
  currentVersionId: integer('current_version_id'), // References test_case_versions
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Test case versions
export const testCaseVersions = pgTable('test_case_versions', {
  id: serial('id').primaryKey(),
  testCaseId: integer('test_case_id').references(() => testCases.id, { onDelete: 'cascade' }).notNull(),
  suiteVersionId: integer('suite_version_id').references(() => testSuiteVersions.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  steps: jsonb('steps').$type<string[]>().notNull().default([]),
  expectedResult: text('expected_result'),
  priority: testPriorityEnum('priority').notNull().default('medium'),
  status: testStatusEnum('status').notNull().default('draft'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueVersion: index('unique_test_case_version').on(table.testCaseId, table.versionNumber),
}));

// Test runs
export const testRuns = pgTable('test_runs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  executedById: integer('executed_by_id').references(() => users.id).notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Test run items (which test case versions are in the run)
export const testRunItems = pgTable('test_run_items', {
  id: serial('id').primaryKey(),
  runId: integer('run_id').references(() => testRuns.id, { onDelete: 'cascade' }).notNull(),
  testCaseVersionId: integer('test_case_version_id').references(() => testCaseVersions.id, { onDelete: 'cascade' }).notNull(),
  orderIndex: integer('order_index').notNull(),
}, (table) => ({
  uniqueItem: index('unique_run_item').on(table.runId, table.testCaseVersionId),
}));

// Test results
export const testResults = pgTable('test_results', {
  id: serial('id').primaryKey(),
  runId: integer('run_id').references(() => testRuns.id, { onDelete: 'cascade' }).notNull(),
  testCaseVersionId: integer('test_case_version_id').references(() => testCaseVersions.id, { onDelete: 'cascade' }).notNull(),
  status: resultStatusEnum('status').notNull().default('not_run'),
  notes: text('notes'),
  executedById: integer('executed_by_id').references(() => users.id),
  executedAt: timestamp('executed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueResult: index('unique_test_result').on(table.runId, table.testCaseVersionId),
}));

// File attachments for test cases and test results
export const files = pgTable('files', {
  id: serial('id').primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'test_case_version' or 'test_result'
  entityId: integer('entity_id').notNull(),
  filename: varchar('filename', { length: 500 }).notNull(), // Stored filename in MinIO
  originalName: varchar('original_name', { length: 500 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(), // File size in bytes
  url: varchar('url', { length: 1000 }).notNull(),
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  entityIndex: index('files_entity_index').on(table.entityType, table.entityId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  teamMembers: many(teamMembers),
  testSuites: many(testSuites),
  testCases: many(testCases),
  testRuns: many(testRuns),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [projects.createdById],
    references: [users.id],
  }),
  products: many(products),
  teams: many(teams),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  project: one(projects, {
    fields: [products.projectId],
    references: [projects.id],
  }),
  testSuites: many(testSuites),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  project: one(projects, {
    fields: [teams.projectId],
    references: [projects.id],
  }),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const testSuitesRelations = relations(testSuites, ({ one, many }) => ({
  product: one(products, {
    fields: [testSuites.productId],
    references: [products.id],
  }),
  createdBy: one(users, {
    fields: [testSuites.createdById],
    references: [users.id],
  }),
  versions: many(testSuiteVersions),
  testCases: many(testCases),
}));

export const testSuiteVersionsRelations = relations(testSuiteVersions, ({ one, many }) => ({
  suite: one(testSuites, {
    fields: [testSuiteVersions.suiteId],
    references: [testSuites.id],
  }),
  createdBy: one(users, {
    fields: [testSuiteVersions.createdById],
    references: [users.id],
  }),
  testCases: many(testCaseVersions),
}));

export const testCasesRelations = relations(testCases, ({ one, many }) => ({
  suite: one(testSuites, {
    fields: [testCases.suiteId],
    references: [testSuites.id],
  }),
  createdBy: one(users, {
    fields: [testCases.createdById],
    references: [users.id],
  }),
  versions: many(testCaseVersions),
}));

export const testCaseVersionsRelations = relations(testCaseVersions, ({ one, many }) => ({
  testCase: one(testCases, {
    fields: [testCaseVersions.testCaseId],
    references: [testCases.id],
  }),
  suiteVersion: one(testSuiteVersions, {
    fields: [testCaseVersions.suiteVersionId],
    references: [testSuiteVersions.id],
  }),
  createdBy: one(users, {
    fields: [testCaseVersions.createdById],
    references: [users.id],
  }),
  runItems: many(testRunItems),
  results: many(testResults),
  files: many(files),
}));

export const testRunsRelations = relations(testRuns, ({ one, many }) => ({
  project: one(projects, {
    fields: [testRuns.projectId],
    references: [projects.id],
  }),
  executedBy: one(users, {
    fields: [testRuns.executedById],
    references: [users.id],
  }),
  items: many(testRunItems),
  results: many(testResults),
}));

export const testRunItemsRelations = relations(testRunItems, ({ one }) => ({
  run: one(testRuns, {
    fields: [testRunItems.runId],
    references: [testRuns.id],
  }),
  testCaseVersion: one(testCaseVersions, {
    fields: [testRunItems.testCaseVersionId],
    references: [testCaseVersions.id],
  }),
}));

export const testResultsRelations = relations(testResults, ({ one, many }) => ({
  run: one(testRuns, {
    fields: [testResults.runId],
    references: [testRuns.id],
  }),
  testCaseVersion: one(testCaseVersions, {
    fields: [testResults.testCaseVersionId],
    references: [testCaseVersions.id],
  }),
  executedBy: one(users, {
    fields: [testResults.executedById],
    references: [users.id],
  }),
  files: many(files),
}));

export const filesRelations = relations(files, ({ one }) => ({
  testCaseVersion: one(testCaseVersions, {
    fields: [files.entityId],
    references: [testCaseVersions.id],
  }),
  testResult: one(testResults, {
    fields: [files.entityId],
    references: [testResults.id],
  }),
  createdBy: one(users, {
    fields: [files.createdById],
    references: [users.id],
  }),
}));
