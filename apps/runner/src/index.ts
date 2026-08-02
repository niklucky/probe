import { Client } from 'minio';
import { basename } from 'node:path';
import { runnerConfig } from './config';
import {
  artifactMetadata,
  cleanupAbandonedExecution,
  executeInContainer,
  listArtifactFiles,
  selectRuntimeSecrets,
  stat,
} from './executor';
import {
  createRunnerRepository,
  isRunnableExecutionSnapshot,
} from './repository';

const repository = createRunnerRepository();
const storage = new Client({
  endPoint: runnerConfig.MINIO_ENDPOINT,
  port: runnerConfig.MINIO_PORT,
  useSSL: runnerConfig.MINIO_USE_SSL,
  accessKey: runnerConfig.MINIO_ACCESS_KEY,
  secretKey: runnerConfig.MINIO_SECRET_KEY,
});

async function uploadArtifacts(
  jobId: number,
  directory: string,
  retentionDays: number,
) {
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  const rows = [];
  for (const path of await listArtifactFiles(directory)) {
    const metadata = artifactMetadata(path);
    if (!metadata) continue;
    const file = await stat(path);
    const originalName = basename(path);
    const objectName = `automation-executions/${jobId}/${crypto.randomUUID()}-${originalName}`;
    await storage.fPutObject(
      runnerConfig.MINIO_ARTIFACT_BUCKET,
      objectName,
      path,
      { 'Content-Type': metadata.mimeType },
    );
    rows.push({
      jobId,
      objectName,
      originalName,
      kind: metadata.kind,
      mimeType: metadata.mimeType,
      size: file.size,
      expiresAt,
    });
  }
  await repository.createArtifacts(rows);
}

async function runClaimedJob(jobId: number) {
  const payload = await repository.getPayload(jobId);
  if (!payload) return;
  if (payload.cancellationRequestedAt) {
    await repository.finish(jobId, runnerConfig.RUNNER_ID, {
      status: 'cancelled',
      errorCode: 'EXECUTION_CANCELLED',
      errorMessage: 'Execution was cancelled before it started',
      structuredLogs: [],
    });
    return;
  }
  if (!isRunnableExecutionSnapshot(payload)) {
    await repository.finish(jobId, runnerConfig.RUNNER_ID, {
      status: 'infrastructure_error',
      errorCode: 'INVALID_EXECUTION_SNAPSHOT',
      errorMessage:
        'Automation is neither accepted nor an active repair candidate, or its environment no longer matches',
      structuredLogs: [],
    });
    return;
  }
  if (!(await repository.start(jobId, runnerConfig.RUNNER_ID))) return;

  const result = await executeInContainer(
    payload,
    selectRuntimeSecrets(
      payload.automation.source,
      runnerConfig.RUNNER_TEST_SECRETS_JSON,
    ),
    {
      heartbeat: async () =>
        Boolean(
          (await repository.heartbeat(jobId, runnerConfig.RUNNER_ID))
            ?.cancellationRequestedAt,
        ),
    },
  );
  try {
    await uploadArtifacts(
      jobId,
      result.artifactDirectory,
      runnerConfig.RUNNER_ARTIFACT_RETENTION_DAYS,
    );
  } catch (error) {
    result.status = 'infrastructure_error';
    result.errorCode = 'ARTIFACT_UPLOAD_FAILED';
    result.errorMessage =
      'Execution finished but protected artifacts could not be stored';
    result.logs.push({
      at: new Date().toISOString(),
      level: 'error',
      message: 'Artifact upload failed',
    });
    console.error('Artifact upload failed', error);
  } finally {
    await result
      .cleanup()
      .catch((error) =>
        console.error(`Failed to clean execution ${jobId} workspace`, error),
      );
  }
  await repository.finish(jobId, runnerConfig.RUNNER_ID, {
    status: result.status,
    resultSummary: result.summary,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    structuredLogs: result.logs,
  });
}

async function cleanExpiredArtifacts() {
  const artifacts = await repository.expiredArtifacts(new Date());
  let removed = 0;
  for (const artifact of artifacts) {
    try {
      await storage.removeObject(
        runnerConfig.MINIO_ARTIFACT_BUCKET,
        artifact.objectName,
      );
      await repository.deleteArtifact(artifact.id);
      removed += 1;
    } catch (error) {
      console.error(`Failed to remove expired artifact ${artifact.id}`, error);
    }
  }
  if (removed) {
    console.log(`Removed ${removed} expired artifact(s)`);
  }
}

async function main() {
  console.log(`Probe automation runner ${runnerConfig.RUNNER_ID} started`);
  let lastRecovery = 0;
  let lastCleanup = 0;
  for (;;) {
    if (Date.now() - lastRecovery > runnerConfig.RUNNER_STALE_SECONDS * 1000) {
      const before = new Date(
        Date.now() - runnerConfig.RUNNER_STALE_SECONDS * 1000,
      );
      const recovered = await repository.recoverStale(
        before,
        runnerConfig.RUNNER_ID,
        cleanupAbandonedExecution,
      );
      if (recovered) console.log(`Recovered ${recovered} abandoned job(s)`);
      lastRecovery = Date.now();
    }
    if (Date.now() - lastCleanup > 60 * 60 * 1000) {
      await cleanExpiredArtifacts();
      lastCleanup = Date.now();
    }
    const job = await repository.claim(runnerConfig.RUNNER_ID);
    if (job) {
      await runClaimedJob(job.id);
    } else {
      await Bun.sleep(runnerConfig.RUNNER_POLL_MS);
    }
  }
}

main().catch((error) => {
  console.error('Runner stopped', error);
  process.exit(1);
});
