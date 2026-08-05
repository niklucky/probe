import {
  pgEnum,
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'qa',
  'manual_tester',
  'viewer',
]);
export const productTypeEnum = pgEnum('product_type', [
  'website',
  'mobile_app',
  'server',
  'api',
  'desktop_app',
  'other',
]);
export const testPriorityEnum = pgEnum('test_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);
export const testStatusEnum = pgEnum('test_status', [
  'draft',
  'ready',
  'deprecated',
]);
export const resultStatusEnum = pgEnum('result_status', [
  'passed',
  'failed',
  'skipped',
  'blocked',
  'not_run',
]);
export const environmentTypeEnum = pgEnum('environment_type', [
  'local',
  'development',
  'staging',
  'production',
  'custom',
]);
export const aiProviderEnum = pgEnum('ai_provider', [
  'openai',
  'anthropic',
  'openai-compatible',
]);
export const aiConnectionScopeEnum = pgEnum('ai_connection_scope', [
  'general',
  'test-authoring',
  'test-execution',
]);
export const aiAuthoringOperationEnum = pgEnum('ai_authoring_operation', [
  'generate',
  'improve',
]);
export const aiAuthoringJobStatusEnum = pgEnum('ai_authoring_job_status', [
  'running',
  'completed',
  'accepted',
  'discarded',
  'failed',
]);
export const automationFrameworkEnum = pgEnum('automation_framework', [
  'playwright',
]);
export const automationLanguageEnum = pgEnum('automation_language', [
  'typescript',
]);
export const automationStatusEnum = pgEnum('automation_status', [
  'generated',
  'accepted',
  'discarded',
  'failed',
]);
export const automationExecutionStatusEnum = pgEnum(
  'automation_execution_status',
  [
    'queued',
    'claimed',
    'running',
    'passed',
    'failed',
    'timed_out',
    'cancelled',
    'infrastructure_error',
  ],
);
export const automationArtifactKindEnum = pgEnum('automation_artifact_kind', [
  'trace',
  'screenshot',
  'video',
  'log',
]);
export const automationRepairModeEnum = pgEnum('automation_repair_mode', [
  'review',
  'automatic',
]);
export const automationRepairClassificationEnum = pgEnum(
  'automation_repair_classification',
  ['automation', 'product', 'timeout', 'infrastructure', 'unknown'],
);
export const automationRepairStatusEnum = pgEnum('automation_repair_status', [
  'active',
  'awaiting_review',
  'running',
  'succeeded',
  'stopped',
]);
export const automationRepairAttemptStatusEnum = pgEnum(
  'automation_repair_attempt_status',
  ['generated', 'running', 'passed', 'failed', 'rejected'],
);

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
  createdById: integer('created_by_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Products table (belongs to project)
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: productTypeEnum('type').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Network targets used for authoring and, later, controlled browser automation.
// Credentials deliberately do not belong here or in test case text.
export const environments = pgTable(
  'environments',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id').references(() => products.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    type: environmentTypeEnum('type').notNull(),
    baseUrl: varchar('base_url', { length: 2048 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdById: integer('created_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIndex: index('environments_project_index').on(table.projectId),
    productIndex: index('environments_product_index').on(table.productId),
  }),
);

// Values are always encrypted, including variables not marked as secrets. The
// isSecret flag controls disclosure and runtime artifact policy, not storage.
export const environmentVariables = pgTable(
  'environment_variables',
  {
    id: serial('id').primaryKey(),
    environmentId: integer('environment_id')
      .references(() => environments.id, { onDelete: 'cascade' })
      .notNull(),
    key: varchar('key', { length: 128 }).notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    isSecret: boolean('is_secret').notNull().default(false),
    description: varchar('description', { length: 500 }),
    createdById: integer('created_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    environmentIndex: index('environment_variables_environment_index').on(
      table.environmentId,
    ),
    environmentKeyUnique: uniqueIndex(
      'environment_variables_environment_key_unique',
    ).on(table.environmentId, table.key),
  }),
);

// Cookie values remain templates here (for example {{session_id}}). Resolved
// values exist only in runner memory immediately before browser execution.
export const environmentCookies = pgTable(
  'environment_cookies',
  {
    id: serial('id').primaryKey(),
    environmentId: integer('environment_id')
      .references(() => environments.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    valueTemplate: text('value_template').notNull(),
    domain: varchar('domain', { length: 255 }),
    path: varchar('path', { length: 2048 }).notNull().default('/'),
    httpOnly: boolean('http_only').notNull().default(true),
    secure: boolean('secure').notNull().default(true),
    sameSite: varchar('same_site', {
      length: 10,
      enum: ['Strict', 'Lax', 'None'],
    })
      .notNull()
      .default('Lax'),
    expiresAt: timestamp('expires_at'),
    enabled: boolean('enabled').notNull().default(true),
    createdById: integer('created_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    environmentIndex: index('environment_cookies_environment_index').on(
      table.environmentId,
    ),
    definitionUnique: uniqueIndex('environment_cookies_definition_unique').on(
      table.environmentId,
      table.name,
      sql`coalesce(${table.domain}, '')`,
      table.path,
    ),
  }),
);

// Header values remain variable-backed templates here. Resolved values exist
// only in runner memory immediately before browser execution.
export const environmentHeaders = pgTable(
  'environment_headers',
  {
    id: serial('id').primaryKey(),
    environmentId: integer('environment_id')
      .references(() => environments.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    valueTemplate: text('value_template').notNull(),
    origin: varchar('origin', { length: 2048 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdById: integer('created_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    environmentIndex: index('environment_headers_environment_index').on(
      table.environmentId,
    ),
    definitionUnique: uniqueIndex('environment_headers_definition_unique').on(
      table.environmentId,
      sql`lower(${table.name})`,
      table.origin,
    ),
  }),
);

// AI credentials and custom headers are stored only in encryptedConfig. Never
// select this table directly for API responses; the server repository redacts it.
export const aiConnections = pgTable(
  'ai_connections',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    provider: aiProviderEnum('provider').notNull(),
    endpoint: varchar('endpoint', { length: 2048 }),
    model: varchar('model', { length: 255 }).notNull(),
    capabilities: jsonb('capabilities').$type<string[]>().notNull().default([]),
    scope: aiConnectionScopeEnum('scope').notNull().default('general'),
    enabled: boolean('enabled').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    encryptedConfig: text('encrypted_config'),
    hasCredentials: boolean('has_credentials').notNull().default(false),
    createdById: integer('created_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    scopeIndex: index('ai_connections_scope_index').on(
      table.scope,
      table.enabled,
      table.isDefault,
    ),
    oneDefaultPerScope: uniqueIndex('ai_connections_one_default_per_scope')
      .on(table.scope)
      .where(sql`${table.isDefault} = true`),
  }),
);

export const aiConnectionAuditLogs = pgTable(
  'ai_connection_audit_logs',
  {
    id: serial('id').primaryKey(),
    connectionId: integer('connection_id').references(() => aiConnections.id, {
      onDelete: 'set null',
    }),
    actorUserId: integer('actor_user_id')
      .references(() => users.id)
      .notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    changes: jsonb('changes').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    connectionIndex: index('ai_connection_audit_connection_index').on(
      table.connectionId,
    ),
  }),
);

// Teams table
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Team members (junction table)
export const teamMembers = pgTable(
  'team_members',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .references(() => teams.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: userRoleEnum('role').notNull().default('viewer'),
    invitedAt: timestamp('invited_at').defaultNow().notNull(),
    joinedAt: timestamp('joined_at'),
  },
  (table) => ({
    uniqueMember: index('unique_team_member').on(table.teamId, table.userId),
  }),
);

// Test suites with versioning - now linked to products instead of projects
export const testSuites = pgTable('test_suites', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  currentVersionId: integer('current_version_id'), // References test_suite_versions
  createdById: integer('created_by_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Test suite versions
export const testSuiteVersions = pgTable(
  'test_suite_versions',
  {
    id: serial('id').primaryKey(),
    suiteId: integer('suite_id')
      .references(() => testSuites.id, { onDelete: 'cascade' })
      .notNull(),
    versionNumber: integer('version_number').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdById: integer('created_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueVersion: index('unique_suite_version').on(
      table.suiteId,
      table.versionNumber,
    ),
  }),
);

// Test cases with versioning
export const testCases = pgTable('test_cases', {
  id: serial('id').primaryKey(),
  suiteId: integer('suite_id')
    .references(() => testSuites.id, { onDelete: 'cascade' })
    .notNull(),
  currentVersionId: integer('current_version_id'), // References test_case_versions
  createdById: integer('created_by_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Test case versions
export const testCaseVersions = pgTable(
  'test_case_versions',
  {
    id: serial('id').primaryKey(),
    testCaseId: integer('test_case_id')
      .references(() => testCases.id, { onDelete: 'cascade' })
      .notNull(),
    suiteVersionId: integer('suite_version_id')
      .references(() => testSuiteVersions.id, { onDelete: 'cascade' })
      .notNull(),
    versionNumber: integer('version_number').notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    prerequisites: jsonb('prerequisites')
      .$type<string[]>()
      .notNull()
      .default([]),
    steps: jsonb('steps')
      .$type<
        Array<
          | string
          | {
              action: string;
              expectedResult?: string;
            }
        >
      >()
      .notNull()
      .default([]),
    expectedResult: text('expected_result').notNull().default(''),
    priority: testPriorityEnum('priority').notNull().default('medium'),
    status: testStatusEnum('status').notNull().default('draft'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    createdById: integer('created_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueVersion: index('unique_test_case_version').on(
      table.testCaseId,
      table.versionNumber,
    ),
  }),
);

// AI output is kept as an auditable proposal. It never becomes a test-case
// version until an authorized user explicitly accepts a validated spec.
export const aiAuthoringJobs = pgTable(
  'ai_authoring_jobs',
  {
    id: serial('id').primaryKey(),
    operation: aiAuthoringOperationEnum('operation').notNull(),
    status: aiAuthoringJobStatusEnum('status').notNull().default('running'),
    suiteId: integer('suite_id')
      .references(() => testSuites.id, { onDelete: 'cascade' })
      .notNull(),
    testCaseId: integer('test_case_id').references(() => testCases.id, {
      onDelete: 'cascade',
    }),
    connectionRef: varchar('connection_ref', { length: 255 }),
    provider: aiProviderEnum('provider'),
    model: varchar('model', { length: 255 }),
    promptVersion: varchar('prompt_version', { length: 100 }).notNull(),
    inputSnapshot: jsonb('input_snapshot')
      .$type<Record<string, unknown>>()
      .notNull(),
    outputSnapshot: jsonb('output_snapshot').$type<Record<string, unknown>>(),
    latencyMs: integer('latency_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: varchar('error_message', { length: 500 }),
    createdById: integer('created_by_id')
      .references(() => users.id)
      .notNull(),
    acceptedById: integer('accepted_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at'),
  },
  (table) => ({
    suiteIndex: index('ai_authoring_jobs_suite_index').on(table.suiteId),
    testCaseIndex: index('ai_authoring_jobs_test_case_index').on(
      table.testCaseId,
    ),
    creatorIndex: index('ai_authoring_jobs_creator_index').on(
      table.createdById,
      table.createdAt,
    ),
  }),
);

// Automation is versioned independently from the manual specification. Each
// proposal keeps an immutable link to the exact test-case version it came from.
export const testAutomations = pgTable(
  'test_automations',
  {
    id: serial('id').primaryKey(),
    testCaseId: integer('test_case_id')
      .references(() => testCases.id, { onDelete: 'cascade' })
      .notNull(),
    sourceTestCaseVersionId: integer('source_test_case_version_id')
      .references(() => testCaseVersions.id, { onDelete: 'restrict' })
      .notNull(),
    environmentId: integer('environment_id')
      .references(() => environments.id, { onDelete: 'restrict' })
      .notNull(),
    versionNumber: integer('version_number').notNull(),
    framework: automationFrameworkEnum('framework')
      .notNull()
      .default('playwright'),
    language: automationLanguageEnum('language')
      .notNull()
      .default('typescript'),
    status: automationStatusEnum('status').notNull().default('generated'),
    source: text('source').notNull(),
    connectionRef: varchar('connection_ref', { length: 255 }),
    provider: aiProviderEnum('provider'),
    model: varchar('model', { length: 255 }),
    promptVersion: varchar('prompt_version', { length: 100 }).notNull(),
    latencyMs: integer('latency_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    validationError: varchar('validation_error', { length: 500 }),
    createdById: integer('created_by_id')
      .references(() => users.id)
      .notNull(),
    acceptedById: integer('accepted_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at'),
  },
  (table) => ({
    uniqueVersion: uniqueIndex('test_automations_unique_version').on(
      table.testCaseId,
      table.framework,
      table.language,
      table.versionNumber,
    ),
    caseIndex: index('test_automations_case_index').on(
      table.testCaseId,
      table.createdAt,
    ),
    sourceVersionIndex: index('test_automations_source_version_index').on(
      table.sourceTestCaseVersionId,
    ),
  }),
);

// PostgreSQL is the durable queue for runner work. Source and secrets are not
// copied here: a worker loads the immutable accepted automation by id and
// receives secrets only through its process environment.
export const automationExecutionJobs = pgTable(
  'automation_execution_jobs',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    automationId: integer('automation_id')
      .references(() => testAutomations.id, { onDelete: 'restrict' })
      .notNull(),
    environmentId: integer('environment_id')
      .references(() => environments.id, { onDelete: 'restrict' })
      .notNull(),
    status: automationExecutionStatusEnum('status').notNull().default('queued'),
    requestedById: integer('requested_by_id')
      .references(() => users.id)
      .notNull(),
    workerId: varchar('worker_id', { length: 255 }),
    attempt: integer('attempt').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(2),
    timeoutSeconds: integer('timeout_seconds').notNull().default(300),
    settings: jsonb('settings')
      .$type<{
        browser: 'chromium';
        captureVideo: boolean;
        applyEnvironmentCookies: boolean;
        applyEnvironmentHeaders: boolean;
        runnerVersion: string;
        containerImage: string;
        cpuLimit: number;
        memoryMb: number;
        processLimit: number;
        artifactLimitMb: number;
        networkPolicy: string;
      }>()
      .notNull(),
    resultSummary: jsonb('result_summary').$type<{
      tests: number;
      passed: number;
      failed: number;
      durationMs: number;
    }>(),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: varchar('error_message', { length: 1000 }),
    structuredLogs: jsonb('structured_logs')
      .$type<Array<{ at: string; level: string; message: string }>>()
      .notNull()
      .default([]),
    cancellationRequestedAt: timestamp('cancellation_requested_at'),
    claimedAt: timestamp('claimed_at'),
    startedAt: timestamp('started_at'),
    heartbeatAt: timestamp('heartbeat_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    queueIndex: index('automation_execution_jobs_queue_index').on(
      table.status,
      table.createdAt,
    ),
    projectIndex: index('automation_execution_jobs_project_index').on(
      table.projectId,
      table.createdAt,
    ),
    automationIndex: index('automation_execution_jobs_automation_index').on(
      table.automationId,
      table.createdAt,
    ),
  }),
);

export const automationExecutionArtifacts = pgTable(
  'automation_execution_artifacts',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id')
      .references(() => automationExecutionJobs.id, { onDelete: 'cascade' })
      .notNull(),
    kind: automationArtifactKindEnum('kind').notNull(),
    objectName: varchar('object_name', { length: 1000 }).notNull(),
    originalName: varchar('original_name', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: integer('size').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    jobIndex: index('automation_execution_artifacts_job_index').on(table.jobId),
  }),
);

// A repair session is an explicit, bounded request against one failed run.
// Candidate source lives in a new test_automations row and is never copied
// over the accepted automation. Evidence snapshots contain sanitized text and
// artifact metadata only, never object names, artifact bytes, or credentials.
export const automationRepairSessions = pgTable(
  'automation_repair_sessions',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    sourceExecutionId: integer('source_execution_id')
      .references(() => automationExecutionJobs.id, { onDelete: 'restrict' })
      .notNull(),
    sourceAutomationId: integer('source_automation_id')
      .references(() => testAutomations.id, { onDelete: 'restrict' })
      .notNull(),
    requestedById: integer('requested_by_id')
      .references(() => users.id)
      .notNull(),
    mode: automationRepairModeEnum('mode').notNull(),
    classification:
      automationRepairClassificationEnum('classification').notNull(),
    diagnosis: varchar('diagnosis', { length: 1000 }).notNull(),
    status: automationRepairStatusEnum('status').notNull().default('active'),
    connectionRef: varchar('connection_ref', { length: 255 }),
    maxAttempts: integer('max_attempts').notNull(),
    maxTotalTokens: integer('max_total_tokens').notNull(),
    maxDurationMs: integer('max_duration_ms').notNull(),
    usedTokens: integer('used_tokens').notNull().default(0),
    promptVersion: varchar('prompt_version', { length: 100 }).notNull(),
    stopReason: varchar('stop_reason', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    sourceExecutionIndex: index(
      'automation_repair_sessions_execution_index',
    ).on(table.sourceExecutionId, table.createdAt),
    projectIndex: index('automation_repair_sessions_project_index').on(
      table.projectId,
      table.createdAt,
    ),
  }),
);

export const automationRepairAttempts = pgTable(
  'automation_repair_attempts',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .references(() => automationRepairSessions.id, { onDelete: 'cascade' })
      .notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    candidateAutomationId: integer('candidate_automation_id')
      .references(() => testAutomations.id, { onDelete: 'restrict' })
      .notNull(),
    executionJobId: integer('execution_job_id').references(
      () => automationExecutionJobs.id,
      { onDelete: 'restrict' },
    ),
    status: automationRepairAttemptStatusEnum('status')
      .notNull()
      .default('generated'),
    explanation: text('explanation').notNull(),
    sourceDiff: text('source_diff').notNull(),
    changeFingerprint: varchar('change_fingerprint', { length: 64 }).notNull(),
    evidenceSnapshot: jsonb('evidence_snapshot')
      .$type<Record<string, unknown>>()
      .notNull(),
    provider: aiProviderEnum('provider').notNull(),
    model: varchar('model', { length: 255 }).notNull(),
    promptVersion: varchar('prompt_version', { length: 100 }).notNull(),
    latencyMs: integer('latency_ms').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueAttempt: uniqueIndex('automation_repair_attempts_unique_attempt').on(
      table.sessionId,
      table.attemptNumber,
    ),
    fingerprintIndex: index('automation_repair_attempts_fingerprint_index').on(
      table.sessionId,
      table.changeFingerprint,
    ),
  }),
);

// Test runs
export const testRuns = pgTable('test_runs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  executedById: integer('executed_by_id')
    .references(() => users.id)
    .notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Test run items (which test case versions are in the run)
export const testRunItems = pgTable(
  'test_run_items',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .references(() => testRuns.id, { onDelete: 'cascade' })
      .notNull(),
    testCaseVersionId: integer('test_case_version_id')
      .references(() => testCaseVersions.id, { onDelete: 'cascade' })
      .notNull(),
    orderIndex: integer('order_index').notNull(),
  },
  (table) => ({
    uniqueItem: index('unique_run_item').on(
      table.runId,
      table.testCaseVersionId,
    ),
  }),
);

// Test results
export const testResults = pgTable(
  'test_results',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .references(() => testRuns.id, { onDelete: 'cascade' })
      .notNull(),
    testCaseVersionId: integer('test_case_version_id')
      .references(() => testCaseVersions.id, { onDelete: 'cascade' })
      .notNull(),
    status: resultStatusEnum('status').notNull().default('not_run'),
    notes: text('notes'),
    executedById: integer('executed_by_id').references(() => users.id),
    executedAt: timestamp('executed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueResult: index('unique_test_result').on(
      table.runId,
      table.testCaseVersionId,
    ),
  }),
);

