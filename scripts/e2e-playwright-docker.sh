#!/usr/bin/env bash
# Phase 51–54: app stack + Playwright via compose `--profile testing`.
#
# From repo root — one suite per invocation (API can only run one Auth:Mode at a time):
#   ./scripts/e2e-playwright-docker.sh              # `.env.testing` → project e2e-smoke
#   ./scripts/e2e-playwright-docker.sh --auth       # `.env.testing.auth` → e2e-auth-api-key
#   ./scripts/e2e-playwright-docker.sh --jwt        # `.env.testing.jwt` → e2e-auth-jwt
#   ./scripts/e2e-playwright-docker.sh --proxy      # `.env.testing.proxy` → e2e-auth-proxy
#   ./scripts/e2e-playwright-docker.sh --visual     # `.env.testing` → e2e-visual (screenshot baselines; Linux/CI)
#   ./scripts/e2e-playwright-docker.sh --all-auth   # sequential: api-key, jwt, proxy (tear down between)
#   ./scripts/e2e-playwright-docker.sh --help
#
# Reproduce CI locally: match the job’s `--env-file` and PLAYWRIGHT project (see ci.yml step names).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DOCKER_E2E_SH="${ROOT}/scripts/e2e-playwright-docker.sh"

MODE="smoke"

print_help() {
  cat <<'EOF'
Usage: e2e-playwright-docker.sh [OPTION]

  (default)    Non-auth smoke — .env.testing, Playwright project e2e-smoke
  --auth       API key auth — .env.testing.auth, e2e-auth-api-key
  --jwt        JWT bearer — .env.testing.jwt, e2e-auth-jwt
  --proxy      Trusted proxy headers — .env.testing.proxy, e2e-auth-proxy
  --visual     Visual regression — .env.testing, e2e-visual (canonical screenshots)
  --all-auth   Run --auth, then --jwt, then --proxy (fresh volume each time)
  -h, --help   This help

Note: --all-auth tears down each stack before starting the next. Single-mode leaves
containers up; tear down with: docker compose --env-file <file> down -v
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --auth)
      MODE="auth"
      shift
      ;;
    --jwt)
      MODE="jwt"
      shift
      ;;
    --proxy)
      MODE="proxy"
      shift
      ;;
    --visual)
      MODE="visual"
      shift
      ;;
    --all-auth)
      MODE="all-auth"
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      print_help >&2
      exit 1
      ;;
  esac
done

wait_health() {
  for _ in $(seq 1 60); do
    if curl -sf http://127.0.0.1:3000/api/health >/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "Stack did not become healthy on :3000" >&2
  return 1
}

run_one_suite() {
  local env_file=$1
  local project=$2
  local label=$3

  echo "==> E2E: ${label}"
  echo "    env file: ${env_file}"
  echo "    Playwright: --project=${project}"

  docker compose --env-file "$env_file" up -d --build api web
  wait_health
  docker compose --env-file "$env_file" --profile testing run --rm \
    -e "PLAYWRIGHT_CLI_ARGS=--project=${project}" \
    playwright
}

if [[ "$MODE" == "all-auth" ]]; then
  bash "$DOCKER_E2E_SH" --auth
  docker compose --env-file .env.testing.auth down -v
  bash "$DOCKER_E2E_SH" --jwt
  docker compose --env-file .env.testing.jwt down -v
  bash "$DOCKER_E2E_SH" --proxy
  docker compose --env-file .env.testing.proxy down -v
  echo "All auth-mode browser E2E suites passed (api-key, jwt, proxy)."
  exit 0
fi

case "$MODE" in
  smoke)
    ENV_FILE=".env.testing"
    PROJECT="e2e-smoke"
    LABEL="non-auth smoke (persisted-flows)"
    ;;
  auth)
    ENV_FILE=".env.testing.auth"
    PROJECT="e2e-auth-api-key"
    LABEL="API key auth"
    ;;
  jwt)
    ENV_FILE=".env.testing.jwt"
    PROJECT="e2e-auth-jwt"
    LABEL="JWT bearer auth"
    ;;
  proxy)
    ENV_FILE=".env.testing.proxy"
    PROJECT="e2e-auth-proxy"
    LABEL="trusted proxy headers auth"
    ;;
  visual)
    ENV_FILE=".env.testing"
    PROJECT="e2e-visual"
    LABEL="visual regression (canonical screenshots)"
    ;;
  *)
    echo "internal: bad MODE=$MODE" >&2
    exit 1
    ;;
esac

run_one_suite "$ENV_FILE" "$PROJECT" "$LABEL"

echo "E2E passed (${LABEL}). Stack still running; use: docker compose --env-file ${ENV_FILE} down -v"
