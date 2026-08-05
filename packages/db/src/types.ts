import type {
  aiConnectionAuditLogs,
  aiConnections,
  environments,
  environmentCookies,
  environmentHeaders,
  environmentVariables,
  files,
  products,
  projects,
  teamMembers,
  teams,
  testCases,
  testCaseVersions,
  testResults,
  testRunItems,
  testRuns,
  testSuites,
  testSuiteVersions,
  users,
} from './schema';

export type User = typeof users.$inferSelect;
export type CreateUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type CreateProject = typeof projects.$inferInsert;
export type Product = typeof products.$inferSelect;
export type CreateProduct = typeof products.$inferInsert;
export type Environment = typeof environments.$inferSelect;
export type CreateEnvironment = typeof environments.$inferInsert;
export type EnvironmentVariable = typeof environmentVariables.$inferSelect;
export type CreateEnvironmentVariable =
  typeof environmentVariables.$inferInsert;
export type EnvironmentCookie = typeof environmentCookies.$inferSelect;
export type CreateEnvironmentCookie = typeof environmentCookies.$inferInsert;
export type EnvironmentHeader = typeof environmentHeaders.$inferSelect;
export type CreateEnvironmentHeader = typeof environmentHeaders.$inferInsert;
export type AiConnection = typeof aiConnections.$inferSelect;
export type CreateAiConnection = typeof aiConnections.$inferInsert;
export type AiConnectionAuditLog = typeof aiConnectionAuditLogs.$inferSelect;
export type CreateAiConnectionAuditLog =
  typeof aiConnectionAuditLogs.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type CreateTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type CreateTeamMember = typeof teamMembers.$inferInsert;
export type TestSuite = typeof testSuites.$inferSelect;
export type CreateTestSuite = typeof testSuites.$inferInsert;
export type TestSuiteVersion = typeof testSuiteVersions.$inferSelect;
export type CreateTestSuiteVersion = typeof testSuiteVersions.$inferInsert;
export type TestCase = typeof testCases.$inferSelect;
export type CreateTestCase = typeof testCases.$inferInsert;
export type TestCaseVersion = typeof testCaseVersions.$inferSelect;
export type CreateTestCaseVersion = typeof testCaseVersions.$inferInsert;
export type TestRun = typeof testRuns.$inferSelect;
export type CreateTestRun = typeof testRuns.$inferInsert;
export type TestRunItem = typeof testRunItems.$inferSelect;
export type CreateTestRunItem = typeof testRunItems.$inferInsert;
export type TestResult = typeof testResults.$inferSelect;
export type CreateTestResult = typeof testResults.$inferInsert;
export type FileRecord = typeof files.$inferSelect;
export type CreateFileRecord = typeof files.$inferInsert;