// File attachments for test cases and test results
export const files = pgTable(
  'files',
  {
    id: serial('id').primaryKey(),
    entityType: varchar('entity_type', { length: 50 }).notNull(), // 'test_case_version' or 'test_result'
    entityId: integer('entity_id').notNull(),
    filename: varchar('filename', { length: 500 }).notNull(), // Stored filename in MinIO
    originalName: varchar('original_name', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: integer('size').notNull(), // File size in bytes
    url: varchar('url', { length: 1000 }).notNull(),
    createdById: integer('created_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    entityIndex: index('files_entity_index').on(
      table.entityType,
      table.entityId,
    ),
  }),
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  teamMembers: many(teamMembers),
  testSuites: many(testSuites),
  testCases: many(testCases),
  testRuns: many(testRuns),
  aiConnections: many(aiConnections),
  aiConnectionAuditLogs: many(aiConnectionAuditLogs),
  createdAiAuthoringJobs: many(aiAuthoringJobs, {
    relationName: 'aiAuthoringJobCreator',
  }),
  acceptedAiAuthoringJobs: many(aiAuthoringJobs, {
    relationName: 'aiAuthoringJobAcceptor',
  }),
  createdTestAutomations: many(testAutomations, {
    relationName: 'testAutomationCreator',
  }),
  acceptedTestAutomations: many(testAutomations, {
    relationName: 'testAutomationAcceptor',
  }),
  requestedAutomationExecutions: many(automationExecutionJobs),
  requestedAutomationRepairs: many(automationRepairSessions),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [projects.createdById],
    references: [users.id],
  }),
  products: many(products),
  teams: many(teams),
  environments: many(environments),
  automationExecutionJobs: many(automationExecutionJobs),
  automationRepairSessions: many(automationRepairSessions),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  project: one(projects, {
    fields: [products.projectId],
    references: [projects.id],
  }),
  testSuites: many(testSuites),
  environments: many(environments),
}));

