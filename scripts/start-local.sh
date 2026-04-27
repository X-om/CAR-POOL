#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_file() {
  if [[ ! -f "$1" ]]; then
    echo "Missing required file: $1" >&2
    exit 1
  fi
}

need_cmd docker
need_cmd pnpm

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop and try again." >&2
  exit 1
fi

# Prefer docker compose v2, fall back to docker-compose if needed.
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Docker Compose not found. Install Docker Desktop (recommended) or docker-compose." >&2
  exit 1
fi

need_file ".env.local"
need_file "apps/web/.env.local"

if [[ ! -d "node_modules" ]]; then
  echo "Installing dependencies (pnpm install)…"
  pnpm install
fi

# Warn about a common Gmail App Password copy/paste gotcha.
if grep -Eq '^SMTP_PASS=.*\s+.*$' .env.local; then
  echo "WARNING: SMTP_PASS contains spaces. Gmail App Passwords should be pasted without spaces." >&2
fi

echo "Starting backend infrastructure (Postgres/Redis/Redpanda) in Docker…"
"${COMPOSE[@]}" -f infra/docker/docker-compose.yml up -d postgres redis redpanda

echo "Running database migrations…"
pnpm --filter @repo/database migrate

echo ""
echo "Starting all dev services (backend + frontend)…"
echo "- API Gateway:      http://127.0.0.1:3000"
echo "- WebSocket Gateway: ws://127.0.0.1:3001"
echo "- Web (Next.js):    http://127.0.0.1:3002"
echo ""
echo "To stop Docker infra later:"
echo "  ${COMPOSE[*]} -f infra/docker/docker-compose.yml down"
echo ""

pnpm dev
