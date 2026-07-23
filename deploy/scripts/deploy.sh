#!/bin/bash
# Manual deployment script for production
# Run this on the VPS if GitHub Actions is unavailable

set -e

APP_DIR="/opt/signal"
GITHUB_REPOSITORY_OWNER="your-github-username"  # Update this!

cd "$APP_DIR"

echo "📥 Pulling latest images..."
docker compose -f docker-compose.prod.yml pull

echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo "🧹 Cleaning up..."
docker image prune -f
docker volume prune -f

echo "✅ Deployment complete!"
echo ""
echo "Health check:"
curl -s https://signal.hgdev.me/health || echo "⚠️  Health check failed"