export const environmentsRelations = relations(
  environments,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [environments.projectId],
      references: [projects.id],
    }),
    product: one(products, {
      fields: [environments.productId],
      references: [products.id],
    }),
    createdBy: one(users, {
      fields: [environments.createdById],
      references: [users.id],
    }),
    testAutomations: many(testAutomations),
    automationExecutionJobs: many(automationExecutionJobs),
    variables: many(environmentVariables),
    cookies: many(environmentCookies),
    headers: many(environmentHeaders),
  }),
);

export const environmentVariablesRelations = relations(
  environmentVariables,
  ({ one }) => ({
    environment: one(environments, {
      fields: [environmentVariables.environmentId],
      references: [environments.id],
    }),
    createdBy: one(users, {
      fields: [environmentVariables.createdById],
      references: [users.id],
    }),
  }),
);

export const environmentCookiesRelations = relations(
  environmentCookies,
  ({ one }) => ({
    environment: one(environments, {
      fields: [environmentCookies.environmentId],
      references: [environments.id],
    }),
    createdBy: one(users, {
      fields: [environmentCookies.createdById],
      references: [users.id],
    }),
  }),
);

export const environmentHeadersRelations = relations(
  environmentHeaders,
  ({ one }) => ({
    environment: one(environments, {
      fields: [environmentHeaders.environmentId],
      references: [environments.id],
    }),
    createdBy: one(users, {
      fields: [environmentHeaders.createdById],
      references: [users.id],
    }),
  }),
);

