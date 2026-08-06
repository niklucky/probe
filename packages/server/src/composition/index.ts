import { createTestCaseRepository } from '../repositories/test-cases/repository';
import { createTestCaseService } from '../services/test-cases/service';
import { createProjectRepository } from '../repositories/projects/repository';
import { createProjectService } from '../services/projects/service';
import { createTestRunRepository } from '../repositories/test-runs/repository';
import { createTestRunService } from '../services/test-runs/service';
import { createProductRepository } from '../repositories/products/repository';
import { createProductService } from '../services/products/service';
import { createTeamRepository } from '../repositories/teams/repository';
import { createTeamService } from '../services/teams/service';
import { createTestSuiteRepository } from '../repositories/test-suites/repository';
import { createTestSuiteService } from '../services/test-suites/service';
import { createUserRepository } from '../repositories/users/repository';
import { createAuthService } from '../services/auth/service';
import { createUserService } from '../services/users/service';
import { Client } from 'minio';
import { createFileRepository } from '../repositories/files/repository';
import { createFileService } from '../services/files/service';
import { createSystemService } from '../services/system/service';
import { createAuthorizationRepository } from '../repositories/authorization/repository';
import { createAuthorizationService } from '../services/authorization/service';
import { createEnvironmentRepository } from '../repositories/environments/repository';
import { createEnvironmentService } from '../services/environments/service';
import { createEnvironmentVariableCipher } from '../services/environments/encryption';
import { createAiConnectionRepository } from '../repositories/ai-connections/repository';
import { createAiConnectionService } from '../services/ai-connections/service';
import { createCredentialCipher } from '../services/ai-connections/encryption';
import { serverEnv } from '../env';
import { createAiAuthoringRepository } from '../repositories/ai-authoring/repository';
import { createAiAuthoringService } from '../services/ai-authoring/service';
import { createTestAutomationRepository } from '../repositories/test-automations/repository';
import { createTestAutomationService } from '../services/test-automations/service';
import { createAutomationExecutionRepository } from '../repositories/automation-executions/repository';
import { createAutomationExecutionService } from '../services/automation-executions/service';
import { createAutomationRepairRepository } from '../repositories/automation-repairs/repository';
import { createAutomationRepairService } from '../services/automation-repairs/service';
import { createBrowserAuthoringRepository } from '../repositories/browser-authoring/repository';
import { createBrowserAuthoringService } from '../services/browser-authoring/service';

export function createServices() {
  const userRepository = createUserRepository();
  const authorization = createAuthorizationService(
    createAuthorizationRepository(),
  );
  const storage = new Client({
    endPoint: serverEnv.MINIO_ENDPOINT,
    port: serverEnv.MINIO_PORT,
    useSSL: serverEnv.MINIO_USE_SSL,
    accessKey: serverEnv.MINIO_ACCESS_KEY,
    secretKey: serverEnv.MINIO_SECRET_KEY,
  });
  const aiConnections = createAiConnectionService(
    createAiConnectionRepository(),
    createCredentialCipher(),
  );
  const testCases = createTestCaseService(
    createTestCaseRepository(),
    authorization,
  );
  const environments = createEnvironmentService(
    createEnvironmentRepository(),
    authorization,
    createEnvironmentVariableCipher(),
  );
  const runnerDefaults = {
    version: serverEnv.RUNNER_VERSION,
    containerImage: serverEnv.RUNNER_CONTAINER_IMAGE,
    cpuLimit: serverEnv.RUNNER_CPU_LIMIT,
    memoryMb: serverEnv.RUNNER_MEMORY_MB,
    processLimit: serverEnv.RUNNER_PROCESS_LIMIT,
    artifactLimitMb: serverEnv.RUNNER_ARTIFACT_LIMIT_MB,
    networkPolicy: serverEnv.RUNNER_NETWORK_POLICY,
  };
  const testAutomationRepository = createTestAutomationRepository();
  return {
    auth: createAuthService(userRepository),
    files: createFileService(
      createFileRepository(),
      storage,
      serverEnv.MINIO_BUCKET,
      authorization,
    ),
    authorization,
    environments,
    aiConnections,
    aiAuthoring: createAiAuthoringService(
      createAiAuthoringRepository(),
      authorization,
      aiConnections,
      testCases,
      environments,
    ),
    testAutomations: createTestAutomationService(
      testAutomationRepository,
      authorization,
      aiConnections,
      environments,
    ),
    browserAuthoring: createBrowserAuthoringService(
      createBrowserAuthoringRepository(),
      testAutomationRepository,
      authorization,
      aiConnections,
      environments,
    ),
    automationExecutions: createAutomationExecutionService(
      createAutomationExecutionRepository(),
      authorization,
      environments,
      storage,
      serverEnv.RUNNER_ARTIFACT_BUCKET,
      runnerDefaults,
    ),
    automationRepairs: createAutomationRepairService(
      createAutomationRepairRepository(),
      authorization,
      aiConnections,
      runnerDefaults,
    ),
    projects: createProjectService(createProjectRepository(), authorization),
    products: createProductService(createProductRepository(), authorization),
    system: createSystemService(),
    teams: createTeamService(createTeamRepository(), authorization),
    testSuites: createTestSuiteService(
      createTestSuiteRepository(),
      authorization,
    ),
    testCases,
    testRuns: createTestRunService(createTestRunRepository(), authorization),
    users: createUserService(userRepository),
  };
}

export type Services = ReturnType<typeof createServices>;

export const services = createServices();
