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
import { createAiConnectionRepository } from '../repositories/ai-connections/repository';
import { createAiConnectionService } from '../services/ai-connections/service';
import { createCredentialCipher } from '../services/ai-connections/encryption';
import { serverEnv } from '../env';

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
  return {
    auth: createAuthService(userRepository),
    files: createFileService(
      createFileRepository(),
      storage,
      serverEnv.MINIO_BUCKET,
      authorization,
    ),
    authorization,
    environments: createEnvironmentService(
      createEnvironmentRepository(),
      authorization,
    ),
    aiConnections: createAiConnectionService(
      createAiConnectionRepository(),
      createCredentialCipher(),
    ),
    projects: createProjectService(createProjectRepository(), authorization),
    products: createProductService(createProductRepository(), authorization),
    system: createSystemService(),
    teams: createTeamService(createTeamRepository(), authorization),
    testSuites: createTestSuiteService(
      createTestSuiteRepository(),
      authorization,
    ),
    testCases: createTestCaseService(createTestCaseRepository(), authorization),
    testRuns: createTestRunService(createTestRunRepository(), authorization),
    users: createUserService(userRepository),
  };
}

export type Services = ReturnType<typeof createServices>;

export const services = createServices();