export const aiConnectionsRelations = relations(
  aiConnections,
  ({ one, many }) => ({
    createdBy: one(users, {
      fields: [aiConnections.createdById],
      references: [users.id],
    }),
    auditLogs: many(aiConnectionAuditLogs),
  }),
);

export const aiConnectionAuditLogsRelations = relations(
  aiConnectionAuditLogs,
  ({ one }) => ({
    connection: one(aiConnections, {
      fields: [aiConnectionAuditLogs.connectionId],
      references: [aiConnections.id],
    }),
    actor: one(users, {
      fields: [aiConnectionAuditLogs.actorUserId],
      references: [users.id],
    }),
  }),
);

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
  aiAuthoringJobs: many(aiAuthoringJobs),
}));

export const testSuiteVersionsRelations = relations(
  testSuiteVersions,
  ({ one, many }) => ({
    suite: one(testSuites, {
      fields: [testSuiteVersions.suiteId],
      references: [testSuites.id],
    }),
    createdBy: one(users, {
      fields: [testSuiteVersions.createdById],
      references: [users.id],
    }),
    testCases: many(testCaseVersions),
  }),
);

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
  aiAuthoringJobs: many(aiAuthoringJobs),
  automations: many(testAutomations),
}));

export const aiAuthoringJobsRelations = relations(
  aiAuthoringJobs,
  ({ one }) => ({
    suite: one(testSuites, {
      fields: [aiAuthoringJobs.suiteId],
      references: [testSuites.id],
    }),
    testCase: one(testCases, {
      fields: [aiAuthoringJobs.testCaseId],
      references: [testCases.id],
    }),
    createdBy: one(users, {
      fields: [aiAuthoringJobs.createdById],
      references: [users.id],
      relationName: 'aiAuthoringJobCreator',
    }),
    acceptedBy: one(users, {
      fields: [aiAuthoringJobs.acceptedById],
      references: [users.id],
      relationName: 'aiAuthoringJobAcceptor',
    }),
  }),
);

