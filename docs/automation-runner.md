# Isolated asynchronous automation runner

Probe executes accepted Playwright TypeScript automations through a separate
worker (`apps/runner`). The API only validates authorization and inserts a
durable PostgreSQL job; it never imports or evaluates automation source.

## Local setup

1. Start PostgreSQL and MinIO with `docker compose -f compose.local.yml up -d`.
2. Build the immutable execution image with `bun run runner:image:build`.
3. Create a dedicated Docker network named `probe-runner-egress` and apply the
   host firewall/egress policy described below.
4. Create `apps/runner/.env` from `apps/runner/.env.example`. Use the same
   `ENVIRONMENT_VARIABLES_MASTER_KEY`, `AI_MASTER_KEY`,
   `AI_APPROVED_LOCAL_HOSTS`, and `AI_CONNECTIONS_JSON` values as the API.
   Deployment-backed AI references such as `env:0` are resolved independently
   by the worker and fail closed when its connection list differs from the API.
5. Start the API/web processes, then run the worker separately with
   `bun run runner:dev`.

The worker needs access to the Docker daemon. The API process must not receive
that access.

## Job lifecycle and recovery

Jobs transition through `queued`, `claimed`, `running`, and exactly one of
`passed`, `failed`, `timed_out`, `cancelled`, or `infrastructure_error`.
Claiming uses a PostgreSQL transaction with `FOR UPDATE SKIP LOCKED`, so two
workers cannot claim the same row. A worker heartbeats while Docker runs.
Another worker moves an abandoned job back to `queued`; after `maxAttempts`, it
finishes it as `infrastructure_error`. Before retrying, the recovering worker
force-removes the abandoned job's named container and temporary workspace.
Queued and claimed cancellation is immediate, while running cancellation stops
the disposable container.

Execution settings persist with every job, including the exact automation id,
environment id, runner version, image, timeout, CPU, memory, PID, video, and
network-policy values.

## Isolation and network policy

The runner launches one disposable, unprivileged container per job with:

- a read-only root filesystem and read-only source mount;
- dropped Linux capabilities and `no-new-privileges`;
- fixed CPU, memory/memory-swap, PID, tmpfs, and wall-clock limits;
- no host filesystem mount other than one source file and one artifact folder;
- a dedicated Docker network from `RUNNER_NETWORK_POLICY`.

Production operators must make that Docker network an egress-controlled bridge.
Its firewall rules should deny RFC1918, link-local, metadata
(`169.254.169.254`), Docker host, and arbitrary internet access, and allow only
the origins represented by approved project environments (normally through an
allow-listing HTTP proxy). Do not use the default `bridge` or `host` network.
Environment creation already rejects unsafe target URLs according to Probe's
environment network policy; the Docker firewall remains the enforcement
boundary for generated code.

## Secrets and artifacts

At execution time the worker loads encrypted variables from the job's selected
environment, decrypts only names explicitly referenced as `process.env.NAME`
in accepted source or environment cookie/header templates, and forwards them to
Docker by environment-variable _name_. Unrelated environment variables are not
loaded or injected. Values are never persisted in source, job rows, or process
arguments.
Logs and errors are redacted. Trace, screenshot, and video capture is disabled
by default for executions with runtime secrets because browser artifacts can
contain DOM and input values. An author can explicitly enable visual
diagnostics for a run; those sensitive failure artifacts use the same private
bucket, authorization checks, expiring download URLs, and retention policy as
other execution artifacts.

Environment header templates are resolved during runner preflight and passed to
the container through inherited process environment only. The Playwright hook
matches the exact request origin and fetches one redirect hop at a time, so a
cross-origin redirect is evaluated as a new request and cannot inherit custom
headers. Browser- and transport-managed header names are rejected before a
definition is stored and again before execution.

Artifacts are written to the private `signal-runner-artifacts` bucket. The API
checks project membership before issuing a five-minute download URL; object
names are never returned by list/get procedures. Artifact metadata expires
after `RUNNER_ARTIFACT_RETENTION_DAYS` (14 days by default). Deployments should
configure a matching MinIO lifecycle rule to delete objects under
`automation-executions/` after that period.

`MINIO_PUBLIC_URL` must be an origin without a path (for example,
`https://storage.example.com`) that the user's browser can reach. The API uses
that origin when signing artifact downloads; `MINIO_ENDPOINT` remains the
runner/API's internal MinIO address.

## Operational configuration

API:

- `RUNNER_VERSION`
- `RUNNER_CONTAINER_IMAGE`
- `RUNNER_CPU_LIMIT`
- `RUNNER_MEMORY_MB`
- `RUNNER_PROCESS_LIMIT`
- `RUNNER_ARTIFACT_LIMIT_MB`
- `RUNNER_NETWORK_POLICY`
- `RUNNER_ARTIFACT_BUCKET`
- `MINIO_PUBLIC_URL`, set to the browser-reachable MinIO origin

Worker:

- `RUNNER_ID`, `RUNNER_POLL_MS`, `RUNNER_STALE_SECONDS`
- `RUNNER_ARTIFACT_RETENTION_DAYS`
- the same `RUNNER_VERSION`, execution image, resource-limit, and dedicated
  network settings used by the API; browser authoring uses them before source
  generation and again for fresh-context validation
- `ENVIRONMENT_VARIABLES_MASTER_KEY` (the same stable key used by the API)
- `AI_MASTER_KEY`, `AI_CONNECTIONS_JSON`, and `AI_APPROVED_LOCAL_HOSTS` (the
  same values used by the API) so the isolated worker can run the bounded AI
  browser-tool loop without placing provider credentials in queue rows
- `DATABASE_URL` and MinIO connection variables; `MINIO_SECRET_KEY` is required
  and has no default

Browser-authoring sessions persist only sanitized semantic snapshots and tool
results. Resolved variables, cookies, headers, screenshots, traces, and videos
are never written to authoring-session records or sent to the AI provider.
