import { ConflictError, NotFoundError } from '@probe/shared/errors/app-error';
import type { StartBrowserAuthoringInput } from '@probe/shared/schemas/browser-authoring';
import type { BrowserAuthoringRepository } from '../../repositories/browser-authoring/repository';
import type { AuthorizationService } from '../authorization/service';
import type { AiConnectionService } from '../ai-connections/service';
import type { EnvironmentService } from '../environments/service';
import type { TestAutomationRepository } from '../../repositories/test-automations/repository';

export const BROWSER_AUTHORING_PROMPT_VERSION = 'playwright-browser-v1';
export const BROWSER_TOOL_CONTRACT_VERSION = 'semantic-browser-tools-v1';

function publicSession<
  T extends {
    environment?: { name: string };
    sourceTestCaseVersion?: { versionNumber: number };
  },
>(session: T) {
  return {
    ...session,
    environmentName: session.environment?.name ?? '',
    sourceVersionNumber: session.sourceTestCaseVersion?.versionNumber ?? 0,
  };
}

const terminalStatuses = new Set([
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);

export function createBrowserAuthoringService(
  repository: BrowserAuthoringRepository,
  automations: TestAutomationRepository,
  authorization: AuthorizationService,
  aiConnections: AiConnectionService,
  environments: EnvironmentService,
) {
  return {
    async start(input: StartBrowserAuthoringInput, userId: number) {
      await authorization.require(
        userId,
        { type: 'case', id: input.testCaseId },
        'author',
      );
      const testCase = await automations.findTestCase(input.testCaseId);
      const version = await automations.findTestCaseVersion(
        input.sourceTestCaseVersionId,
      );
      if (!testCase || !version || version.testCaseId !== testCase.id) {
        throw new NotFoundError('Accepted test-case version not found');
      }
      if (version.status !== 'ready') {
        throw new ConflictError(
          'Only a ready test-case version can be automated',
        );
      }
      const environment = await environments.get(input.environmentId, userId);
      if (environment.productId !== testCase.suite.productId) {
        throw new NotFoundError('Environment not found');
      }
      const profile = await environments.getEnabledProfile(
        input.environmentProfileId,
        environment.id,
        userId,
      );
      const { connectionRef } = await aiConnections.getAdapter(
        'test-authoring',
        input.connectionId,
      );
      const session = await repository.create({
        projectId: testCase.suite.product.projectId,
        testCaseId: testCase.id,
        sourceTestCaseVersionId: version.id,
        environmentId: environment.id,
        environmentProfileId: profile.id,
        environmentProfileName: profile.name,
        environmentProfileRevision: profile.revision,
        connectionRef,
        promptVersion: BROWSER_AUTHORING_PROMPT_VERSION,
        toolContractVersion: BROWSER_TOOL_CONTRACT_VERSION,
        specification: {
          title: version.title,
          description: version.description,
          prerequisites: version.prerequisites,
          steps: version.steps,
          expectedResult: version.expectedResult,
          tags: version.tags,
        },
        requestedById: userId,
      });
      return publicSession({
        ...session,
        environment,
        sourceTestCaseVersion: version,
      });
    },

    async get(id: number, userId: number) {
      const session = await repository.find(id);
      if (!session)
        throw new NotFoundError('Browser authoring session not found');
      await authorization.requireProject(userId, session.projectId, 'read');
      return publicSession(session);
    },

    async list(testCaseId: number, userId: number) {
      await authorization.require(
        userId,
        { type: 'case', id: testCaseId },
        'read',
      );
      return (await repository.list(testCaseId)).map(publicSession);
    },

    async cancel(id: number, userId: number) {
      const session = await repository.find(id);
      if (!session)
        throw new NotFoundError('Browser authoring session not found');
      await authorization.requireProject(userId, session.projectId, 'author');
      if (terminalStatuses.has(session.status)) {
        throw new ConflictError(
          'Browser authoring session has already finished',
        );
      }
      const updated = await repository.requestCancellation(id);
      if (!updated)
        throw new ConflictError(
          'Browser authoring session has already finished',
        );
      const refreshed = await repository.find(id);
      if (!refreshed)
        throw new NotFoundError('Browser authoring session not found');
      return publicSession(refreshed);
    },
  };
}