export const testCaseVersionsRelations = relations(
  testCaseVersions,
  ({ one, many }) => ({
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
    automations: many(testAutomations),
  }),
);

export const testAutomationsRelations = relations(
  testAutomations,
  ({ one, many }) => ({
    testCase: one(testCases, {
      fields: [testAutomations.testCaseId],
      references: [testCases.id],
    }),
    sourceTestCaseVersion: one(testCaseVersions, {
      fields: [testAutomations.sourceTestCaseVersionId],
      references: [testCaseVersions.id],
    }),
    environment: one(environments, {
      fields: [testAutomations.environmentId],
      references: [environments.id],
    }),
    createdBy: one(users, {
      fields: [testAutomations.createdById],
      references: [users.id],
      relationName: 'testAutomationCreator',
    }),
    acceptedBy: one(users, {
      fields: [testAutomations.acceptedById],
      references: [users.id],
      relationName: 'testAutomationAcceptor',
    }),
    executionJobs: many(automationExecutionJobs),
    repairSessions: many(automationRepairSessions),
    repairCandidates: many(automationRepairAttempts),
  }),
);

export const automationExecutionJobsRelations = relations(
  automationExecutionJobs,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [automationExecutionJobs.projectId],
      references: [projects.id],
    }),
    automation: one(testAutomations, {
      fields: [automationExecutionJobs.automationId],
      references: [testAutomations.id],
    }),
    environment: one(environments, {
      fields: [automationExecutionJobs.environmentId],
      references: [environments.id],
    }),
    requestedBy: one(users, {
      fields: [automationExecutionJobs.requestedById],
      references: [users.id],
    }),
    artifacts: many(automationExecutionArtifacts),
    repairSourceSessions: many(automationRepairSessions),
    repairAttempts: many(automationRepairAttempts),
  }),
);

