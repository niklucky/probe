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

export function createServices() {
  const userRepository = createUserRepository();
  const storage = new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number.parseInt(process.env.MINIO_PORT || '11002'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'signal',
    secretKey: process.env.MINIO_SECRET_KEY || 'signal_password',
  });
  return {
    auth: createAuthService(userRepository),
    files: createFileService(
      createFileRepository(),
      storage,
      process.env.MINIO_BUCKET || 'signal-assets',
    ),
    projects: createProjectService(createProjectRepository()),
    products: createProductService(createProductRepository()),
    system: createSystemService(),
    teams: createTeamService(createTeamRepository()),
    testSuites: createTestSuiteService(createTestSuiteRepository()),
    testCases: createTestCaseService(createTestCaseRepository()),
    testRuns: createTestRunService(createTestRunRepository()),
    users: createUserService(userRepository),
  };
}

export type Services = ReturnType<typeof createServices>;

export const services = createServices();
