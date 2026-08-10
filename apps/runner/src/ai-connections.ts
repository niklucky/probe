import type { AiConnectionConfig } from '@probe/ai';

export interface RunnerEnvironmentAiConnection extends AiConnectionConfig {
  id: string;
  name: string;
  enabled?: boolean;
  scope?: string;
}

export function loadRunnerEnvironmentAiConnections(value: string) {
  const connections = JSON.parse(value) as Array<
    AiConnectionConfig & {
      name: string;
      enabled?: boolean;
      scope?: string;
    }
  >;
  return connections.map(
    (connection, index): RunnerEnvironmentAiConnection => ({
      ...connection,
      // The API assigns deployment connection references by JSON array index.
      // Recreate that identifier in the isolated runner instead of expecting
      // an undocumented `id` property in AI_CONNECTIONS_JSON.
      id: `env:${index}`,
    }),
  );
}
