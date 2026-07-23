# Deployment Guide

This guide covers setting up and deploying Signal on your own VPS using Ansible, Docker, and GitHub Actions.

## Prerequisites

- VPS with Ubuntu 20.04+ or Debian 11+
- Domain name pointing to your VPS (signal.hgdev.me)
- GitHub repository with this code
- SSH access to your VPS

## Architecture

```
┌─────────────────┐
│   GitHub Actions │
│   (Build & Push) │
└────────┬────────┘
         │ Docker Images
         ▼
┌─────────────────┐
│     GHCR        │
│ (GitHub Container│
│    Registry)     │
└────────┬────────┘
         │ Pull Images
         ▼
┌─────────────────────────────────────────┐
│              Your VPS                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Nginx  │ │   API   │ │   Web   │   │
│  │(Reverse │ │(Port    │ │(Port    │   │
│  │ Proxy)  │ │ 11010)  │ │ 11020)  │   │
│  └────┬────┘ └────┬────┘ └────┬────┘   │
│       └───────────┴───────────┘         │
│                   │                     │
│       ┌───────────┴───────────┐         │
│       ▼                       ▼         │
│  ┌─────────┐            ┌─────────┐     │
│  │Postgres │            │  MinIO  │     │
│  │(11001)  │            │(11002)  │     │
│  └─────────┘            └─────────┘     │
└─────────────────────────────────────────┘
```

## Quick Start

### 1. Setup Server with Ansible

Install Ansible locally:
```bash
# macOS
brew install ansible

# Ubuntu/Debian
sudo apt update && sudo apt install ansible
```

Run the playbook:
```bash
cd deploy/ansible
ansible-playbook -i inventory playbook.yml
```

This will:
- Install Docker, Docker Compose, Nginx
- Install htop, tmux, fail2ban
- Setup firewall (UFW)
- Configure Nginx reverse proxy
- Create app directories

### 2. Obtain SSL Certificate

SSH into your server and get Let's Encrypt certificate:

```bash
ssh root@signal.hgdev.me
certbot --nginx -d signal.hgdev.me
```

### 3. Setup GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

| Secret | Description | Example |
|--------|-------------|---------|
| `SSH_PRIVATE_KEY` | Your VPS private key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_HOST` | VPS hostname | `signal.hgdev.me` |
| `VPS_USER` | VPS user for deployment | `signal` |
| `APP_DIR` | App directory on VPS | `/opt/signal` |
| `POSTGRES_USER` | Database username | `signal` |
| `POSTGRES_PASSWORD` | Database password | `your-secure-password` |
| `POSTGRES_DB` | Database name | `signal_db` |
| `JWT_SECRET` | JWT signing secret | `your-jwt-secret-key` |
| `MINIO_ACCESS_KEY` | MinIO access key | `signal` |
| `MINIO_SECRET_KEY` | MinIO secret key | `your-secure-secret` |
| `MINIO_BUCKET` | MinIO bucket name | `signal-assets` |
| `MINIO_PUBLIC_URL` | Public URL for assets | `https://signal.hgdev.me/minio` |
| `FRONTEND_URL` | Frontend URL | `https://signal.hgdev.me` |
| `VITE_API_URL` | API URL for frontend build | `https://signal.hgdev.me/api` |

### 4. Enable GitHub Container Registry

Make sure GitHub Actions can push to GHCR:

1. Go to Settings → Packages
2. Ensure "Inherit access from source repository" is enabled

### 5. First Deployment

Push to main branch to trigger deployment:

```bash
git add .
git commit -m "Setup deployment pipeline"
git push origin main
```

Or trigger manually from GitHub Actions tab.

## Directory Structure

```
deploy/
├── ansible/
│   ├── inventory              # Ansible inventory file
│   ├── playbook.yml          # Main Ansible playbook
│   └── templates/
│       └── nginx-signal.conf.j2  # Nginx config template
└── README.md                 # This file

.github/workflows/
└── deploy.yml               # GitHub Actions workflow

docker-compose.prod.yml      # Production Docker Compose
```

## Manual Operations

### SSH into VPS

```bash
ssh root@signal.hgdev.me
```

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Restart services

```bash
cd /opt/signal
docker compose -f docker-compose.prod.yml restart
```

### Update single service

```bash
cd /opt/signal
docker compose -f docker-compose.prod.yml pull api
docker compose -f docker-compose.prod.yml up -d api
```

### Database backup

```bash
# Backup
docker exec signal-postgres pg_dump -U signal signal_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker exec -i signal-postgres psql -U signal signal_db < backup_file.sql
```

### View running containers

```bash
docker ps
```

## Troubleshooting

### Nginx not serving the app

Check Nginx configuration:
```bash
nginx -t
systemctl status nginx
```

### Containers not starting

Check Docker logs:
```bash
docker compose -f docker-compose.prod.yml logs
```

### Database connection issues

Verify environment variables:
```bash
cd /opt/signal
cat .env
```

### SSL certificate issues

Renew certificate:
```bash
certbot renew
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secret (32+ random characters)
- [ ] Enable UFW firewall
- [ ] Fail2ban is running
- [ ] Docker containers run as non-root
- [ ] SSL certificate is valid
- [ ] MinIO console is protected (basic auth via Nginx)
- [ ] Database not exposed to internet
- [ ] SSH key-based authentication only

## Updates and Maintenance

### Update server packages

```bash
ssh root@signal.hgdev.me
apt update && apt upgrade
```

### Update Docker images

Just push to main branch - GitHub Actions will build and deploy new images automatically.

### Rotate secrets

1. Update GitHub secrets
2. Trigger manual deployment from GitHub Actions

## Support

- Check logs: `docker compose -f docker-compose.prod.yml logs -f`
- Health check: `curl https://signal.hgdev.me/health`
- Nginx status: `systemctl status nginx`
