# Signal Deployment Makefile
.PHONY: help setup deploy ansible logs ssh status restart backup

# Default target
help:
	@echo "Available commands:"
	@echo "  make setup       - Setup local development environment"
	@echo "  make ansible     - Run Ansible playbook on VPS"
	@echo "  make logs        - View production logs (requires SSH)"
	@echo "  make ssh         - SSH into VPS"
	@echo "  make status      - Check production service status"
	@echo "  make restart     - Restart production services"
	@echo "  make backup      - Backup production database"

# Local development
setup:
	@echo "Setting up local development..."
	bun install
	docker-compose up -d
	@echo "Setup complete! Run 'bun run dev' to start."

# Ansible deployment
ansible:
	@echo "Running Ansible playbook..."
	cd deploy/ansible && ansible-playbook -i inventory playbook.yml

# SSH into VPS
ssh:
	ssh root@signal.hgdev.me

# View production logs
logs:
	ssh root@signal.hgdev.me "cd /opt/signal && docker compose -f docker-compose.prod.yml logs -f"

# Check status
status:
	@echo "Checking production status..."
	ssh root@signal.hgdev.me "cd /opt/signal && docker compose -f docker-compose.prod.yml ps"
	@echo "\nHealth check:"
	@curl -s https://signal.hgdev.me/health || echo "Health check failed"

# Restart services
restart:
	ssh root@signal.hgdev.me "cd /opt/signal && docker compose -f docker-compose.prod.yml restart"

# Backup database
backup:
	@echo "Creating database backup..."
	ssh root@signal.hgdev.me "cd /opt/signal && docker exec signal-postgres pg_dump -U signal signal_db" > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup saved!"

# Update SSL certificate
ssl:
	ssh root@signal.hgdev.me "certbot renew"

# Deploy manually (emergency)
deploy-manual:
	@echo "Manual deployment to production..."
	ssh root@signal.hgdev.me 'bash -s' < deploy/scripts/deploy.sh