export const automationExecutionArtifactsRelations = relations(
  automationExecutionArtifacts,
  ({ one }) => ({
    job: one(automationExecutionJobs, {
      fields: [automationExecutionArtifacts.jobId],
      references: [automationExecutionJobs.id],
    }),
  }),
);

export const automationRepairSessionsRelations = relations(
  automationRepairSessions,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [automationRepairSessions.projectId],
      references: [projects.id],
    }),
    sourceExecution: one(automationExecutionJobs, {
      fields: [automationRepairSessions.sourceExecutionId],
      references: [automationExecutionJobs.id],
    }),
    sourceAutomation: one(testAutomations, {
      fields: [automationRepairSessions.sourceAutomationId],
      references: [testAutomations.id],
    }),
    requestedBy: one(users, {
      fields: [automationRepairSessions.requestedById],
      references: [users.id],
    }),
    attempts: many(automationRepairAttempts),
  }),
);

export const automationRepairAttemptsRelations = relations(
  automationRepairAttempts,
  ({ one }) => ({
    session: one(automationRepairSessions, {
      fields: [automationRepairAttempts.sessionId],
      references: [automationRepairSessions.id],
    }),
    candidateAutomation: one(testAutomations, {
      fields: [automationRepairAttempts.candidateAutomationId],
      references: [testAutomations.id],
    }),
    executionJob: one(automationExecutionJobs, {
      fields: [automationRepairAttempts.executionJobId],
      references: [automationExecutionJobs.id],
    }),
  }),
);

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
