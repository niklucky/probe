import { describe, expect, test } from 'bun:test';
import { extractAutomationEnvironmentReferences } from './automation-environment';

describe('automation environment references', () => {
  test('extracts static references with TypeScript syntax awareness', () => {
    expect(
      extractAutomationEnvironmentReferences(`
        const username = process.env /* comment */ . username;
        const password = process.env[
          'password'
        ];
        const example = 'process.env.string_literal';
        // process.env.commented_out
      `),
    ).toEqual({
      references: ['username', 'password'],
      hasDynamicReference: false,
    });
  });

  test('reports dynamic and destructured environment access', () => {
    expect(
      extractAutomationEnvironmentReferences(`
        const dynamic = process.env[key];
        const { username } = process.env;
      `),
    ).toEqual({ references: [], hasDynamicReference: true });
  });
});
