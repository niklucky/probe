# Production deployment

Probe runs on `signal.hgdev.me` as a Docker Compose application. GitHub Actions
builds immutable images for the application server, asynchronous worker, and
Playwright execution environment, publishes them to GHCR, and deploys the exact
commit SHA to the VPS.

## Topology

- One application container serves the compiled React SPA, tRPC API, uploads,
  health endpoint, and storage proxy on `127.0.0.1:11010`.
- Host Nginx is managed separately. It needs one catch-all location that proxies
  `/` to `http://127.0.0.1:11010`, including request bodies and query strings.
- PostgreSQL and MinIO have no host ports.
- Browser upload and artifact URLs use the application origin. The server
  proxies signed bucket paths to private MinIO while preserving the signed path
  and query string.
- The worker has Docker daemon access, but the application server does not.
  Disposable Playwright containers use the `probe-runner-egress` network.
- Host firewall rules reject private, loopback, link-local, multicast, and
  metadata destinations from execution containers while allowing public test
  targets.

The VPS has 2 GB of swap in addition to physical memory so one bounded browser
execution can coexist with the application services.

## Nginx contract

Nginx configuration and TLS are outside this repository. The required upstream
shape is intentionally small:

```nginx
location / {
    proxy_pass http://127.0.0.1:11010;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 100m;
}
```

## One-time provisioning

Run `deploy/provision.sh` as root with the public half of the dedicated Actions
deployment key:

```bash
DEPLOY_PUBLIC_KEY='ssh-ed25519 ...' bash deploy/provision.sh
```

The script installs Docker, creates the `probe` deploy user, enables UFW and
fail2ban, configures bounded Docker logs, creates persistent directories, adds
the restricted runner network, and installs the daily database-backup schedule.
It does not install or configure Nginx.

## GitHub Actions secrets

| Secret | Purpose |
| --- | --- |
| `VPS_HOST` | `signal.hgdev.me` |
| `VPS_USER` | Dedicated `probe` account |
| `VPS_SSH_PRIVATE_KEY` | Private half of the deployment key |
| `VPS_KNOWN_HOSTS` | Pinned SSH host-key line |
| `PRODUCTION_ENV_FILE` | Secret environment file based on `.env.production.example` |

`PRODUCTION_ENV_FILE` must use URL-safe PostgreSQL credentials because the same
password appears in `DATABASE_URL`. `PUBLIC_BASE_URL` is the externally visible
HTTPS origin configured by Nginx. Keep `AI_MASTER_KEY` and
`ENVIRONMENT_VARIABLES_MASTER_KEY` permanently stable; rotating either key
makes the values encrypted with it unreadable.

## Deployment and rollback

Every push to `main` runs types, tests, and application builds, then builds and
pushes all three images. Deployment is serialized, uploads the Compose
configuration, starts the exact SHA, and waits for health on the loopback-only
application port. Nginx availability is monitored by its owning deployment.

`deploy/deploy.sh` saves the previous image manifest and restores it if startup
or health verification fails. Manual rollback is:

```bash
cd /opt/probe
cp images.previous.env release.env
deploy/deploy.sh release.env
```

## Backups

`deploy/backup.sh` writes a PostgreSQL custom-format dump to
`/opt/probe/backups` daily and removes dumps older than 14 days. Replicate these
dumps and the `probe_minio_data` volume to independent storage before treating
the service as disaster-recovery ready.
