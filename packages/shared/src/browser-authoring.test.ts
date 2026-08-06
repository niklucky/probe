import { describe, expect, test } from 'bun:test';
import {
  inspectAutomationLocatorPolicy,
  sanitizeObservedText,
} from './browser-authoring';

describe('browser authoring safety contracts', () => {
  test('redacts credential-like page text without retaining the value', () => {
    expect(sanitizeObservedText('Password: private-value')).toBe('[REDACTED]');
    expect(sanitizeObservedText('Session expired; accept cookie banner')).toBe(
      'Session expired; accept cookie banner',
    );
    expect(sanitizeObservedText('  Sign   in  ')).toBe('Sign in');
  });

  test('rejects invented test IDs and warns about fragile locators', () => {
    const policy = inspectAutomationLocatorPolicy(
      `
        page.getByTestId('observed-save');
        page.getByTestId('invented-delete');
        page.locator('//button').nth(2);
      `,
      ['observed-save'],
    );
    expect(policy.inventedTestIds).toEqual(['invented-delete']);
    expect(policy.warnings).toContain('Raw XPath locator used');
    expect(policy.warnings).toContain('Fragile positional locator used');
  });

  test('reports dynamic locator arguments instead of treating them as verified', () => {
    const policy = inspectAutomationLocatorPolicy(
      `page.getByTestId(testId); page.locator(selector);`,
    );
    expect(policy.hasDynamicTestId).toBe(true);
    expect(policy.warnings).toContain('Dynamic test-ID locator used');
    expect(policy.warnings).toContain('Dynamic raw locator used');
  });
});
