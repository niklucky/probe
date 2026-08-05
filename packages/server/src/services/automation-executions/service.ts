import type { Client } from 'minio';
import { serverEnv } from '../../env';
import { publicizeStorageUrl } from '../files/public-url';
import { ConflictError, NotFoundError } from '@probe/shared/errors/app-error';
import type { QueueAutomationExecutionInput } from '@probe/shared/schemas/automation-executions';
import type { AutomationExecutionRepository } from '../../repositories/automation-executions/repository';
import type { AuthorizationService } from '../authorization/service';
import type { EnvironmentService } from '../environments/service';
import { extractAutomationEnvironmentReferences } from '@probe/shared/automation-environment';
import { BadRequestError } from '@probe/shared/errors/app-error';

function publicJob<T extends object>(job: T) {
  const artifacts = (
    job as T & {
      artifacts?: Array<{
        objectName: string;
        expiresAt: Date;
        [key: string]: unknown;
      }>;
    }
  ).artifacts;
  if (!artifacts) return job;
  return {
    ...job,
    artifacts: artifacts
      .filter(({ expiresAt }) => expiresAt > new Date())
      .map(({ objectName: _objectName, ...artifact }) => artifact),
  };
}

export interface RunnerDefaults {
  version: string;
  containerImage: string;
  cpuLimit: number;
  memoryMb: number;
  processLimit: number;
  artifactLimitMb: number;
  networkPolicy: string;
}

export function createAutomationExecutionService(
  repository: AutomationExecutionRepository,
  authorization: AuthorizationService,
  environments: EnvironmentService,
  storage: Client,
  bucketName: string,
  runner: RunnerDefaults,
) {
  return {
    async queue(input: QueueAutomationExecutionInput, userId: number) {
      const automation = await repository.findAutomation(input.automationId);
      if (!automation) throw new NotFoundError('Automation not found');
      const projectId = automation.testCase.suite.product.projectId;
      await authorization.requireProject(userId, projectId, 'execute');
      if (automation.status !== 'accepted') {
        throw new ConflictError('Only accepted automation can be executed');
      }
      const profile = await environments.getEnabledProfile(
        input.environmentProfileId,
        automation.environmentId,
        userId,
      );
      const metadata = await environments.listProfileVariableMetadata(
        profile.id,
        userId,
      );
      const { references, hasDynamicReference } =
        extractAutomationEnvironmentReferences(automation.source);
      if (hasDynamicReference) {
        throw new BadRequestError(
          'Automation must use static environment variable references',
        );
      }
      const available = new Set(metadata.map(({ key }) => key));
      const missing = references
        .filter((name) => name !== 'BASE_URL' && !available.has(name))
        .sort();
      if (missing.length) {
        throw new BadRequestError(
          `Automation references variables missing from the selected profile: ${missing.join(', ')}`,
        );
      }

      return repository.create({
        projectId,
        automationId: automation.id,
        environmentId: automation.environmentId,
        environmentProfileId: profile.id,
        environmentProfileName: profile.name,
        environmentProfileRevision: profile.revision,
        requestedById: userId,
        timeoutSeconds: input.timeoutSeconds,
        settings: {
          browser: 'chromium',
          captureVideo: input.captureVideo,
          applyEnvironmentCookies: input.applyEnvironmentCookies,
          applyEnvironmentHeaders: input.applyEnvironmentHeaders,
          runnerVersion: runner.version,
          containerImage: runner.containerImage,
          cpuLimit: runner.cpuLimit,
          memoryMb: runner.memoryMb,
          processLimit: runner.processLimit,
          artifactLimitMb: runner.artifactLimitMb,
          networkPolicy: runner.networkPolicy,
        },
      });
    },

    async list(automationId: number, userId: number) {
      const automation = await repository.findAutomation(automationId);
      if (!automation) throw new NotFoundError('Automation not found');
      await authorization.requireProject(
        userId,
        automation.testCase.suite.product.projectId,
        'read',
      );
      return (await repository.list(automationId)).map(publicJob);
    },

    async get(id: number, userId: number) {
      const job = await repository.find(id);
      if (!job) throw new NotFoundError('Execution not found');
      await authorization.requireProject(userId, job.projectId, 'read');
      return publicJob(job);
    },

    async cancel(id: number, userId: number) {
      const job = await repository.find(id);
      if (!job) throw new NotFoundError('Execution not found');
      await authorization.requireProject(userId, job.projectId, 'execute');
      if (
        [
          'passed',
          'failed',
          'timed_out',
          'cancelled',
          'infrastructure_error',
        ].includes(job.status)
      ) {
        throw new ConflictError('Execution has already finished');
      }
      const updated = await repository.requestCancellation(id);
      if (!updated) throw new ConflictError('Execution has already finished');
      return publicJob(updated);
    },

    async getArtifactUrl(jobId: number, artifactId: number, userId: number) {
      const job = await repository.find(jobId);
      if (!job) throw new NotFoundError('Execution not found');
      await authorization.requireProject(userId, job.projectId, 'read');
      const artifact = await repository.findArtifact(artifactId, jobId);
      if (!artifact || artifact.expiresAt <= new Date()) {
        throw new NotFoundError('Artifact not found or expired');
      }
      return {
        url: publicizeStorageUrl(
          await storage.presignedGetObject(
            bucketName,
            artifact.objectName,
            300,
          ),
          serverEnv.MINIO_PUBLIC_URL,
        ),
        expiresInSeconds: 300,
      };
    },
  };
}
