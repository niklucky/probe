# AI provider connections

Probe exposes one provider-neutral structured-generation contract through
`@probe/ai`. The server supports OpenAI, Anthropic, and OpenAI-compatible
endpoints. Provider responses are normalized to a JSON value, model, token
usage, capabilities, and latency.

## Deployment configuration

Database-backed credentials require `AI_MASTER_KEY`. It must be either a
base64-encoded 32-byte key or 64 hexadecimal characters. Generate and store it
in the deployment secret manager; changing it makes existing credentials
unreadable. The server fails closed when the key is missing, invalid, or cannot
authenticate stored ciphertext.

Deployment-provided connections can use:

- `OPENAI_MODEL` and optional `OPENAI_API_KEY`
- `ANTHROPIC_MODEL` and optional `ANTHROPIC_API_KEY`
- `AI_CONNECTIONS_JSON` for the full provider-neutral shape

`AI_CONNECTIONS_JSON` is an array:

```json
[
  {
    "name": "Local Kimi",
    "provider": "openai-compatible",
    "endpoint": "http://models.internal:11434/v1",
    "model": "kimi-k2",
    "scope": "general",
    "enabled": true,
    "isDefault": true,
    "apiKey": "deployment-secret",
    "headers": { "x-tenant": "secret-value" },
    "capabilities": ["structured-generation"]
  }
]
```

Deployment-provided connections are read-only. Database connections are
managed through the `aiConnections` tRPC router. Only installation
administrators (`user.role === "admin"`) can list, create, update, delete, or
test connections.

## Endpoint network policy

Custom endpoints must use HTTP(S), cannot contain URL credentials, query
parameters, or fragments, and are checked after DNS resolution. Loopback,
private, link-local, and cloud metadata addresses are blocked by default.

Local model servers require explicit hostname approval in the comma-separated
`AI_APPROVED_LOCAL_HOSTS` variable. Approval is exact by hostname; wildcards are
not supported. Cloud metadata targets remain blocked even when listed.
Approved local OpenAI-compatible servers may omit an API key. Public endpoints
and hosted providers require an API key or custom authentication header.

## Secret handling

API keys and all custom header values are encrypted together using AES-256-GCM
with a fresh nonce. API responses contain only `hasCredentials`; audit records
contain non-secret configuration fields and a `credentialsUpdated` marker.
Provider errors are normalized and truncated, with credential-shaped values
redacted before reaching the client.
