export const userRoles = ['admin', 'qa', 'manual_tester', 'viewer'] as const;
export const productTypes = [
  'website',
  'mobile_app',
  'server',
  'api',
  'desktop_app',
  'other',
] as const;
export const testPriorities = ['low', 'medium', 'high', 'critical'] as const;
export const testStatuses = ['draft', 'ready', 'deprecated'] as const;
export const resultStatuses = [
  'passed',
  'failed',
  'skipped',
  'blocked',
  'not_run',
] as const;
