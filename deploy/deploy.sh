#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/probe
release_file=${1:-release.env}
compose=(docker compose --env-file .env --env-file images.env -f compose.prod.yml)

for required in .env compose.prod.yml "$release_file"; do
  if [[ ! -s $required ]]; then
    echo "Required deployment file is missing or empty: $required" >&2
    exit 1
  fi
done

exec 9>/opt/probe/.deploy.lock
if ! flock -n 9; then
  echo "Another deployment is already running" >&2
  exit 1
fi

umask 077
had_previous=false
if [[ -s images.env ]]; then
  cp images.env images.previous.env
  had_previous=true
fi
install -m 0600 "$release_file" images.env

rollback() {
  status=$?
  if [[ $status -eq 0 ]]; then
    return
  fi
  echo "Deployment failed; attempting rollback" >&2
  if [[ $had_previous == true ]]; then
    cp images.previous.env images.env
    docker compose --env-file .env --env-file images.env -f compose.prod.yml up -d --remove-orphans || true
  fi
  exit "$status"
}
trap rollback ERR

"${compose[@]}" config --quiet
execution_image=$(sed -n 's/^EXECUTION_IMAGE=//p' images.env)
if [[ -z $execution_image ]]; then
  echo "EXECUTION_IMAGE is missing from $release_file" >&2
  exit 1
fi

docker pull "$execution_image"
"${compose[@]}" pull
"${compose[@]}" up -d --remove-orphans --wait --wait-timeout 180

for attempt in {1..30}; do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:11010/health >/dev/null; then
    trap - ERR
    docker image prune -f --filter 'until=168h' >/dev/null
    echo "Deployment completed successfully"
    exit 0
  fi
  sleep 4
done

echo "External health check did not become ready" >&2
exit 1
