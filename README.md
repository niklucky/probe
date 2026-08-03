# Probe - Test Management Platform

A modern, user-friendly test management application for QA engineers and teams. Built with TypeScript, Bun, React, and PostgreSQL.

Accepted Playwright automations can run asynchronously in the separate isolated
worker. See [the runner guide](docs/automation-runner.md) for local setup,
security boundaries, recovery behavior, and artifact retention.

Production is deployed as immutable containers through GitHub Actions. See
[the production deployment guide](deploy/README.md) for architecture,
provisioning, secrets, deployment, backup, and rollback procedures.

## Features

### Current Implementation (MVP)
- **Authentication**: JWT-based email/password auth
- **Projects**: Create and manage test projects with logos
- **Products**: Define different products within projects (websites, mobile apps, APIs, etc.)
- **Teams**: Organize team members with role-based access
- **Test Suites**: Group test cases with full version history
- **Test Cases**: Multi-step tests with versioning support
- **Test Runs**: Execute tests and track results

### Versioning System
Unlike traditional test management tools, Probe implements a robust versioning system:
- **Test Suites**: Every edit creates a new version, preserving history
- **Test Cases**: Linked to specific suite versions, maintaining test integrity over time
- **Test Runs**: Reference specific test case versions, enabling accurate historical reporting

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono + tRPC
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (BaseUI)
- **Database**: PostgreSQL 17 + Drizzle ORM
- **Storage**: MinIO (S3-compatible)
- **Architecture**: Turborepo monorepo

## Port Configuration (Pool: 11000-11100)

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 11001 | Database server |
| MinIO API | 11002 | S3-compatible storage API |
| MinIO Console | 11003 | MinIO web console |
| API Server | 11010 | Hono/tRPC backend |
| Web App | 11020 | Vite/React frontend |

## Project Structure

```
probe/
├── apps/
│   ├── api/              # Hono + tRPC backend
│   ├── runner/           # Isolated asynchronous Playwright worker
│   └── web/              # React + Vite frontend
├── packages/
│   ├── db/               # Drizzle ORM schemas & migrations
│   ├── server/           # Application services and tRPC router
│   ├── shared/           # Shared TypeScript types
│   └── typescript-config/# Shared TS configs
├── compose.local.yml     # Local Postgres + MinIO
└── turbo.json           # Turborepo config
```

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) installed
- Docker & Docker Compose

### 1. Clone and Install

```bash
git clone <repository>
cd probe
bun install
```

### 2. Start Infrastructure

```bash
docker compose -f compose.local.yml up -d
```

This starts:
- PostgreSQL 17 on port 11001
- MinIO on ports 11002 (API) and 11003 (Console)

### 3. Setup Database

Generate and run migrations:

```bash
cd packages/db
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

Or use the turbo command:

```bash
bun run db:migrate
```

### 4. Run Development Servers

Start all apps:

```bash
bun run dev
```

Or run individually:

```bash
# Terminal 1: API
bun run --filter=@probe/api dev

# Terminal 2: Web
bun run --filter=@probe/web dev
```

### 5. Access the App

- **Web App**: http://localhost:11020
- **API**: http://localhost:11010
- **MinIO Console**: http://localhost:11003 (login: signal / signal_password)

## Environment Variables

Create `.env` files in each app directory:

### apps/api/.env
```env
DATABASE_URL=postgres://signal:signal_password@localhost:11001/signal_db
JWT_SECRET=your-super-secret-key-change-this-in-production
PORT=11010
MINIO_ENDPOINT=localhost
MINIO_PORT=11002
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=signal
MINIO_SECRET_KEY=signal_password
MINIO_BUCKET=signal-assets
MINIO_PUBLIC_URL=http://localhost:11002
FRONTEND_URL=http://localhost:11020
```

### Legacy-compatible local defaults

Probe intentionally keeps the existing `signal` database user, database name,
MinIO credentials, and `signal-assets` bucket as its local defaults. These values
are infrastructure identifiers rather than product branding. Keeping them avoids
disconnecting existing local installations from their persisted PostgreSQL and
MinIO data after an upgrade.

New installations may choose Probe-specific values by setting `DATABASE_URL`,
`MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, and `MINIO_BUCKET` consistently in the
API environment and Docker Compose configuration. Existing installations do not
need a data migration or reset for this rename.

### apps/web/.env
```env
VITE_API_URL=http://localhost:11010
```

## Database Schema

### Core Entities

**Users**
- Email/password authentication
- Role-based access (admin, qa, manual_tester, viewer)

**Projects**
- Name, description, logo, website
- Belongs to creator

**Products** (per Project)
- Type: website, mobile_app, server, api, desktop_app, other
- Name and description

**Teams** (per Project)
- Name
- Members with roles

**Test Suites** (per Project)
- Name, description
- Current version tracking
- Full version history

**Test Suite Versions**
- Version number (auto-incrementing)
- Snapshots of suite state
- Created on every edit

**Test Cases** (per Suite)
- Belongs to suite
- Current version tracking
- Multiple versions per case

**Test Case Versions**
- Linked to specific suite version
- Fields: title, description, steps[], expectedResult, priority, status, tags[]
- Tracks who created each version

**Test Runs** (per Project)
- Name, description
- Links to specific test case versions
- Tracks execution progress

**Test Results**
- Status: passed, failed, skipped, blocked, not_run
- Notes and execution details
- Links to specific test case versions

## API Endpoints

### tRPC Router Structure

```
auth/
  - register
  - login
  - me

projects/
  - list
  - create
  - get
  - update
  - delete

products/
  - list
  - create
  - update
  - delete

teams/
  - list
  - create
  - addMember
  - updateMemberRole
  - removeMember

testSuites/
  - list
  - create
  - get
  - update (creates new version)
  - getVersions
  - delete

testCases/
  - list
  - create
  - get
  - update (creates new version)
  - getVersions
  - delete

testRuns/
  - list
  - create
  - get
  - updateResult
  - complete
  - delete
```

### File Upload

POST `/upload` - Get pre-signed MinIO URL for file uploads

## Development Workflow

### Adding shadcn Components

```bash
cd apps/web
bun run shadcn add button
```

### Database Changes

1. Edit schema in `packages/db/src/schema/index.ts`
2. Generate migration:
   ```bash
   bun run db:generate
   ```
3. Run migration:
   ```bash
   bun run db:migrate
   ```
4. View database in Studio:
   ```bash
   bun run db:studio
   ```

### Code Style

- TypeScript strict mode enabled
- Follow existing patterns in each package
- Use existing shadcn/ui components when available
- Prefer type-safe tRPC procedures over REST

## Roadmap

### Phase 1 (MVP) ✓
- Basic auth, projects, products, teams
- Test suites and cases with versioning
- Test runs and results

### Phase 2 (UI Polish)
- Add shadcn/ui components
- Rich text editor for test descriptions
- Drag-and-drop test reordering
- Better test run execution UI

### Phase 3 (Collaboration)
- Real-time updates via WebSocket
- Comments on test cases
- Activity feed

### Phase 4 (Integrations)
- AI auto-test generation
- CI/CD integrations
- Webhook support

### Phase 5 (Mobile & Extensions)
- Mobile app (React Native)
- Browser extension for UI testing
- Desktop app (Electron/Tauri)

## Contributing

1. Create feature branch
2. Make changes following existing patterns
3. Test locally
4. Submit PR

## License

MIT
