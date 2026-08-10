import { describe, expect, test } from 'bun:test';
import { loadRunnerEnvironmentAiConnections } from './ai-connections';

describe('runner deployment AI connections', () => {
  test('assigns the same index-based references as the API', () => {
    const connections = loadRunnerEnvironmentAiConnections(
      JSON.stringify([
        {
          name: 'Authoring',
          provider: 'openai',
          model: 'test-model',
          scope: 'test-authoring',
          enabled: true,
        },
      ]),
    );

    expect(connections).toEqual([
      {
        id: 'env:0',
        name: 'Authoring',
        provider: 'openai',
        model: 'test-model',
        scope: 'test-authoring',
        enabled: true,
      },
    ]);
  });
});
