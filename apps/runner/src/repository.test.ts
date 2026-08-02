import { describe, expect, test } from 'bun:test';
import { staleRecoveryValues } from './repository';

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
