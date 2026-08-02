import { describe, expect, test } from 'bun:test';
import { isRunnableExecutionSnapshot, staleRecoveryValues } from './repository';

describe('abandoned execution recovery', () => {
  test('requeues a stale job when a retry remains', () => {
    const values = staleRecoveryValues({
      attempt: 1,
      maxAttempts: 2,
      claimedAt: new Date('2026-01-01'),
      startedAt: new Date('2026-01-01'),
    });
    expect(values).toMatchObject({
      status: 'queued',
      workerId: null,
      claimedAt: null,
      startedAt: null,
      heartbeatAt: null,
      completedAt: null,
      errorCode: null,
    });
  });

  test('terminates a stale job after its retry budget is exhausted', () => {
    const values = staleRecoveryValues({
      attempt: 2,
      maxAttempts: 2,
      claimedAt: new Date('2026-01-01'),
      startedAt: new Date('2026-01-01'),
    });
    expect(values.status).toBe('infrastructure_error');
    expect(values.errorCode).toBe('WORKER_ABANDONED');
    expect(values.completedAt).toBeInstanceOf(Date);
  });
});

describe('execution snapshot validation', () => {
  const payload = {
    environmentId: 9,
    automation: { id: 7, environmentId: 9, status: 'generated' },
  };

  test('allows generated automation only when linked to its running repair attempt', () => {
    expect(
      isRunnableExecutionSnapshot({
        ...payload,
        repairAttempts: [{ candidateAutomationId: 7, status: 'running' }],
      }),
    ).toBe(true);
    expect(isRunnableExecutionSnapshot(payload)).toBe(false);
    expect(
      isRunnableExecutionSnapshot({
        ...payload,
        repairAttempts: [{ candidateAutomationId: 8, status: 'running' }],
      }),
    ).toBe(false);
  });

  test('continues to allow accepted automation with a matching environment', () => {
    expect(
      isRunnableExecutionSnapshot({
        ...payload,
        automation: { ...payload.automation, status: 'accepted' },
      }),
    ).toBe(true);
    expect(
      isRunnableExecutionSnapshot({
        ...payload,
        automation: {
          ...payload.automation,
          status: 'accepted',
          environmentId: 10,
        },
      }),
    ).toBe(false);
  });
});
